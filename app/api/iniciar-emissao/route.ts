import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function detectarBandeira(numero: string): number {
  const n = numero.replace(/\D/g, '')
  if (/^4/.test(n))       return 1  // Visa
  if (/^5[1-5]/.test(n)) return 3  // Mastercard
  if (/^3[47]/.test(n))  return 2  // Amex
  return 1
}

function expandirValidade(val: string): string {
  const m = val.match(/^(\d{2})\/(\d{2})$/)
  return m ? `${m[1]}/20${m[2]}` : val
}

export async function POST(req: NextRequest) {
  try {
    const { localizador, cartao } = await req.json()
    // cartao?: { numero: string, validade?: string }

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

    let chaveDeSeguranca: string | null = null
    let codigoPagamento = 2

    // 1. IniciarEmissao — apenas na primeira chamada (sem cartão)
    //    Quando cartão é fornecido, o frontend já tem a chaveDeSeguranca da 1ª chamada
    if (!cartao?.numero) {
      const inicioData = await fetch(`${BASE}/IniciarEmissao`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ ...cred, ClienteId: 0, Localizador: localizador }),
      }).then(r => r.json())

      console.log('[INICIAR-EMISSAO] IniciarEmissao response:', JSON.stringify(inicioData, null, 2))

      if (inicioData.Exception) {
        return NextResponse.json({ erro: inicioData.Exception.Message }, { status: 400 })
      }

      chaveDeSeguranca = inicioData.ChaveDeSeguranca || null
      const opcoesPagamento: any[] = inicioData.ConfiguracoesDeEmissao?.OpcoesDePagamento || []
      const opcao = opcoesPagamento.find((o: any) => o.CartaoDeCredito === true) || opcoesPagamento[0]
      codigoPagamento = opcao?.CodigoFormaDeRecebimento ?? 2
    }

    // 2. RecuperarFormasDeFinanciamento — com dados do cartão quando disponíveis
    let formasFinanciamento: any[] = []
    try {
      const formasBody: any = { ...cred, ClienteId: 0, Localizador: localizador }
      if (cartao?.numero) {
        const num = cartao.numero.replace(/\D/g, '')
        formasBody.CartaoDeCredito = {
          Bandeira: detectarBandeira(num),
          Numero:   num,
          ...(cartao.validade ? { Validade: expandirValidade(cartao.validade) } : {}),
        }
      }

      const formasData = await fetch(`${BASE}/RecuperarFormasDeFinanciamento`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify(formasBody),
      }).then(r => r.json())

      console.log('[INICIAR-EMISSAO] RecuperarFormasDeFinanciamento response:', JSON.stringify(formasData, null, 2))

      // Campo correto na resposta da WOOBA é "Financiamentos", não "FormasDeFinanciamento"
      if (!formasData.Exception) {
        formasFinanciamento = formasData.Financiamentos ?? []
      }
    } catch {}

    return NextResponse.json({ chaveDeSeguranca, codigoPagamento, formasFinanciamento })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
