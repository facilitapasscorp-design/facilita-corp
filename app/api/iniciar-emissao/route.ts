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

function bandeiraCodigo(siglaOuNumero: string): number {
  const n = Number(siglaOuNumero)
  if (!isNaN(n) && n > 0) return n
  const mapa: Record<string, number> = { VI: 1, AM: 2, MC: 3, DC: 5, HC: 6, EL: 7 }
  return mapa[String(siglaOuNumero).toUpperCase()] ?? 1
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

      console.log('[INICIAR-EMISSAO-INICIO]', JSON.stringify({
        localizador,
        total: inicioData.Sumario?.TotalParaPagamento ?? null,
        erro:  inicioData.Exception?.Message ?? null,
      }))

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
      const formasBody: any = { ...cred, Localizador: localizador }
      if (cartao?.numero) {
        const num      = cartao.numero.replace(/\D/g, '')
        const sigla    = cartao.bandeira || detectarBandeira(num)
        const bandeira = bandeiraCodigo(sigla)
        formasBody.Pagamento = {
          FormaDePagamento: codigoPagamento ?? 2,
          CartaoDeCredito: {
            Bandeira:          bandeira,
            CodigoDeSeguranca: cartao.cvv ?? '',
            Numero:            num,
            Parcelas:          1,
            TitularNome:       (cartao.titular ?? '').toUpperCase(),
            Validade:          expandirValidade(cartao.validade ?? ''),
          },
        }
      }

      console.log('[FIN-ENVIO]', JSON.stringify({
        temCartao: !!cartao?.numero,
        bandeira:  formasBody.Pagamento?.CartaoDeCredito?.Bandeira ?? null,
        ultimos4:  cartao?.numero ? cartao.numero.replace(/\D/g, '').slice(-4) : null,
      }))
      const formasData = await fetch(`${BASE}/RecuperarFormasDeFinanciamento`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify(formasBody),
      }).then(r => r.json())

      console.log('[FINANCIAMENTO]', JSON.stringify({
        temCartao: !!cartao?.numero,
        parcelas:  (formasData.Financiamentos ?? []).length,
        erro:      formasData.Exception?.Message ?? null,
      }))
      console.log('[FINANCIAMENTO-RAW]', JSON.stringify(formasData.Financiamentos ?? []))

      if (!formasData.Exception) {
        // Nunca calculamos juros por conta própria — PrimeiraParcela e DemaisParcela já
        // vêm prontos da WOOBA. O total é só a soma das parcelas que ela retornou
        // (primeira + demais), não uma estimativa nossa. "Sem juros" vem literalmente
        // dos campos CoeficienteJuros/vlJurosCalculado que a API já expõe.
        formasFinanciamento = (formasData.Financiamentos ?? []).map((item: any) => {
          const parcelas        = item.Parcelas ?? 1
          const primeiraParcela = item.PrimeiraParcela ?? 0
          const demaisParcela   = item.DemaisParcela ?? 0
          const semJuros        = !item.CoeficienteJuros && !item.vlJurosCalculado
          const total            = primeiraParcela + demaisParcela * Math.max(parcelas - 1, 0)
          return {
            FinanciamentoId:  item.Id,
            Parcelas:         parcelas,
            PrimeiraParcela:  primeiraParcela,
            DemaisParcela:    demaisParcela,
            SemJuros:         semJuros,
            Total:            total,
          }
        })
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
