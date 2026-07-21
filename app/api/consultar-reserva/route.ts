import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export async function POST(req: NextRequest) {
  try {
    const { localizador } = await req.json()
    if (!localizador) return NextResponse.json({ erro: 'Localizador é obrigatório' }, { status: 400 })

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

    // 1. BuscarReserva — só pra descobrir o Sistema (Consultar exige o código
    // do sistema/fornecedor, que a gente não guarda em lugar nenhum).
    const buscaData: Any = await fetch(`${BASE}/BuscarReserva`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ ...cred, Localizador: localizador, Pagina: 1, Quantidade: 1, ApenasMinhas: false }),
    }).then(r => r.json())

    if (buscaData.Exception) {
      return NextResponse.json({ erro: buscaData.Exception.Message }, { status: 400 })
    }
    const sistema = buscaData.Itens?.[0]?.Sistema
    if (!sistema) {
      return NextResponse.json({ erro: 'Reserva não encontrada' }, { status: 404 })
    }

    // 2. Consultar — detalhe completo (voos, bilhetes, passageiros, pagamento)
    const consultaData: Any = await fetch(`${BASE}/Consultar`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ ...cred, Localizador: localizador, Sistema: sistema }),
    }).then(r => r.json())

    if (consultaData.Exception) {
      return NextResponse.json({ erro: consultaData.Exception.Message }, { status: 400 })
    }

    const reserva: Any = consultaData.Reserva
    if (!reserva) {
      return NextResponse.json({ erro: 'Reserva não encontrada' }, { status: 404 })
    }

    const bilhetes = (reserva.Bilhetes ?? []).map((b: Any) => ({
      numero: b.Numero ?? null,
      passageiro: b.Passageiro ?? null,
      dataDeEmissao: b.DataDeEmissao ?? null,
      status: b.Status ?? null,
    }))

    const passageiros = (reserva.Passageiros ?? []).map((p: Any) => ({
      nome: p.Nome ?? '',
      sobrenome: p.Sobrenome ?? '',
      tipo: p.Tipo ?? 'ADT',
    }))

    const viagens = (reserva.Viagens ?? []).map((v: Any) => ({
      companhia: v.CiaMandatoria?.CodigoIata ?? null,
      origem: v.Origem?.CodigoIata ?? null,
      destino: v.Destino?.CodigoIata ?? null,
      valorTotal: v.Preco?.Total ?? null,
      voos: (v.Voos ?? []).map((leg: Any) => ({
        numero: leg.Numero ?? '',
        companhia: leg.CiaMandatoria?.CodigoIata ?? v.CiaMandatoria?.CodigoIata ?? null,
        origem: leg.Origem?.CodigoIata ?? null,
        destino: leg.Destino?.CodigoIata ?? null,
        dataSaida: leg.DataSaida ?? null,
        dataChegada: leg.DataChegada ?? null,
        horaSaida: leg.HoraSaida ?? null,
        horaChegada: leg.HoraChegada ?? null,
        duracao: leg.Duracao ?? leg.TempoDeDuracao ?? null,
        numeroParadas: leg.QuantidadeParadas ?? 0,
        icone: leg.Icone ?? null,
      })),
    }))

    // Forma de pagamento — só existe depois de uma emissão real via cartão.
    const pagamentoCartao = reserva.Bilhetes?.[0]?.Pagamentos?.[0]?.CartaoDeCredito ?? null
    const formaPagamento = pagamentoCartao ? {
      bandeira: pagamentoCartao.Bandeira ?? null,
      parcelas: pagamentoCartao.Parcelas ?? null,
    } : null

    return NextResponse.json({
      localizador: reserva.Localizador ?? localizador,
      status: reserva.Status ?? null,
      valorPendente: reserva.ValorPendenteParaPagamento ?? null,
      bilhetes,
      passageiros,
      viagens,
      formaPagamento,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
