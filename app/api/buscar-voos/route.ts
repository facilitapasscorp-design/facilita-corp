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
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      BuscarVoosComBagagem: comBagagem,
      BuscarVoosSemBagagem: !comBagagem,
    }),
  })
  return { data: await res.json(), comBagagem, sistema }
}

function normalizarCia(iata: string): string {
  return iata === 'JJ' ? 'LA' : iata
}

function chaveVoo(v: Viagem): string {
  const voos: Viagem[] = v.Voos ?? []
  const first = voos[0] ?? {}
  const cia = normalizarCia(v.CiaMandatoria?.CodigoIata ?? '')
  const num = first.Numero || first.NumeroDoVoo || ''
  const hora = first.HoraSaida ?? 0
  return `${cia}-${num}-${hora}`
}

function nomeFamilia(v: Viagem): string {
  if (v.Familia)       return v.Familia as string
  if (v.FamiliaCodigo) return v.FamiliaCodigo as string
  const leg = (v.Voos ?? [])[0] ?? {}
  if (leg.Familia)       return leg.Familia as string
  if (leg.FamiliaCodigo) return leg.FamiliaCodigo as string
  return leg.BaseTarifaria ?? ''
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
    familiaCodigo:         leg0.FamiliaCodigo      ?? v.FamiliaCodigo ?? '',
    preco:                 v.Preco?.Total           ?? 0,
    bagagemInclusa,
    bagagemPeso:           leg0.BagagemPeso         ?? null,
    bagagemQuantidade:     leg0.BagagemQuantidade   ?? null,
    baseTarifaria: typeof leg0.BaseTarifaria === 'string' ? leg0.BaseTarifaria : '',
    classe:        typeof leg0.Classe === 'string' ? leg0.Classe : (typeof leg0.Cabine === 'string' ? leg0.Cabine : ''),
    identificacaoDaViagem: v.IdentificacaoDaViagem  ?? '',
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
      const jaExiste = entry.tarifas.some(t => {
        if (v.IdentificacaoDaViagem && t.identificacaoDaViagem === v.IdentificacaoDaViagem) return true
        if (v.Id && t.viagem.Id === v.Id) return true
        if (tarifa.baseTarifaria && t.baseTarifaria) return t.baseTarifaria === tarifa.baseTarifaria && t.bagagemInclusa === tarifa.bagagemInclusa
        return t.familia === tarifa.familia && t.bagagemInclusa === tarifa.bagagemInclusa
      })
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
      id:          base.IdentificacaoDaViagem ?? chaveVoo(base),
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
  try {
    const body = await request.json()
    const { origem, destino, dataIda, dataVolta, adultos = 1, criancas = 0, bebes = 0, tipo } = body

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

    const sistemasRes  = await fetch(`${BASE_URL}/RecuperarSistemasPesquisa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...credenciais, Origem: origem, Destino: destino, Timeout: 15 }),
    })
    const sistemasData = await sistemasRes.json()

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
      Flex:                 false,
      Recomendacao:         false,
    })

    const todasRespostas = await Promise.all(
      sistemasData.Sistemas.flatMap((s: { Sistema: number }) => [
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), false, s.Sistema),
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), true,  s.Sistema),
      ])
    )

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

    return NextResponse.json({ sistemas: sistemasData.Sistemas, grupos, gruposVolta })

  } catch (error: unknown) {
    console.error('Erro WOOBA:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
