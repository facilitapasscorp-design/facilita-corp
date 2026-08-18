import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'
import { mensagemAmigavel } from '../../../lib/erros-wooba'
import { autenticar, ehErro } from '../../../lib/auth-api'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function toWcfDate(dateStr: string): string {
  const date = new Date(dateStr + 'T03:00:00.000Z')
  return `/Date(${date.getTime()}-0300)/`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Viagem = Record<string, any>
type Resposta = { data: Record<string, unknown>; comBagagem: boolean; sistema: number }

async function buscarDisponibilidade(
  url: string,
  headers: Record<string, string>,
  params: Record<string, unknown>,
  comBagagem: boolean,
  sistema: number,
  idavolta: boolean,
): Promise<Resposta> {
  const inicio = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      BuscarVoosComBagagem: comBagagem,
      BuscarVoosSemBagagem: !comBagagem,
      // Flex:true na chamada com bagagem desbloqueia a família mais flexível
      // (FLEX na GOL, tarifa adicional na LATAM na LATAM: FULL) — mas confirmado
      // empiricamente (via testes cruzados 3 sistemas x 2 datas) que Flex:true
      // combinado com DataVolta zera ViagensTrecho2 em 100% dos casos. Por isso
      // só habilitamos Flex em buscas de só ida; em idavolta ficamos em
      // BuscarVoosComBagagem sem Flex, que traz STANDARD/CLASSIC nos dois
      // trechos (perdendo FULL/FLEX, mas mantendo a volta funcional).
      Flex: comBagagem && !idavolta,
    }),
  })
  const data = await res.json()
  console.log(`[BUSCAR-VOOS] Disponibilidade sistema=${sistema} bagagem=${comBagagem}: ${Date.now() - inicio}ms`)
  return { data, comBagagem, sistema }
}

function normalizarCia(iata: string): string {
  return iata === 'JJ' ? 'LA' : iata
}

function chaveVoo(v: Viagem): string {
  const voos: Viagem[] = v.Voos ?? []
  const first = voos[0] ?? {}
  const last  = voos[voos.length - 1] ?? first
  const cia   = normalizarCia(v.CiaMandatoria?.CodigoIata ?? '')
  const numeros = voos.map(leg => leg.Numero || leg.NumeroDoVoo || '').join('+')
  const hora    = first.HoraSaida ?? 0
  const aeroportos = [
    first.Origem?.CodigoIata ?? '',
    ...voos.slice(1).map((leg: Viagem) => leg.Origem?.CodigoIata ?? ''),
    last.Destino?.CodigoIata ?? '',
  ].join('-')
  return `${cia}-${numeros}-${hora}-${aeroportos}`
}

/** Código da base tarifária (M9, W9...) — o que diferencia duas tarifas de mesmo nome. */
function codigoBase(v: Viagem): string {
  const bt = v?.BaseTarifaria
  if (typeof bt === 'string') return bt
  if (Array.isArray(bt)) return (bt[0] as { Codigo?: string } | undefined)?.Codigo ?? ''
  return ''
}

function nomeFamilia(v: Viagem): string {
  if (v.Familia)       return v.Familia as string
  if (v.FamiliaCodigo) return v.FamiliaCodigo as string
  const leg = (v.Voos ?? [])[0] ?? {}
  if (leg.Familia)       return leg.Familia as string
  if (leg.FamiliaCodigo) return leg.FamiliaCodigo as string
  return ''
}

interface Tarifa {
  familia: string
  familiaCodigo: string
  preco: number
  bagagemInclusa: boolean
  bagagemPeso: number | null
  bagagemQuantidade: number | null
  baseTarifaria: string
  classe: string
  identificacaoDaViagem: string
  viagem: Viagem
}

function criarTarifa(v: Viagem): Tarifa {
  const leg0: Viagem = (v.Voos ?? [])[0] ?? {}

  const bagagemInclusa =
    leg0.BagagemInclusa != null ? leg0.BagagemInclusa :
    v.BagagemInclusa    != null ? v.BagagemInclusa    : false

  return {
    familia:               nomeFamilia(v),
    familiaCodigo:         typeof leg0.FamiliaCodigo === 'string' ? leg0.FamiliaCodigo : (typeof v.FamiliaCodigo === 'string' ? v.FamiliaCodigo : ''),
    preco:                 v.Preco?.Total              ?? 0,
    bagagemInclusa,
    bagagemPeso:           typeof leg0.BagagemPeso === 'number'      ? leg0.BagagemPeso       : null,
    bagagemQuantidade:     typeof leg0.BagagemQuantidade === 'number' ? leg0.BagagemQuantidade : null,
    // BaseTarifaria vem como array de objetos ({ Codigo, Familia, ... }),
    // nunca como string — o teste antigo por `typeof === 'string'` nunca era
    // verdadeiro e este campo ficava sempre vazio.
    baseTarifaria:         codigoBase(leg0) || codigoBase(v),
    classe:                typeof leg0.Classe === 'string'            ? leg0.Classe            : (typeof leg0.Cabine === 'string' ? leg0.Cabine : ''),
    identificacaoDaViagem: v.IdentificacaoDaViagem    ?? '',
    viagem:                v,
  }
}

