import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const URL_BRT = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/RecuperarSistemasPesquisa'

export async function GET() {
  try {
    const token = process.env.WOOBA_TOKEN!
    const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
    const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
    const accessCode = gerarAccessCode()

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Developer-Token': token,
      'Developer-Access-Code': accessCode,
    }

    console.log('[TESTE-AUTH] URL:', URL_BRT)
    console.log('[TESTE-AUTH] Developer-Token:', token)
    console.log('[TESTE-AUTH] Developer-Access-Code:', accessCode.slice(0, 40) + '...')

    const res = await fetch(URL_BRT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        Login: login,
        Senha: senha,
        Origem: 'GRU',
        Destino: 'CGH',
        Timeout: 10,
      }),
    })

    const raw = await res.text()
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => { resHeaders[key] = value })

    console.log('[TESTE-AUTH] status:', res.status)
    console.log('[TESTE-AUTH] raw:', raw.slice(0, 1000))

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      preview: raw.slice(0, 1000),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[TESTE-AUTH] erro:', message)
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
