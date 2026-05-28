import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc'

async function chamar(label: string, url: string, options: RequestInit) {
  try {
    const res = await fetch(url, options)
    const raw = await res.text()
    console.log(`[TESTE-AUTH] ${label} → ${res.status} | ${raw.slice(0, 200)}`)
    return { label, url, status: res.status, statusText: res.statusText, preview: raw.slice(0, 1000) }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`[TESTE-AUTH] ${label} → erro: ${message}`)
    return { label, url, erro: message }
  }
}

export async function POST() {
  const token = process.env.WOOBA_TOKEN!
  const accessCode = gerarAccessCode()

  const headersAuth = {
    'Accept': 'application/json',
    'Developer-Token': token,
    'Developer-Access-Code': accessCode,
  }

  const resultados = await Promise.all([
    chamar('GET ?disco', `${BASE}?disco`, { method: 'GET' }),
    chamar('GET ?wsdl', `${BASE}?wsdl`, { method: 'GET' }),
    chamar('GET RecuperarSistemasPesquisa', `${BASE}/RecuperarSistemasPesquisa`, { method: 'GET', headers: headersAuth }),
  ])

  return NextResponse.json({ resultados })
}
