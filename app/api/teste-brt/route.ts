import { NextResponse } from 'next/server'

const URL_BRT = 'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc'

export async function GET() {
  try {
    const res = await fetch(URL_BRT, { method: 'GET' })
    const raw = await res.text()
    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      preview: raw.slice(0, 500),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
