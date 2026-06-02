import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function detectarBandeira(numero: string): string {
  const n = numero.replace(/\D/g, '')
  if (/^4/.test(n))                                               return 'VI'
  if (/^3[47]/.test(n))                                           return 'AM'
  if (/^5[1-5]/.test(n) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(n)) return 'MC'
  if (/^3(0[0-5]|[68])/.test(n))                                  return 'DC'
  if (/^(606282|3841)/.test(n))                                   return 'HC'
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|651|655)/.test(n)) return 'EL'
  return 'VI'
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
    let totalParaPagamento = 0

    // 1. IniciarEmissao — roda sempre (precisamos do valor total para parcelar)
    {
      const inicioData = await fetch(`${BASE}/IniciarEmissao`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ ...cred, ClienteId: 0, Localizador: localizador }),
      }).then(r => r.json())

      console.log('[INICIAR-EMISSAO-INICIO]', JSON.stringify(inicioData))

      if (inicioData.Exception) {
        return NextResponse.json({ erro: inicioData.Exception.Message }, { status: 400 })
      }

      chaveDeSeguranca = inicioData.ChaveDeSeguranca || null
      const opcoesPagamento: any[] = inicioData.ConfiguracoesDeEmissao?.OpcoesDePagamento || []
      const opcao = opcoesPagamento.find((o: any) => o.CartaoDeCredito === true) || opcoesPagamento[0]
      codigoPagamento = opcao?.CodigoFormaDeRecebimento ?? 2
      totalParaPagamento = inicioData.Sumario?.TotalParaPagamento ?? 0
    }

    // 2. RecuperarFormasDeFinanciamento — com dados do cartão quando disponíveis
    let formasFinanciamento: any[] = []
    try {
      const formasBody: any = { ...cred, ClienteId: 0, Localizador: localizador }
      if (cartao?.numero) {
        const num = cartao.numero.replace(/\D/g, '')
        const validadeMatch = (cartao.validade ?? '').match(/^(\d{2})\/?(\d{2,4})$/)
        const mes    = validadeMatch ? validadeMatch[1] : ''
        const anoRaw = validadeMatch ? validadeMatch[2] : ''
        const ano    = anoRaw.length === 2 ? '20' + anoRaw : anoRaw
        formasBody.NumeroCartao    = num
        formasBody.NomeTitular     = cartao.titular ?? ''
        formasBody.CodigoSeguranca = cartao.cvv ?? ''
        formasBody.MesValidade     = mes
        formasBody.AnoValidade     = ano
        formasBody.Bandeira        = cartao.bandeira || detectarBandeira(num)
        formasBody.Forma           = codigoPagamento ?? 2
      }

      console.log('[FIN-ENVIO]', JSON.stringify({ ...formasBody, CartaoDeCredito: formasBody.CartaoDeCredito ? { ...formasBody.CartaoDeCredito, Numero: 'MASK' + String(formasBody.CartaoDeCredito.Numero).slice(-4) } : undefined }))
      const formasData = await fetch(`${BASE}/RecuperarFormasDeFinanciamento`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify(formasBody),
      }).then(r => r.json())

      console.log('[FINANCIAMENTO]', cartao?.numero ? 'COM-CARTAO' : 'SEM-CARTAO', JSON.stringify(formasData))

      // Campo correto na resposta da WOOBA é "Financiamentos", não "FormasDeFinanciamento"
      if (!formasData.Exception) {
        formasFinanciamento = formasData.Financiamentos ?? []
      }
    } catch (e) {
      console.log('[FINANCIAMENTO-ERRO]', e instanceof Error ? e.message : String(e))
    }

    return NextResponse.json({ chaveDeSeguranca, codigoPagamento, formasFinanciamento })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
