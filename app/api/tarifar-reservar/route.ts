import { NextRequest, NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

function getLegs(viagem: any): any[] {
  return viagem.Voos?.length
    ? viagem.Voos
    : (viagem.Segmentos || []).flatMap((s: any) => s.Voos || [])
}

function extrairClasses(viagem: any) {
  let classeRef = ''
  return getLegs(viagem)
    .filter((leg: any) => leg.Numero || leg.NumeroDoVoo)
    .map((leg: any) => {
      const bt = leg.BaseTarifaria?.[0]
      const classe = leg.Classe || classeRef
      if (classe) classeRef = classe
      return {
        BaseTarifaria: bt?.Codigo || '',
        Classe: classe,
        Familia: bt?.Familia || leg.Familia || '',
        NumeroDoVoo: String(leg.Numero || leg.NumeroDoVoo || ''),
      }
    })
}

function toWcfDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  return `/Date(${d.getTime()}-0300)/`
}

export async function POST(req: NextRequest) {
  try {
    const { vooIda, vooVolta, passageiros: passageirosRaw } = await req.json()
    const passageiros: any[] = Array.isArray(passageirosRaw) ? passageirosRaw : [passageirosRaw]

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

    const classesIda   = extrairClasses(vooIda)
    const classesVolta = vooVolta ? extrairClasses(vooVolta) : []

    // 1. Tarifar
    const tarifaBody: any = {
      ...cred, ClienteId: 0,
      IdentificacaoDaViagem: vooIda.IdentificacaoDaViagem,
      ViagemIda: vooIda.Id,
      ClassesSelecionadas: classesIda,
      RetornarPlanoDeFinanciamento: true,
      RetornarRegrasTarifarias: true,
      TarifarMelhorFamilia: true,
      TarifarMelhorPreco: true,
    }
    if (vooVolta) {
      tarifaBody.ViagemVolta              = vooVolta.Id
      tarifaBody.ClassesSelecionadasVolta = classesVolta
    }

    const tarifaRes  = await fetch(`${BASE}/Tarifar`, {
      method: 'POST', headers: headers(), body: JSON.stringify(tarifaBody),
    })
    const tarifaData = await tarifaRes.json()
    console.log('[TARIFAR] status:', tarifaRes.status, '| Exception:', tarifaData.Exception?.Message ?? null)
    console.log('[TARIFAR] ViagensTrecho1 count:', tarifaData.ViagensTrecho1?.length ?? 0)

    if (tarifaData.Exception) {
      return NextResponse.json({ erro: tarifaData.Exception.Message }, { status: 400 })
    }

    const idViagem = tarifaData.ViagensTrecho1?.[0]?.IdentificacaoDaViagem
      || vooIda.IdentificacaoDaViagem
    console.log('[RESERVAR] idViagem:', JSON.stringify(idViagem))
    console.log('[RESERVAR] classesIda:', JSON.stringify(classesIda))

    // 2. Reservar — estrutura exata da homologação WOOBA
    const primAdulto = passageiros.find((p: any) => (p.tipo || 'ADT') === 'ADT') || passageiros[0]
    const telContato = primAdulto.telefone ? primAdulto.telefone.replace(/\D/g, '') : ''

    const reservaBody = {
      ...cred,
      ClienteId: 0,
      IdentificacaoDaViagem: idViagem,
      ClassesSelecionadas: classesIda,
      ...(vooVolta ? { ClassesSelecionadasVolta: classesVolta } : {}),
      Passageiros: passageiros.map((p: any, i: number) => ({
        Nome:        p.nome.toUpperCase(),
        Sobrenome:   p.sobrenome.toUpperCase(),
        CPF:         p.cpf ? p.cpf.replace(/\D/g, '') : undefined,
        Nascimento:  toWcfDate(p.nascimento),
        Email:       p.email || undefined,
        FaixaEtaria: p.tipo || 'ADT',
        Sexo:        p.sexo || 'M',
        Linha:       String(i + 1),
      })),
      InformacoesComplementaresPassageiro: passageiros.map((p: any) => ({
        Nome:      p.nome.toUpperCase(),
        Sobrenome: p.sobrenome.toUpperCase(),
        Tipo:      p.tipo || 'ADT',
      })),
      Contatos: [
        {
          Nome:           `${primAdulto.nome} ${primAdulto.sobrenome}`.toUpperCase(),
          Email:          primAdulto.email,
          NumeroDDD:      telContato.slice(0, 2) || '11',
          NumeroTelefone: telContato.slice(2) || '999999999',
          NumeroDDI:      '55',
          Tipo:           0,
        },
      ],
      Solicitante:         primAdulto.nome.toUpperCase(),
      ValidarAnaliseRisco: false,
    }

    console.log('[RESERVAR] Contatos:', JSON.stringify(reservaBody.Contatos))

    const reservaRes  = await fetch(`${BASE}/Reservar`, {
      method: 'POST', headers: headers(), body: JSON.stringify(reservaBody),
    })
    const reservaRaw = await reservaRes.text()
    console.log('[RESERVAR] raw:', reservaRaw.slice(0, 500))
    const reservaData = JSON.parse(reservaRaw)
    console.log('[RESERVAR] status:', reservaRes.status, '| Exception:', reservaData.Exception?.Message ?? null)
    console.log('[RESERVAR] Localizador:', reservaData.Reservas?.[0]?.Localizador ?? null)

    if (reservaData.Exception) {
      return NextResponse.json({ erro: reservaData.Exception.Message }, { status: 400 })
    }

    const localizador = reservaData.Reservas?.[0]?.Localizador
    if (!localizador) {
      return NextResponse.json({ erro: 'Localizador não retornado pela WOOBA' }, { status: 400 })
    }

    return NextResponse.json({ localizador })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
