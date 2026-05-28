import { NextResponse } from 'next/server'

const URLS_XSD = [
  'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc?xsd=xsd0',
  'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc?xsd=xsd1',
  'http://wsbrt.brtcorp.com.br/WCF/wcfTravellinkJSON/AereoNoSession.svc?xsd=xsd3',
]

function extrairTiposRelevantes(xsd: string): string[] {
  const palavras = ['DefaultRQ', 'RecuperarSistemasPesquisa', 'Login', 'Senha', 'Timeout', 'complexType', 'element']
  return xsd
    .split(/(?=<xs:complexType|<xs:element|<xs:simpleType)/)
    .filter(bloco => palavras.some(p => bloco.includes(p)))
    .map(b => b.trim().slice(0, 800))
}

async function buscarXsd(url: string) {
  try {
    const res = await fetch(url, { method: 'GET' })
    const raw = await res.text()
    return {
      url,
      status: res.status,
      totalChars: raw.length,
      blocos: extrairTiposRelevantes(raw),
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { url, erro: message }
  }
}

export async function POST() {
  const resultados = await Promise.all(URLS_XSD.map(buscarXsd))
  return NextResponse.json({ resultados })
}
