import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function detectarBandeira(numero: string): number {
  const n = numero.replace(/\D/g, '')
  if (/^4/.test(n))        return 1  // Visa
  if (/^5[1-5]/.test(n))  return 3  // Mastercard
  if (/^3[47]/.test(n))   return 2  // Amex
  return 1
}

// Converte "MM/AA" (máscara do frontend) para "MM/YYYY" (formato WOOBA)
function expandirValidade(val: string): string {
  const m = val.match(/^(\d{2})\/(\d{2})$/)
  return m ? `${m[1]}/20${m[2]}` : val
}

export async function POST(req: NextRequest) {
  try {
    const { localizador, chaveDeSeguranca, codigoPagamento, usarFaturado, financiamentoId, cartao } = await req.json()

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

    const pagamento: any = { FormaDePagamento: codigoPagamento ?? 2 }
    if (!usarFaturado && cartao) {
      pagamento.CartaoDeCredito = {
        Bandeira:          detectarBandeira(cartao.numero),
        Numero:            cartao.numero.replace(/\D/g, ''),
        CodigoDeSeguranca: cartao.cvv,
        Validade:          expandirValidade(cartao.validade),
        TitularNome:       cartao.titular.toUpperCase(),
        FinanciamentoId:   financiamentoId ?? 61,
        Parcelas:          cartao.parcelas ?? 1,
      }
    }

    const emitirBody: any = { ...cred, ClienteId: 0, Localizador: localizador, Pagamento: pagamento }
    if (chaveDeSeguranca) emitirBody.ChaveDeSeguranca = chaveDeSeguranca

    const emitirData = await fetch(`${BASE}/Emitir`, {
      method: 'POST', headers: headers(), body: JSON.stringify(emitirBody),
    }).then(r => r.json())

    if (emitirData.Exception) {
      return NextResponse.json({ erro: emitirData.Exception.Message }, { status: 400 })
    }

    const bilhete    = emitirData.Bilhetes?.[0]?.Numero ?? ''
    const passageiro = emitirData.Bilhetes?.[0]?.Passageiro ?? ''

    return NextResponse.json({ bilhete, passageiro })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
