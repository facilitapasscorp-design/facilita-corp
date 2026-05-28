import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const URL_SOAP = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc/soap'
const NS_TEMPURI = 'http://tempuri.org/'
const NS_CLASSES = 'http://schemas.datacontract.org/2004/07/TravellinkEngine.Classes'
const NS_REQUEST = 'http://schemas.datacontract.org/2004/07/TravellinkEngine.Classes.Aereo.Request'

function soapHeaders(token: string, accessCode: string, action: string) {
  return {
    'Content-Type': `application/soap+xml; charset=utf-8; action="${NS_TEMPURI}IAereoNoSession/${action}"`,
    'Developer-Token': token,
    'Developer-Access-Code': accessCode,
  }
}

function envelopeAutenticar(login: string, senha: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <AutenticarComUsuario xmlns="${NS_TEMPURI}">
      <request xmlns:i="http://www.w3.org/2001/XMLSchema-instance"
               xmlns="${NS_CLASSES}">
        <Login>${login}</Login>
        <Senha>${senha}</Senha>
      </request>
    </AutenticarComUsuario>
  </soap12:Body>
</soap12:Envelope>`
}

function envelopeRecuperarSistemas(token: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <RecuperarSistemasPesquisa xmlns="${NS_TEMPURI}">
      <request xmlns:i="http://www.w3.org/2001/XMLSchema-instance"
               xmlns="${NS_REQUEST}">
        <TokenDeSeguranca xmlns="${NS_CLASSES}">${token}</TokenDeSeguranca>
        <Origem>GRU</Origem>
        <Destino>CGH</Destino>
      </request>
    </RecuperarSistemasPesquisa>
  </soap12:Body>
</soap12:Envelope>`
}

async function chamarSoap(label: string, envelope: string, headers: Record<string, string>) {
  try {
    console.log(`[BRT] ${label} →`, URL_SOAP)
    const res = await fetch(URL_SOAP, { method: 'POST', headers, body: envelope })
    const raw = await res.text()
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })
    console.log(`[BRT] ${label} status:`, res.status, '| raw:', raw.slice(0, 500))
    return { label, status: res.status, statusText: res.statusText, responseHeaders: resHeaders, raw }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error(`[BRT] ${label} erro:`, message)
    return { label, erro: message }
  }
}

export async function POST() {
  const devToken = process.env.WOOBA_TOKEN!
  const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
  const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
  const accessCode = gerarAccessCode()

  // Etapa 1: autenticar
  const etapa1 = await chamarSoap(
    'Etapa 1 — AutenticarComUsuario',
    envelopeAutenticar(login, senha),
    soapHeaders(devToken, accessCode, 'AutenticarComUsuario'),
  )

  // Tenta extrair token da resposta
  let sessionToken = ''
  if (etapa1.raw) {
    const match = etapa1.raw.match(/<Token[^>]*>([^<]+)<\/Token>/)
    if (match) sessionToken = match[1]
  }
  console.log('[BRT] Token extraído:', sessionToken || '(não encontrado)')

  // Etapa 2: RecuperarSistemasPesquisa com o token
  const etapa2 = await chamarSoap(
    'Etapa 2 — RecuperarSistemasPesquisa',
    envelopeRecuperarSistemas(sessionToken),
    soapHeaders(devToken, gerarAccessCode(), 'RecuperarSistemasPesquisa'),
  )

  return NextResponse.json({ etapa1, tokenExtraido: sessionToken || null, etapa2 })
}
