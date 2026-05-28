import { NextResponse } from 'next/server'

const WSDL_URL = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc?wsdl'

export async function POST() {
  try {
    const res = await fetch(WSDL_URL, { method: 'GET' })
    const raw = await res.text()

    const palavrasChave = ['address', 'endpoint', 'location', 'binding']
    const linhasRelevantes = raw
      .split(/>\s*</)
      .map(l => l.trim())
      .filter(l => palavrasChave.some(p => l.toLowerCase().includes(p)))
      .map(l => '<' + l + '>')

    return NextResponse.json({
      status: res.status,
      totalChars: raw.length,
      linhasRelevantes,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
