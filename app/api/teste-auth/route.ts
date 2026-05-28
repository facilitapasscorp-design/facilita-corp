import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const URL_SOAP = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/soap'
const SOAP_ACTION = 'http://tempuri.org/IAereoNoSession/RecuperarSistemasPesquisa'

function buildEnvelope(login: string, senha: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <RecuperarSistemasPesquisa xmlns="http://tempuri.org/">
      <Login>${login}</Login>
      <Senha>${senha}</Senha>
      <Origem>GRU</Origem>
      <Destino>CGH</Destino>
      <Timeout>10</Timeout>
    </RecuperarSistemasPesquisa>
  </soap12:Body>
</soap12:Envelope>`
}

async function chamar(label: string, headers: Record<string, string>, body: string) {
  try {
    const res = await fetch(URL_SOAP, { method: 'POST', headers, body })
    const raw = await res.text()
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })
    console.log(`[TESTE-SOAP] ${label} → ${res.status} | raw: ${raw.slice(0, 300)}`)
    return { label, status: res.status, statusText: res.statusText, responseHeaders: resHeaders, raw }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`[TESTE-SOAP] ${label} → erro: ${message}`)
    return { label, erro: message }
  }
}

export async function POST() {
  const token = process.env.WOOBA_TOKEN!
  const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
  const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
  const accessCode = gerarAccessCode()
  const envelope = buildEnvelope(login, senha)
  const contentType = `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`

  const [comAuth, semAuth] = await Promise.all([
    chamar('COM Developer-Token e Access-Code', {
      'Content-Type': contentType,
      'Developer-Token': token,
      'Developer-Access-Code': accessCode,
    }, envelope),
    chamar('SEM Developer-Token e Access-Code', {
      'Content-Type': contentType,
    }, envelope),
  ])

  return NextResponse.json({ comAuth, semAuth })
}
