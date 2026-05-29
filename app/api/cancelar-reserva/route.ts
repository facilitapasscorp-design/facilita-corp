import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

export async function POST(req: NextRequest) {
  try {
    const { localizador } = await req.json()
    if (!localizador) {
      return NextResponse.json({ erro: 'Localizador obrigatório' }, { status: 400 })
    }

    const BASE  = process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX
    const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
    const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
    const token = process.env.WOOBA_TOKEN!

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Developer-Token': token,
      'Developer-Access-Code': gerarAccessCode(),
    }

    const body = JSON.stringify({
      Login: login,
      Senha: senha,
      ClienteId: 0,
      Localizador: localizador,
    })

    const res  = await fetch(`${BASE}/Cancelar`, { method: 'POST', headers, body })
    const data = await res.json()

    console.log('[CANCELAR] Localizador:', localizador, '| Exception:', data.Exception?.Message ?? null)

    if (data.Exception) {
      return NextResponse.json({ erro: data.Exception.Message }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
