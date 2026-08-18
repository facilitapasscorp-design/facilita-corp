import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { gerarAccessCode } from '../../../lib/wooba-auth'
import { mensagemAmigavel } from '../../../lib/erros-wooba'
import { autenticar, ehErro } from '../../../lib/auth-api'

// A resposta da WOOBA e' JSON sem contrato tipado; mesmo padrao de
// consultar-reserva/route.ts — um alias so, em vez de `any` espalhado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function getLegs(viagem: Any): Any[] {
  return viagem.Voos?.length
    ? viagem.Voos
    : (viagem.Segmentos || []).flatMap((s: Any) => s.Voos || [])
}

function extrairClasses(viagem: Any) {
  let classeRef = ''
  return getLegs(viagem)
    .filter((leg: Any) => leg.Numero || leg.NumeroDoVoo)
    .map((leg: Any) => {
      const bt = leg.BaseTarifaria?.[0]
      const classe = leg.Classe || bt?.Classe || classeRef
      if (classe) classeRef = classe
      return {
        BaseTarifaria: bt?.Codigo || '',
        Classe: classe,
        Familia: bt?.Familia || leg.Familia || '',
        NumeroDoVoo: String(leg.Numero || leg.NumeroDoVoo || ''),
      }
    })
}

function toWcfDate(dateStr: string): string {
  // Ancora em meia-noite LOCAL (-03:00), não UTC — senão o offset "-0300" no
  // formato WCF faz a WOOBA reconstruir a data um dia antes do digitado.
  const d = new Date(dateStr + 'T03:00:00.000Z')
  return `/Date(${d.getTime()}-0300)/`
}

type Wooba = {
  BASE: string
  cred: { Login: string; Senha: string }
  headers: () => Record<string, string>
}

/**
 * Fornecedor de onde a viagem veio (SABRE, GOL GWS, NDC LATAM...). É esse
 * código, e não a companhia aérea, que determina o que pode ser tarifado junto.
 */
function fornecedorDe(viagem: Any): number | null {
  return viagem?.Fornecedor?.Codigo ?? null
}

/**
 * Ida e volta só podem ir numa única tarifação quando vêm do MESMO fornecedor.
 *
 * Foi medido contra o sandbox: combinar GOL (GOL GWS) com LATAM (NDC LATAM)
 * faz o Tarifar responder "é necessário selecionar somente segmentos NDCLatam"
 * e devolver zero viagens — ou seja, a compra inteira morre antes de reservar.
 * Fornecedor igual cobre o caso bom: dois trechos do mesmo GDS, ainda que de
 * companhias diferentes, tarifam como ida e volta (RT), que costuma sair mais
 * barato e gera um localizador só.
 */
function podeCombinar(vooIda: Any, vooVolta: Any): boolean {
  if (!vooVolta) return true
  const fi = fornecedorDe(vooIda)
  const fv = fornecedorDe(vooVolta)
  if (fi == null || fv == null) return false   // sem informação, não arrisca
  return fi === fv
}

