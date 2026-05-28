import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const URL_SOAP = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/soap'
const SOAP_ACTION = 'http://tempuri.org/IAereoNoSession/RecuperarSistemasPesquisa'
const URL_XSD6 = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc?xsd=xsd6'

function envelope12(login: string, senha: string) {
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

function envelope11(login: string, senha: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RecuperarSistemasPesquisa xmlns="http://tempuri.org/">
      <Login>${login}</Login>
      <Senha>${senha}</Senha>
      <Origem>GRU</Origem>
      <Destino>CGH</Destino>
      <Timeout>10</Timeout>
    </RecuperarSistemasPesquisa>
  </soap:Body>
</soap:Envelope>`
}

async function chamar(label: string, url: string, options: RequestInit) {
  try {
    const res = await fetch(url, options)
    const raw = await res.text()
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })
    console.log(`[TESTE-SOAP] ${label} → ${res.status} | ${raw.slice(0, 300)}`)
    return { label, status: res.status, statusText: res.statusText, responseHeaders: resHeaders, raw }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { label, erro: message }
  }
}

export async function POST() {
  const token = process.env.WOOBA_TOKEN!
  const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
  const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
  const accessCode = gerarAccessCode()

  const authHeaders = {
    'Developer-Token': token,
    'Developer-Access-Code': accessCode,
  }

  const [soap12SemAction, soap11, xsd6] = await Promise.all([
    chamar('SOAP 1.2 sem action no Content-Type', URL_SOAP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        ...authHeaders,
      },
      body: envelope12(login, senha),
    }),
    chamar('SOAP 1.1 com SOAPAction header', URL_SOAP, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"${SOAP_ACTION}"`,
        ...authHeaders,
      },
      body: envelope11(login, senha),
    }),
    chamar('XSD6 - estrutura do request', URL_XSD6, {
      method: 'GET',
    }),
  ])

  return NextResponse.json({ soap12SemAction, soap11, xsd6 })
}
