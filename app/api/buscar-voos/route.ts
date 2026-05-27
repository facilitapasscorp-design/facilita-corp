import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function toWcfDate(dateStr: string): string {
  const date = new Date(dateStr + 'T03:00:00.000Z') // meio-dia no BRT (-3h)
  return `/Date(${date.getTime()}-0300)/`
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

    // Passo 1: Recuperar sistemas disponíveis para o trecho
    const sistemasRes = await fetch(`${BASE_URL}/RecuperarSistemasPesquisa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...credenciais,
        Origem: origem,
        Destino: destino,
        Timeout: 15,
      }),
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

    // Passo 2: Buscar disponibilidade em todos os sistemas em paralelo
    const disponibilidades = await Promise.all(
      sistemasData.Sistemas.map((s: { Sistema: number }) =>
        fetch(`${BASE_URL}/Disponibilidade`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
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
            BuscarVoosComBagagem: true,
            BuscarVoosSemBagagem: true,
            Flex: false,
            Recomendacao: false,
          }),
        }).then(r => r.json())
      )
    )

    // Combina voos de todos os sistemas, ignorando os que retornaram erro
    const voosIda = disponibilidades.flatMap(d => {
      if (d.Exception || d.SessaoExpirada) return []
      return d.ViagensTrecho1 ?? []
    })
    const voosVolta = disponibilidades.flatMap(d => {
      if (d.Exception || d.SessaoExpirada) return []
      return d.ViagensTrecho2 ?? []
    })

    return NextResponse.json({ sistemas: sistemasData.Sistemas, voos: voosIda, voosVolta })

  } catch (error: unknown) {
    console.error('Erro WOOBA:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