function agruparViagens(viagens: Viagem[]) {
  const mapa = new Map<string, { base: Viagem; tarifas: Tarifa[] }>()

  for (const v of viagens) {
    const chave  = chaveVoo(v)
    const tarifa = criarTarifa(v)

    const entry = mapa.get(chave)
    if (entry) {
      // Uma linha por família + bagagem, ficando com a mais barata.
      //
      // O mesmo voo volta de mais de um fornecedor (a LATAM aparece via NDC
      // LATAM e via GDS, com ~R$50 de diferença). Antes cada uma virava um
      // botão, e o cliente via "LIGHT / LIGHT / STANDARD / STANDARD" sem
      // nenhuma explicação — parecia defeito. São o mesmo assento; mostrar
      // duas vezes só transfere pro comprador uma escolha que ele não tem
      // como fazer.
      const chaveTarifa = (t: Tarifa) => `${t.familia}|${t.bagagemInclusa}`
      const idx = entry.tarifas.findIndex(t => chaveTarifa(t) === chaveTarifa(tarifa))
      if (idx === -1) {
        entry.tarifas.push(tarifa)
      } else if (tarifa.preco < entry.tarifas[idx].preco) {
        entry.tarifas[idx] = tarifa
      }
      entry.tarifas.sort((a, b) => a.preco - b.preco)
    } else {
      mapa.set(chave, { base: v, tarifas: [tarifa] })
    }
  }

  return Array.from(mapa.values()).map(({ base, tarifas }) => {
    const voos: Viagem[] = base.Voos ?? []
    const leg0 = voos[0] ?? {}
    const legN = voos[voos.length - 1] ?? leg0
    const num  = leg0.Numero || leg0.NumeroDoVoo

    return {
      id:          chaveVoo(base),
      numeroVoo:   num ? String(num) : '',
      origem:      base.Origem?.CodigoIata  ?? '',
      destino:     base.Destino?.CodigoIata ?? '',
      horaSaida:   (leg0.HoraSaida  as number) ?? 0,
      horaChegada: (legN.HoraChegada as number) ?? 0,
      duracao:     (base.TempoDeDuracao as string) ?? '',
      // normalizarCia (JJ -> LA) já era usado na chave de agrupamento, mas não
      // aqui — então a LATAM aparecia duas vezes na barra de filtros, com o
      // mesmo nome e o mesmo logo, parecendo defeito.
      companhia:   normalizarCia(base.CiaMandatoria?.CodigoIata ?? ''),
      numParadas:  (base.NumeroParadas as number) ?? 0,
      icone:       typeof leg0.Icone === 'string' ? leg0.Icone : null,
      voos,
      tarifas,
    }
  })
}

