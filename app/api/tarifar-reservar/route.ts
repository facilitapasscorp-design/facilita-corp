import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function getLegs(viagem: any): any[] {
  return viagem.Voos?.length
    ? viagem.Voos
    : (viagem.Segmentos || []).flatMap((s: any) => s.Voos || [])
}

function extrairClasses(viagem: any) {
  let classeRef = ''
  return getLegs(viagem)
    .filter((leg: any) => leg.Numero || leg.NumeroDoVoo)
    .map((leg: any) => {
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
  const d = new Date(dateStr + 'T00:00:00.000Z')
  return `/Date(${d.getTime()}-0300)/`
}

export async function POST(req: NextRequest) {
  try {
    const { vooIda, vooVolta, passageiros: passageirosRaw } = await req.json()
    const passageiros: any[] = Array.isArray(passageirosRaw) ? passageirosRaw : [passageirosRaw]

    const BASE  = process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX
    const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
    const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
    const token = process.env.WOOBA_TOKEN!
    const cred  = { Login: login, Senha: senha }



    const headers = () => ({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Developer-Token': token,
      'Developer-Access-Code': gerarAccessCode(),
    })

    const classesIda   = extrairClasses(vooIda)
    const classesVolta = vooVolta ? extrairClasses(vooVolta) : []
    // A WOOBA identifica cada perna pelo próprio NumeroDoVoo dentro de um único
    // array — não existe campo "ClassesSelecionadasVolta" separado no schema.
    // Quando ida/volta vêm de sessões diferentes (ex: companhias diferentes),
    // enviar as classes em campos separados faz a API rejeitar ou ignorar a volta.
    const classesCombinadas = [...classesIda, ...classesVolta]

    // 1. Tarifar
    const tarifaBody: any = {
      ...cred, ClienteId: 0,
      IdentificacaoDaViagem: vooIda.IdentificacaoDaViagem,
      ViagemIda: vooIda.Id,
      ClassesSelecionadas: classesCombinadas,
      RetornarPlanoDeFinanciamento: true,
      RetornarRegrasTarifarias: true,
      TarifarMelhorFamilia: true,
      TarifarMelhorPreco: true,
    }
    if (vooVolta) {
      tarifaBody.ViagemVolta = vooVolta.Id
      // Token de sessão da volta — sem isso a API não consegue resolver
      // ViagemVolta quando ida e volta vêm de buscas/sistemas diferentes.
      tarifaBody.IdentificacaoDaViagemVolta = vooVolta.IdentificacaoDaViagem
    }

    const tarifaRes  = await fetch(`${BASE}/Tarifar`, {
      method: 'POST', headers: headers(), body: JSON.stringify(tarifaBody),
    })
    const tarifaData = await tarifaRes.json()
    console.log('[TARIFAR] status:', tarifaRes.status, '| Exception:', tarifaData.Exception?.Message ?? null)
    console.log('[TARIFAR] ViagensTrecho1 count:', tarifaData.ViagensTrecho1?.length ?? 0)

    if (tarifaData.Exception) {
      return NextResponse.json({ erro: tarifaData.Exception.Message }, { status: 400 })
    }

    const idViagem = tarifaData.ViagensTrecho1?.[0]?.IdentificacaoDaViagem
      || vooIda.IdentificacaoDaViagem
    // ViagensTrecho2[0].IdentificacaoDaViagem normalmente vem null do Tarifar —
    // cai no token original da própria busca da volta (mesmo padrão da ida).
    const idViagemVolta = vooVolta
      ? (tarifaData.ViagensTrecho2?.[0]?.IdentificacaoDaViagem || vooVolta.IdentificacaoDaViagem)
      : null

    // 2. Reservar — estrutura exata da homologação WOOBA
    const primAdulto = passageiros.find((p: any) => (p.tipo || 'ADT') === 'ADT') || passageiros[0]
    const telContato = primAdulto.telefone ? primAdulto.telefone.replace(/\D/g, '') : ''

    const reservaBody = {
      ...cred,
      ClienteId: 0,
      IdentificacaoDaViagem: idViagem,
      ...(idViagemVolta ? { IdentificacaoDaViagemVolta: idViagemVolta } : {}),
      ClassesSelecionadas: classesCombinadas,
      Passageiros: passageiros.map((p: any, i: number) => ({
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
      InformacoesComplementaresPassageiro: passageiros.map((p: any) => ({
        Nome:      p.nome.toUpperCase(),
        Sobrenome: p.sobrenome.toUpperCase(),
        Tipo:      p.tipo || 'ADT',
      })),
      Contatos: [
        {
          Nome:           `${primAdulto.nome} ${primAdulto.sobrenome}`.toUpperCase(),
          Email:          primAdulto.email,
          NumeroDDD:      telContato.slice(0, 2) || '11',
          NumeroTelefone: telContato.slice(2) || '999999999',
          NumeroDDI:      '55',
          Tipo:           0,
        },
      ],
      Solicitante:         primAdulto.nome.toUpperCase(),
      ValidarAnaliseRisco: false,
    }

    const reservaRes  = await fetch(`${BASE}/Reservar`, {
      method: 'POST', headers: headers(), body: JSON.stringify(reservaBody),
    })
    const reservaRaw = await reservaRes.text()
    const reservaData = JSON.parse(reservaRaw)
    console.log('[RESERVAR] status:', reservaRes.status, '| Exception:', reservaData.Exception?.Message ?? null)

    if (reservaData.Exception) {
      return NextResponse.json({ erro: reservaData.Exception.Message }, { status: 400 })
    }

    const reservas = reservaData.Reservas ?? []
    if (reservas.length === 0) {
      return NextResponse.json({ erro: 'Nenhuma reserva retornada pela WOOBA' }, { status: 400 })
    }

    // Loga a estrutura completa de Reservas[] para conferência — cada item traz
    // seu próprio ValorPendenteParaPagamento (confirmado no XSD da WOOBA), mas
    // isso ainda não foi observado numa reserva real com múltiplas companhias.
    console.log('[RESERVAR] Reservas[] completo:', JSON.stringify(reservas))

    interface LocalizadorEntry {
      localizador: string; companhia: string | null; origem: string | null; destino: string | null
      trecho: 'ida' | 'volta'; valor: number | null; id: number
    }
    const localizadores: LocalizadorEntry[] = reservas.map((r: any, idx: number) => {
      const viagem = r.Viagens?.[0] ?? {}
      const origem = viagem.Origem?.CodigoIata ?? null
      const destino = viagem.Destino?.CodigoIata ?? null

      let trecho: 'ida' | 'volta' = idx === 0 ? 'ida' : 'volta'
      if (vooIda?.Origem?.CodigoIata === origem && vooIda?.Destino?.CodigoIata === destino) trecho = 'ida'
      else if (vooVolta?.Origem?.CodigoIata === origem && vooVolta?.Destino?.CodigoIata === destino) trecho = 'volta'

      return {
        localizador: r.Localizador,
        companhia: viagem.CiaMandatoria?.CodigoIata ?? null,
        origem,
        destino,
        trecho,
        valor: typeof r.ValorPendenteParaPagamento === 'number' ? r.ValorPendenteParaPagamento : null,
        id: r.Id,
      }
    })

    // Fallback: se a WOOBA não trouxe ValorPendenteParaPagamento em nenhum item,
    // usa os preços já conhecidos da seleção (Tarifar) por trecho; se nem isso
    // der pra casar, registra o valor cheio só no primeiro localizador.
    if (localizadores.every(l => l.valor == null)) {
      const precoIda   = vooIda?.Preco?.Total ?? 0
      const precoVolta = vooVolta?.Preco?.Total ?? 0
      let algumCasou = false
      for (const l of localizadores) {
        if (l.trecho === 'ida' && precoIda)   { l.valor = precoIda;   algumCasou = true }
        if (l.trecho === 'volta' && precoVolta) { l.valor = precoVolta; algumCasou = true }
      }
      if (!algumCasou && localizadores[0]) {
        localizadores[0].valor = precoIda + precoVolta
      }
    }

    console.log('[RESERVAR] Total de reservas:', reservas.length)
    console.log('[RESERVAR] Localizadores:', JSON.stringify(localizadores))

    // Mantém compatibilidade: localizador principal é o primeiro
    return NextResponse.json({
      localizador: localizadores[0].localizador,
      localizadores,
      totalReservas: reservas.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
