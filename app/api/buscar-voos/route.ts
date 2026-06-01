import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function toWcfDate(dateStr: string): string {
  const date = new Date(dateStr + 'T03:00:00.000Z')
  return `/Date(${date.getTime()}-0300)/`
}

async function buscarDisponibilidade(
  url: string,
  headers: Record<string, string>,
  params: Record<string, unknown>,
  comBagagem: boolean,
  sistema: number,
): Promise<{ data: Record<string, unknown>; comBagagem: boolean; sistema: number }> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      BuscarVoosComBagagem: comBagagem,
      BuscarVoosSemBagagem: !comBagagem,
    }),
  })
  const data = await res.json()
  return { data, comBagagem, sistema }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { origem, destino, dataIda, dataVolta, adultos = 1, criancas = 0, bebes = 0, tipo } = body

    const BASE_URL = process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX
    const login   = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
    const senha   = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
    const token   = process.env.WOOBA_TOKEN!
    const accessCode = gerarAccessCode()

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Developer-Token': token,
      'Developer-Access-Code': accessCode,
    }

    const credenciais = { Login: login, Senha: senha }

    const urlSistemas = `${BASE_URL}/RecuperarSistemasPesquisa`
    const sistemasRes = await fetch(urlSistemas, {
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

    // Para cada sistema, faz DUAS chamadas em paralelo:
    // uma buscando só sem bagagem, outra só com bagagem.
    // Isso garante que ambas as famílias tarifárias cheguem,
    // já que o limite de 50 resultados por chamada priorizaria
    // sempre a opção mais barata (sem bagagem) se buscássemos tudo junto.
    const baseParams = (s: { Sistema: number }) => ({
      ...credenciais,
      Origem: origem,
      Destino: destino,
      DataIda: toWcfDate(dataIda),
      ...(tipo === 'idavolta' && dataVolta ? { DataVolta: toWcfDate(dataVolta) } : {}),
      QuantidadeAdultos: adultos,
      QuantidadeCriancas: criancas,
      QuantidadeBebes: bebes,
      QuantidadeDeVoos: 50,
      Sistema: s.Sistema,
      ApenasVoosComBagagem: false,
      ApenasVoosDiretos: false,
      Flex: false,
      Recomendacao: false,
    })

    const todasRespostas = await Promise.all(
      sistemasData.Sistemas.flatMap((s: { Sistema: number }) => [
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), false, s.Sistema),
        buscarDisponibilidade(urlDisponibilidade, headers, baseParams(s), true,  s.Sistema),
      ])
    )

    type Viagem = Record<string, unknown>
    type Resposta = { data: Record<string, unknown>; comBagagem: boolean; sistema: number }

    // Log diagnóstico por sistema — mostra o que cada chamada retornou
    let primeiraViagemLogada = false
    for (const { data: d, comBagagem, sistema } of todasRespostas) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const viagens: Viagem[] = (!d.Exception && !d.SessaoExpirada) ? ((d.ViagensTrecho1 as Viagem[]) ?? []) : []
      const v0 = viagens[0] as Record<string, unknown> | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const voo0 = (v0?.Voos as any[])?.[0] ?? {}
      console.log(
        `[DIAG] s=${sistema} com=${comBagagem} count=${viagens.length} err=${!!d.Exception}` +
        (v0 ? ` | viagemKeys=${Object.keys(v0).join(',')}` : '') +
        (v0 ? ` | voo0Keys=${Object.keys(voo0).join(',')}` : '') +
        (v0 ? ` | v.BagInclusa=${v0.BagagemInclusa} voo.BagInclusa=${voo0.BagagemInclusa}` : '') +
        (v0 ? ` | v.Familia=${v0.Familia} voo.Familia=${voo0.Familia} voo.FamiliaCodigo=${voo0.FamiliaCodigo}` : '')
      )

      // [TEMP] Log completo do primeiro voo encontrado — para mapear todos os campos disponíveis
      if (v0 && !primeiraViagemLogada) {
        primeiraViagemLogada = true
        console.log(`[TEMP-FULL-VIAGEM] s=${sistema} com=${comBagagem}`)
        console.log('[TEMP-FULL-VIAGEM] ViagensTrecho1[0]:', JSON.stringify(v0, null, 2))
      }
    }

    function extrairViagens(respostas: Resposta[], campo: 'ViagensTrecho1' | 'ViagensTrecho2'): Viagem[] {
      return respostas.flatMap(({ data: d, comBagagem }) => {
        if (d.Exception || d.SessaoExpirada) return []
        const viagens = (d[campo] as Viagem[] | null) ?? []
        return viagens.map(v => ({
          ...v,
          BagagemInclusa: (v.BagagemInclusa as boolean | undefined) ?? comBagagem,
        }))
      })
    }

    const voosIda   = extrairViagens(todasRespostas, 'ViagensTrecho1')
    const voosVolta = extrairViagens(todasRespostas, 'ViagensTrecho2')

    console.log(`[BUSCAR-VOOS] Total voosIda: ${voosIda.length} | voosVolta: ${voosVolta.length}`)

    return NextResponse.json({ sistemas: sistemasData.Sistemas, voos: voosIda, voosVolta })

  } catch (error: unknown) {
    console.error('Erro WOOBA:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
