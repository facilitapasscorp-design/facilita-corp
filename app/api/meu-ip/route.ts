import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json()
    return NextResponse.json({ ip: data.ip })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ erro: message }, { status: 500 })
  }
}
