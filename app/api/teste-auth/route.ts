import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const URL_BRT = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/RecuperarSistemasPesquisa'

const BODY = JSON.stringify({
  Login: process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN,
  Senha: process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA,
  Origem: 'GRU',
  Destino: 'CGH',
  Timeout: 10,
})

async function chamar(headers: Record<string, string>, label: string) {
  try {
    console.log(`[TESTE-AUTH] ${label} headers:`, Object.keys(headers))
    const res = await fetch(URL_BRT, { method: 'POST', headers, body: BODY })
    const raw = await res.text()
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })
    console.log(`[TESTE-AUTH] ${label} status:`, res.status, '| raw:', raw.slice(0, 500))
    return { status: res.status, statusText: res.statusText, headers: resHeaders, preview: raw.slice(0, 1000) }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`[TESTE-AUTH] ${label} erro:`, message)
    return { erro: message }
  }
}

export async function POST() {
  const token = process.env.WOOBA_TOKEN!
  const accessCode = gerarAccessCode()

  const headersCompletos = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Developer-Token': token,
    'Developer-Access-Code': accessCode,
  }

  const headersSemAccessCode = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Developer-Token': token,
  }

  const [comAccessCode, semAccessCode] = await Promise.all([
    chamar(headersCompletos, 'COM Developer-Access-Code'),
    chamar(headersSemAccessCode, 'SEM Developer-Access-Code'),
  ])

  return NextResponse.json({ comAccessCode, semAccessCode })
}