/** Tarifar + Reservar de um par (ou de um trecho sozinho, com vooVolta null). */
async function tarifarEReservar(
  w: Wooba, vooIda: Any, vooVolta: Any | null, passageiros: Any[], rotulo: string,
): Promise<{ reservas: Any[] } | { erro: string }> {
  const classes = [...extrairClasses(vooIda), ...(vooVolta ? extrairClasses(vooVolta) : [])]

  const tarifaBody: Any = {
    ...w.cred, ClienteId: 0,
    IdentificacaoDaViagem: vooIda.IdentificacaoDaViagem,
    ViagemIda: vooIda.Id,
    ClassesSelecionadas: classes,
    RetornarPlanoDeFinanciamento: true,
    RetornarRegrasTarifarias: true,
    TarifarMelhorFamilia: true,
    TarifarMelhorPreco: true,
  }
  if (vooVolta) {
    tarifaBody.ViagemVolta = vooVolta.Id
    tarifaBody.IdentificacaoDaViagemVolta = vooVolta.IdentificacaoDaViagem
  }

  const tarifaRes  = await fetch(`${w.BASE}/Tarifar`, { method: 'POST', headers: w.headers(), body: JSON.stringify(tarifaBody) })
  const tarifaData = await tarifaRes.json()
  console.log(`[TARIFAR:${rotulo}] status:`, tarifaRes.status, '| Exception:', tarifaData.Exception?.Message ?? null,
              '| ViagensTrecho1:', tarifaData.ViagensTrecho1?.length ?? 0)
  if (tarifaData.Exception) return { erro: tarifaData.Exception.Message }

  const idViagem = tarifaData.ViagensTrecho1?.[0]?.IdentificacaoDaViagem || vooIda.IdentificacaoDaViagem
  const idViagemVolta = vooVolta
    ? (tarifaData.ViagensTrecho2?.[0]?.IdentificacaoDaViagem || vooVolta.IdentificacaoDaViagem)
    : null

  const primAdulto = passageiros.find((p: Any) => (p.tipo || 'ADT') === 'ADT') || passageiros[0]
  const telContato = primAdulto.telefone ? primAdulto.telefone.replace(/\D/g, '') : ''

  const reservaBody = {
    ...w.cred,
    ClienteId: 0,
    IdentificacaoDaViagem: idViagem,
    ...(idViagemVolta ? { IdentificacaoDaViagemVolta: idViagemVolta } : {}),
    ClassesSelecionadas: classes,
    Passageiros: passageiros.map((p: Any, i: number) => ({
      Nome:        p.nome.toUpperCase(),
      Sobrenome:   p.sobrenome.toUpperCase(),
      CPF:         p.cpf ? p.cpf.replace(/\D/g, '') : undefined,
      Nascimento:  toWcfDate(p.nascimento),
      Email:       p.email || undefined,
      Telefone: p.telefone ? (() => { const tel = p.telefone.replace(/\D/g, ''); return { Id: 0, NumeroDDD: tel.slice(0, 2), NumeroDDI: '55', NumeroTelefone: tel.slice(2), Tipo: 1 } })() : undefined,
      FaixaEtaria: p.tipo || 'ADT',
      Sexo:        p.sexo || 'M',
      Linha:       String(i + 1),
    })),
    InformacoesComplementaresPassageiro: passageiros.map((p: Any) => ({
      Nome:      p.nome.toUpperCase(),
      Sobrenome: p.sobrenome.toUpperCase(),
      Tipo:      p.tipo || 'ADT',
    })),
    Contatos: [{
      Nome:           `${primAdulto.nome} ${primAdulto.sobrenome}`.toUpperCase(),
      Email:          primAdulto.email,
      NumeroDDD:      telContato.slice(0, 2) || '11',
      NumeroTelefone: telContato.slice(2) || '999999999',
      NumeroDDI:      '55',
      Tipo:           0,
    }],
    Solicitante:         primAdulto.nome.toUpperCase(),
    ValidarAnaliseRisco: false,
  }

  const reservaRes  = await fetch(`${w.BASE}/Reservar`, { method: 'POST', headers: w.headers(), body: JSON.stringify(reservaBody) })
  const reservaData = JSON.parse(await reservaRes.text())
  console.log(`[RESERVAR:${rotulo}] status:`, reservaRes.status, '| Exception:', reservaData.Exception?.Message ?? null)
  if (reservaData.Exception) return { erro: reservaData.Exception.Message }

  const reservas = reservaData.Reservas ?? []
  if (reservas.length === 0) return { erro: 'Nenhuma reserva retornada pela WOOBA' }
  console.log(`[RESERVAR:${rotulo}] Reservas[]:`, JSON.stringify(reservas.map((r: Any) => r.Localizador)))
  return { reservas }
}

/**
 * Desfaz na WOOBA uma reserva que ESTA requisição acabou de criar.
 *
 * Escopo deliberadamente estreito: só é chamada com localizadores nascidos
 * segundos antes, dentro do mesmo POST, quando o outro trecho falhou e deixar
 * a ida de pé venderia meia viagem ao cliente. Não é — e não deve virar — uma
 * função de cancelamento genérica.
 */
async function desfazerReserva(w: Wooba, localizador: string): Promise<boolean> {
  try {
    const res = await fetch(`${w.BASE}/Cancelar`, {
      method: 'POST', headers: w.headers(),
      body: JSON.stringify({ ...w.cred, ClienteId: 0, Localizador: localizador }),
    })
    const data = await res.json()
    const ok = !data.Exception
    console.log('[DESFAZER] localizador:', localizador, '| ok:', ok, '| erro:', data.Exception?.Message ?? null)
    return ok
  } catch (e) {
    console.error('[DESFAZER] falhou para', localizador, e instanceof Error ? e.message : e)
    return false
  }
}

interface LocalizadorEntry {
  localizador: string; companhia: string | null; origem: string | null; destino: string | null
  trecho: 'ida' | 'volta'; valor: number | null; id: number
}

function mapearLocalizadores(reservas: Any[], vooIda: Any, vooVolta: Any | null, trechoFixo?: 'ida' | 'volta'): LocalizadorEntry[] {
  return reservas.map((r: Any, idx: number) => {
    const viagem = r.Viagens?.[0] ?? {}
    const origem = viagem.Origem?.CodigoIata ?? null
    const destino = viagem.Destino?.CodigoIata ?? null

    let trecho: 'ida' | 'volta' = trechoFixo ?? (idx === 0 ? 'ida' : 'volta')
    if (!trechoFixo) {
      if (vooIda?.Origem?.CodigoIata === origem && vooIda?.Destino?.CodigoIata === destino) trecho = 'ida'
      else if (vooVolta?.Origem?.CodigoIata === origem && vooVolta?.Destino?.CodigoIata === destino) trecho = 'volta'
    }

    return {
      localizador: r.Localizador,
      companhia: viagem.CiaMandatoria?.CodigoIata ?? null,
      origem, destino, trecho,
      valor: typeof r.ValorPendenteParaPagamento === 'number' ? r.ValorPendenteParaPagamento : null,
      id: r.Id,
    }
  })
}