export async function POST(request: NextRequest) {
  const ctx = await autenticar(request)
  if (ehErro(ctx)) return ctx

  const inicioTotal = Date.now()
  try {
    const body = await request.json()
    const { origem, destino, dataIda, dataVolta, adultos = 1, criancas = 0, bebes = 0, tipo } = body

    console.log(`[BUSCAR-VOOS] origem recebida: "${origem}" | destino recebido: "${destino}"`)

    const BASE_URL   = process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX
    const login      = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
    const senha      = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
    const token      = process.env.WOOBA_TOKEN!
    const accessCode = gerarAccessCode()

    const headers = {
      'Content-Type':          'application/json',
      'Accept':                'application/json',
      'Developer-Token':       token,
      'Developer-Access-Code': accessCode,
    }

    const credenciais = { Login: login, Senha: senha }

    const inicioSistemas = Date.now()
    const sistemasRes  = await fetch(`${BASE_URL}/RecuperarSistemasPesquisa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...credenciais, Origem: origem, Destino: destino, Timeout: 15 }),
    })
    const sistemasData = await sistemasRes.json()
    console.log(`[BUSCAR-VOOS] RecuperarSistemasPesquisa: ${Date.now() - inicioSistemas}ms | ${sistemasData.Sistemas?.length ?? 0} sistemas`)

    if (sistemasData.SessaoExpirada) {
      return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
    }
    if (sistemasData.Exception) {
      console.error('[BUSCAR-VOOS] Exception:', sistemasData.Exception.Message)
      return NextResponse.json({ erro: mensagemAmigavel(sistemasData.Exception.Message) }, { status: 400 })
    }
    if (!sistemasData.Sistemas?.length) {
      return NextResponse.json({ erro: 'Nenhum sistema disponível para este trecho' }, { status: 404 })
    }

    const urlDisponibilidade = `${BASE_URL}/Disponibilidade`

    const baseParams = (s: { Sistema: number }) => ({
      ...credenciais,
      Origem: origem,
      Destino: destino,
      DataIda: toWcfDate(dataIda),
      ...(tipo === 'idavolta' && dataVolta ? { DataVolta: toWcfDate(dataVolta) } : {}),
      QuantidadeAdultos:  adultos,
      QuantidadeCriancas: criancas,
      QuantidadeBebes:    bebes,
      QuantidadeDeVoos:   50,
      Sistema:            s.Sistema,
      ApenasVoosComBagagem: false,
      ApenasVoosDiretos:    false,
      Recomendacao:         false,
    })

    const idavolta = tipo === 'idavolta' && !!dataVolta

    // Duas chamadas por sistema: sem e com bagagem (restaura STANDARD da LATAM)
    const inicioDisponibilidade = Date.now()
    const todasRespostas = await Promise.all(
      sistemasData.Sistemas.flatMap((s: { Sistema: number }) => [
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), false, s.Sistema, idavolta),
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), true,  s.Sistema, idavolta),
      ])
    )
    console.log(`[BUSCAR-VOOS] Disponibilidade total (${todasRespostas.length} chamadas paralelas): ${Date.now() - inicioDisponibilidade}ms`)

    function extrairViagens(campo: 'ViagensTrecho1' | 'ViagensTrecho2'): Viagem[] {
      return todasRespostas.flatMap(({ data: d, comBagagem }) => {
        if (d.Exception || d.SessaoExpirada) return []
        const viagens = (d[campo] as Viagem[] | null) ?? []
        return viagens.map(v => ({ ...v, BagagemInclusa: v.BagagemInclusa ?? comBagagem }))
      })
    }


    // Um sistema só conta como falho se NENHUMA das suas duas chamadas (com e
    // sem bagagem) respondeu. Antes, uma falha era engolida em silêncio: o
    // cliente via a lista sem a Azul e concluía que não havia voo da Azul.
    // Nem toda Exception é problema. Numa busca doméstica a WOOBA consulta
    // ~15 sistemas — incluindo TAP e Copa, que não operam GRU-GIG — e dez
    // deles recusam SEMPRE, com uma destas duas mensagens de rotina. Tratar
    // isso como falha faria o aviso aparecer em toda busca; aviso que sempre
    // aparece ninguém lê, e ainda faz uma busca saudável parecer quebrada.
    const EXCECOES_ROTINEIRAS = [
      /nenhum sistema encontrado/i,   // o fornecedor não atende esta rota
      /nenhuma disponibilidade/i,     // atende, mas não tem voo nestas datas
      /nenhum voo/i,
    ]
    const ehFalhaReal = (d: { SessaoExpirada?: boolean; Exception?: { Message?: string } } | undefined) => {
      if (d?.SessaoExpirada) return true
      const msg = d?.Exception?.Message ?? ''
      if (!msg) return false
      return !EXCECOES_ROTINEIRAS.some(padrao => padrao.test(msg))
    }

    const respondeu    = new Set<number>()
    const comFalhaReal = new Set<number>()
    for (const r of todasRespostas) {
      if (ehFalhaReal(r.data)) comFalhaReal.add(r.sistema)
      else if (!r.data?.Exception) respondeu.add(r.sistema)
    }
    const semResposta = [...comFalhaReal].filter(s => !respondeu.has(s))
    const avisos: string[] = []
    if (semResposta.length) {
      console.warn('[BUSCAR-VOOS] FALHA REAL nos sistemas:', semResposta.join(', '))
      avisos.push('Algumas companhias não responderam nesta busca, então a lista pode estar incompleta. Se não achar o voo que procura, tente buscar de novo em instantes.')
    }

    const voosIda   = extrairViagens('ViagensTrecho1')
    const voosVolta = extrairViagens('ViagensTrecho2')
    const grupos      = agruparViagens(voosIda)
    const gruposVolta = agruparViagens(voosVolta)

    console.log(`[BUSCAR-VOOS] voosIda=${voosIda.length} voosVolta=${voosVolta.length} grupos=${grupos.length} gruposVolta=${gruposVolta.length}`)
    console.log(`[BUSCAR-VOOS] tempo total: ${Date.now() - inicioTotal}ms`)

    return NextResponse.json({ sistemas: sistemasData.Sistemas, grupos, gruposVolta, avisos })

  } catch (error: unknown) {
    console.error('Erro WOOBA:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
