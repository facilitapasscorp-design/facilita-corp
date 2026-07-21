import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

export async function POST(req: NextRequest) {
  try {
    const { localizador, para } = await req.json()
    if (!localizador) return NextResponse.json({ erro: 'Localizador é obrigatório' }, { status: 400 })
    if (!para)         return NextResponse.json({ erro: 'E-mail de destino é obrigatório' }, { status: 400 })

    const BASE  = process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX
    const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
    const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
    const token = process.env.WOOBA_TOKEN!
    const cred  = { Login: login, Senha: senha }

    const headers = () => ({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Developer-Token': token,
      'Developer-Access-Code': gerarAccessCode(),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await fetch(`${BASE}/EnviarComprovanteDeEmissao`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        ...cred,
        Localizador: localizador,
        Para: para,
        DesejoReceberUmaCopia: false,
        EnviarRegrasTarifarias: false,
      }),
    }).then(r => r.json())

    if (data.Exception) {
      return NextResponse.json({ erro: data.Exception.Message }, { status: 400 })
    }
    if (!data.Sucesso) {
      return NextResponse.json({ erro: 'A WOOBA não confirmou o envio do comprovante.' }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