export async function POST(req: NextRequest) {
  const ctx = await autenticar(req)
  if (ehErro(ctx)) return ctx

  try {
    const { vooIda, vooVolta, passageiros: passageirosRaw, dataIda, dataVolta, violacoesPolitica } = await req.json()
    // Violações de política com a justificativa que o comprador escolheu na
    // tela. Até agora isso era calculado, mostrado e descartado — ninguém
    // conseguia responder quantas viagens saíram fora da regra, nem por quê.
    const violacoes: Any[] = Array.isArray(violacoesPolitica) ? violacoesPolitica : []
    const passageiros: Any[] = Array.isArray(passageirosRaw) ? passageirosRaw : [passageirosRaw]

    const token = process.env.WOOBA_TOKEN!
    const w: Wooba = {
      BASE: process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX,
      cred: {
        Login: process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!,
        Senha: process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!,
      },
      headers: () => ({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Developer-Token': token,
        'Developer-Access-Code': gerarAccessCode(),
      }),
    }

    const combinavel = podeCombinar(vooIda, vooVolta)
    console.log('[FLUXO] fornecedorIda:', fornecedorDe(vooIda), '| fornecedorVolta:', fornecedorDe(vooVolta),
                '| combinavel:', combinavel)

    let localizadores: LocalizadorEntry[]

    if (combinavel) {
      // Caminho de sempre: uma tarifação só. Ida e volta do mesmo fornecedor
      // viram tarifa RT, e a WOOBA decide se devolve um ou dois localizadores.
      const r = await tarifarEReservar(w, vooIda, vooVolta, passageiros, 'combinado')
      if ('erro' in r) return NextResponse.json({ erro: mensagemAmigavel(r.erro) }, { status: 400 })
      localizadores = mapearLocalizadores(r.reservas, vooIda, vooVolta)
    } else {
      // Fornecedores diferentes: duas reservas independentes, na ordem ida →
      // volta. Cada uma é uma viagem só de ida do ponto de vista da WOOBA.
      const rIda = await tarifarEReservar(w, vooIda, null, passageiros, 'ida')
      if ('erro' in rIda) return NextResponse.json({ erro: mensagemAmigavel(rIda.erro) }, { status: 400 })

      const rVolta = await tarifarEReservar(w, vooVolta, null, passageiros, 'volta')
      if ('erro' in rVolta) {
        // A ida já existe na companhia. Deixá-la de pé venderia meia viagem,
        // então desfazemos antes de responder.
        const locsIda = rIda.reservas.map((r: Any) => r.Localizador)
        const desfeitas = await Promise.all(locsIda.map(l => desfazerReserva(w, l)))
        const sobrou = locsIda.filter((_, i) => !desfeitas[i])
        const motivo = mensagemAmigavel(rVolta.erro)
        return NextResponse.json({
          erro: sobrou.length
            ? `${motivo} A ida chegou a ser reservada (localizador ${sobrou.join(', ')}) e não conseguimos desfazer sozinhos — fale com o Suporte antes de tentar de novo.`
            : `${motivo} A reserva da ida foi desfeita e nada foi cobrado.`,
        }, { status: 400 })
      }

      localizadores = [
        ...mapearLocalizadores(rIda.reservas,   vooIda,   null, 'ida'),
        ...mapearLocalizadores(rVolta.reservas, vooVolta, null, 'volta'),
      ]
    }

    // Fallback de valor: se a WOOBA não itemizou por localizador, usa os preços
    // já conhecidos da seleção; se nem isso casar, joga o total no primeiro.
    if (localizadores.every(l => l.valor == null)) {
      const precoIda   = vooIda?.Preco?.Total ?? 0
      const precoVolta = vooVolta?.Preco?.Total ?? 0
      let algumCasou = false
      for (const l of localizadores) {
        if (l.trecho === 'ida' && precoIda)     { l.valor = precoIda;   algumCasou = true }
        if (l.trecho === 'volta' && precoVolta) { l.valor = precoVolta; algumCasou = true }
      }
      if (!algumCasou && localizadores[0]) localizadores[0].valor = precoIda + precoVolta
    }

    console.log('[RESERVAR] localizadores finais:', JSON.stringify(localizadores))

    // Gravação no banco com a service role — ver histórico: antes isso era feito
    // no frontend dentro de um try/catch vazio e falhava em silêncio.
    let erroGravacao: string | null = null
    try {
      const { data: vinculo } = await ctx.supabase
        .from('usuarios_empresas').select('empresa_id').eq('user_id', ctx.user.id).maybeSingle()

      const primAdulto = passageiros.find((p: Any) => (p.tipo || 'ADT') === 'ADT') || passageiros[0]
      const nomePassageiro = [primAdulto?.nome, primAdulto?.sobrenome]
        .filter(Boolean).join(' ').trim().toUpperCase() || null
      const grupoReserva = localizadores.length > 1 ? randomUUID() : null

      // A lista inteira vai junto: o relatório contava uma pessoa quando
      // viajavam três, porque só o primeiro adulto era gravado.
      const listaPassageiros = passageiros.map((p: Any) => ({
        nome:      String(p.nome ?? '').toUpperCase(),
        sobrenome: String(p.sobrenome ?? '').toUpperCase(),
        tipo:      p.tipo || 'ADT',
      }))

      const linhas = localizadores.map(l => ({
        user_id:         ctx.user.id,
        empresa_id:      vinculo?.empresa_id ?? null,
        localizador:     l.localizador,
        companhia:       l.companhia,
        grupo_reserva:   grupoReserva,
        trecho:          localizadores.length > 1 ? l.trecho : null,
        origem:          l.origem ?? (l.trecho === 'volta' ? vooVolta?.Origem?.CodigoIata : vooIda?.Origem?.CodigoIata) ?? '',
        destino:         l.destino ?? (l.trecho === 'volta' ? vooVolta?.Destino?.CodigoIata : vooIda?.Destino?.CodigoIata) ?? '',
        data_voo:        (l.trecho === 'volta' ? dataVolta || dataIda : dataIda) || null,
        passageiro_nome: nomePassageiro,
        passageiros:     listaPassageiros,
        valor:           l.valor,
        status:          'Ativa',
        fora_politica:    violacoes.length > 0,
        politica_motivos: violacoes.length ? violacoes : null,
      }))

      const { error } = await ctx.supabase.from('reservas').insert(linhas)
      if (error) throw new Error(error.message)

      // Guarda os passageiros para a próxima compra. É um extra: se falhar,
      // a reserva já está gravada e ninguém perde nada.
      if (vinculo?.empresa_id) {
        salvarPassageiros(ctx, vinculo.empresa_id, passageiros)
          .catch(e => console.error('[RESERVAR] Falha ao salvar passageiros:', e))
      }
    } catch (e) {
      erroGravacao = e instanceof Error ? e.message : 'Falha ao gravar a reserva'
      console.error('[RESERVAR] FALHA AO GRAVAR NO BANCO —',
        JSON.stringify(localizadores.map(l => l.localizador)),
        '| user:', ctx.user.email, '|', erroGravacao)
    }

    return NextResponse.json({
      localizador: localizadores[0].localizador,
      localizadores,
      totalReservas: localizadores.length,
      erroGravacao,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[TARIFAR-RESERVAR] erro inesperado:', msg)
    return NextResponse.json({ erro: mensagemAmigavel(msg) }, { status: 500 })
  }
}

/**
 * Salva (ou atualiza) os passageiros na base da empresa, para que a próxima
 * compra possa aproveitá-los. Quem tem CPF é identificado pelo CPF; bebê de
 * colo, que costuma não ter, é identificado por nome e nascimento.
 */
async function salvarPassageiros(ctx: Any, empresaId: string, passageiros: Any[]) {
  for (const p of passageiros) {
    const cpf = String(p.cpf ?? '').replace(/\D/g, '') || null
    const linha = {
      empresa_id: empresaId,
      criado_por: ctx.user.id,
      nome:       String(p.nome ?? '').toUpperCase().trim(),
      sobrenome:  String(p.sobrenome ?? '').toUpperCase().trim(),
      cpf,
      nascimento: p.nascimento || null,
      email:      p.email || null,
      telefone:   p.telefone || null,
      sexo:       p.sexo === 'F' ? 'F' : 'M',
      tipo:       p.tipo || 'ADT',
      updated_at: new Date().toISOString(),
    }
    if (!linha.nome || !linha.sobrenome) continue

    if (cpf) {
      await ctx.supabase.from('passageiros')
        .upsert(linha, { onConflict: 'empresa_id,cpf' })
      continue
    }

    const { data: existente } = await ctx.supabase
      .from('passageiros').select('id')
      .eq('empresa_id', empresaId)
      .eq('nome', linha.nome)
      .eq('sobrenome', linha.sobrenome)
      .is('cpf', null)
      .maybeSingle()

    if (existente?.id) await ctx.supabase.from('passageiros').update(linha).eq('id', existente.id)
    else               await ctx.supabase.from('passageiros').insert(linha)
  }
}
