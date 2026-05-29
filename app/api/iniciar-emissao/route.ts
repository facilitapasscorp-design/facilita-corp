import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

export async function POST(req: NextRequest) {
  try {
    const { localizador } = await req.json()

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

    // 1. IniciarEmissao
    const inicioData = await fetch(`${BASE}/IniciarEmissao`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ ...cred, ClienteId: 0, Localizador: localizador }),
    }).then(r => r.json())

    if (inicioData.Exception) {
      return NextResponse.json({ erro: inicioData.Exception.Message }, { status: 400 })
    }

    const chaveDeSeguranca = inicioData.ChaveDeSeguranca || null
    const opcoesPagamento: any[] = inicioData.ConfiguracoesDeEmissao?.OpcoesDePagamento || []

    // Sempre usa cartão de crédito (FormaDePagamento: 2)
    const opcao = opcoesPagamento.find((o: any) => o.CartaoDeCredito === true)
      || opcoesPagamento[0]
    const codigoPagamento = opcao?.CodigoFormaDeRecebimento ?? 2

    // 2. RecuperarFormasDeFinanciamento — obtém opções de parcelamento
    let formasFinanciamento: any[] = []
    try {
      const formasData = await fetch(`${BASE}/RecuperarFormasDeFinanciamento`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ ...cred, ClienteId: 0, Localizador: localizador }),
      }).then(r => r.json())
      if (!formasData.Exception) {
        formasFinanciamento = formasData.FormasDeFinanciamento ?? []
      }
    } catch {}

    return NextResponse.json({ chaveDeSeguranca, codigoPagamento, formasFinanciamento })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
