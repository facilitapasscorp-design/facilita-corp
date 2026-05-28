import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const URLS = [
  'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/RecuperarSistemasPesquisa',
  'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/recuperarSistemasPesquisa',
  'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc',
]

async function chamar(url: string, headers: Record<string, string>, body: string) {
  try {
    const res = await fetch(url, { method: 'POST', headers, body })
    const raw = await res.text()
    console.log(`[TESTE-AUTH] ${url} → ${res.status} | ${raw.slice(0, 200)}`)
    return { url, status: res.status, statusText: res.statusText, preview: raw.slice(0, 500) }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`[TESTE-AUTH] ${url} → erro: ${message}`)
    return { url, erro: message }
  }
}

export async function POST() {
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

  const body = JSON.stringify({ Login: login, Senha: senha, Origem: 'GRU', Destino: 'CGH', Timeout: 10 })

  const resultados = await Promise.all(URLS.map(url => chamar(url, headers, body)))

  return NextResponse.json({ resultados })
}
