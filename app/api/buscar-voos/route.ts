import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

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
      // (FLEX na GOL, tarifa adicional na LATAM) sem custo de chamada extra —
      // confirmado empiricamente contra a API de produção da WOOBA.
      Flex: comBagagem,
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
    baseTarifaria:         typeof leg0.BaseTarifaria === 'string'     ? leg0.BaseTarifaria     : '',
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
      const jaExiste = entry.tarifas.some(t =>
        t.familia === tarifa.familia &&
        t.bagagemInclusa === tarifa.bagagemInclusa &&
        t.preco === tarifa.preco
      )
      if (!jaExiste) {
        entry.tarifas.push(tarifa)
        entry.tarifas.sort((a, b) => a.preco - b.preco)
      }
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
      companhia:   base.CiaMandatoria?.CodigoIata ?? '',
      numParadas:  (base.NumeroParadas as number) ?? 0,
      voos,
      tarifas,
    }
  })
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ erro: sistemasData.Exception.Message || 'Erro ao recuperar sistemas' }, { status: 400 })
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

    // Duas chamadas por sistema: sem e com bagagem (restaura STANDARD da LATAM)
    const inicioDisponibilidade = Date.now()
    const todasRespostas = await Promise.all(
      sistemasData.Sistemas.flatMap((s: { Sistema: number }) => [
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), false, s.Sistema),
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), true,  s.Sistema),
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

    const voosIda   = extrairViagens('ViagensTrecho1')
    const voosVolta = extrairViagens('ViagensTrecho2')
    const grupos      = agruparViagens(voosIda)
    const gruposVolta = agruparViagens(voosVolta)

    console.log(`[BUSCAR-VOOS] voosIda=${voosIda.length} voosVolta=${voosVolta.length} grupos=${grupos.length} gruposVolta=${gruposVolta.length}`)
    console.log(`[BUSCAR-VOOS] tempo total: ${Date.now() - inicioTotal}ms`)

    return NextResponse.json({ sistemas: sistemasData.Sistemas, grupos, gruposVolta })

  } catch (error: unknown) {
    console.error('Erro WOOBA:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
