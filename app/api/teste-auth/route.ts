import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const URL_SOAP = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/soap'
const SOAP_ACTION = 'http://tempuri.org/IAereoNoSession/RecuperarSistemasPesquisa'

export async function POST() {
  const token = process.env.WOOBA_TOKEN!
  const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
  const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
  const accessCode = gerarAccessCode()

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
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

  console.log('[TESTE-SOAP] URL:', URL_SOAP)
  console.log('[TESTE-SOAP] SOAPAction:', SOAP_ACTION)
  console.log('[TESTE-SOAP] envelope:', envelope)

  try {
    const res = await fetch(URL_SOAP, {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`,
        'Developer-Token': token,
        'Developer-Access-Code': accessCode,
      },
      body: envelope,
    })

    const raw = await res.text()
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })

    console.log('[TESTE-SOAP] status:', res.status)
    console.log('[TESTE-SOAP] raw:', raw.slice(0, 1000))

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      raw,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[TESTE-SOAP] erro:', message)
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
