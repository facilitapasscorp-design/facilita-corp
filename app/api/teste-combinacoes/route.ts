import { NextResponse } from 'next/server'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

const SISTEMAS_ALVO = [77, 103, 95, 104] as const
const NOME_SISTEMA: Record<number, string> = {
  77:  'GDS LATAM',
  103: 'NDC LATAM',
  95:  'GOL',
  104: 'AZUL',
}

const COMBINACOES: Array<{ ida: number; volta: number }> = [
  { ida: 77,  volta: 77  },  // GDS LATAM + GDS LATAM
  { ida: 103, volta: 103 },  // NDC LATAM + NDC LATAM
  { ida: 103, volta: 77  },  // NDC LATAM + GDS LATAM
  { ida: 103, volta: 95  },  // NDC LATAM + GOL
  { ida: 77,  volta: 95  },  // GDS LATAM + GOL
  { ida: 95,  volta: 104 },  // GOL + AZUL
  { ida: 95,  volta: 95  },  // GOL + GOL
]

const ORIGEM     = 'GRU'
const DESTINO    = 'GIG'
const DATA_IDA   = '2026-08-05'
const DATA_VOLTA = '2026-08-12'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Viagem = Record<string, any>

function toWcfDate(dateStr: string): string {
  const d = new Date(dateStr + 'T03:00:00.000Z')
  return `/Date(${d.getTime()}-0300)/`
}

function extrairClasses(viagem: Viagem) {
  const legs: Viagem[] = viagem.Voos?.length
    ? viagem.Voos
    : (viagem.Segmentos ?? []).flatMap((s: Viagem) => s.Voos ?? [])

  let classeRef = ''
  return legs
    .filter((leg: Viagem) => leg.Numero || leg.NumeroDoVoo)
    .map((leg: Viagem) => {
      const bt = leg.BaseTarifaria?.[0]
      const classe = leg.Classe || bt?.Classe || classeRef
      if (classe) classeRef = classe
      return {
        BaseTarifaria: bt?.Codigo || '',
        Classe: classe,
        Familia: bt?.Familia || leg.Familia || '',
        NumeroDoVoo: String(leg.Numero || leg.NumeroDoVoo || ''),
      }
    })
}

export async function GET() {
  const BASE  = process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX
  const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
  const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
  const token = process.env.WOOBA_TOKEN!
  const cred  = { Login: login, Senha: senha }

  const makeHeaders = () => ({
    'Content-Type':          'application/json',
    'Accept':                'application/json',
    'Developer-Token':       token,
    'Developer-Access-Code': gerarAccessCode(),
  })

  console.log(`[TESTE-COMB] ═══════════════════════════════════════════`)
  console.log(`[TESTE-COMB] Iniciando: ${ORIGEM}→${DESTINO} | ida=${DATA_IDA} volta=${DATA_VOLTA}`)
  console.log(`[TESTE-COMB] BASE_URL: ${BASE}`)

  try {
    // ── 1. Recuperar sistemas disponíveis ────────────────────────────
    const sistemasRes  = await fetch(`${BASE}/RecuperarSistemasPesquisa`, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ ...cred, Origem: ORIGEM, Destino: DESTINO, Timeout: 15 }),
    })
    const sistemasData = await sistemasRes.json()

    if (sistemasData.Exception) {
      console.error('[TESTE-COMB] RecuperarSistemasPesquisa falhou:', sistemasData.Exception.Message)
      return NextResponse.json({ erro: 'RecuperarSistemasPesquisa falhou', detalhe: sistemasData.Exception.Message }, { status: 400 })
    }

    const sistemasDisponiveis: number[] = (sistemasData.Sistemas ?? []).map((s: Viagem) => s.Sistema)
    console.log(`[TESTE-COMB] Sistemas disponíveis para ${ORIGEM}→${DESTINO}: [${sistemasDisponiveis.join(', ')}]`)

    // ── 2. Buscar disponibilidade por sistema ────────────────────────
    const voosPorSistema: Record<number, { ida: Viagem | null; volta: Viagem | null; erro: string | null }> = {}

    for (const sistemaId of SISTEMAS_ALVO) {
      const nome = NOME_SISTEMA[sistemaId]

      if (!sistemasDisponiveis.includes(sistemaId)) {
        console.log(`[TESTE-COMB] Sistema ${sistemaId} (${nome}) não retornado pelo RecuperarSistemasPesquisa — pulando`)
        voosPorSistema[sistemaId] = { ida: null, volta: null, erro: 'Sistema não disponível para esta rota' }
        continue
      }

      console.log(`[TESTE-COMB] Buscando disponibilidade: sistema ${sistemaId} (${nome})…`)
      try {
        const dispRes  = await fetch(`${BASE}/Disponibilidade`, {
          method: 'POST',
          headers: makeHeaders(),
          body: JSON.stringify({
            ...cred,
            Origem: ORIGEM,
            Destino: DESTINO,
            DataIda:   toWcfDate(DATA_IDA),
            DataVolta: toWcfDate(DATA_VOLTA),
            QuantidadeAdultos:  1,
            QuantidadeCriancas: 0,
            QuantidadeBebes:    0,
            QuantidadeDeVoos:   50,
            Sistema: sistemaId,
            ApenasVoosComBagagem: false,
            ApenasVoosDiretos:    false,
            BuscarVoosComBagagem: false,
            BuscarVoosSemBagagem: true,
            Flex:         false,
            Recomendacao: false,
          }),
        })
        const dispData = await dispRes.json()

        if (dispData.Exception) {
          console.log(`[TESTE-COMB] Sistema ${sistemaId} (${nome}) Disponibilidade erro: ${dispData.Exception.Message}`)
          voosPorSistema[sistemaId] = { ida: null, volta: null, erro: dispData.Exception.Message }
          continue
        }

        const ida   = (dispData.ViagensTrecho1 as Viagem[] | null)?.[0] ?? null
        const volta = (dispData.ViagensTrecho2 as Viagem[] | null)?.[0] ?? null

        console.log(`[TESTE-COMB] Sistema ${sistemaId} (${nome}): ` +
          `trecho1=${dispData.ViagensTrecho1?.length ?? 0} voos, trecho2=${dispData.ViagensTrecho2?.length ?? 0} voos`)

        if (ida) {
          console.log(`[TESTE-COMB]   ida  → Id=${ida.Id} IdentificacaoDaViagem=${ida.IdentificacaoDaViagem} ` +
            `voo=${(ida.Voos?.[0]?.Numero || ida.Voos?.[0]?.NumeroDoVoo) ?? '?'} ` +
            `preco=${ida.Preco?.Total ?? '?'}`)
        } else {
          console.log(`[TESTE-COMB]   ida  → nenhum voo retornado`)
        }
        if (volta) {
          console.log(`[TESTE-COMB]   volta → Id=${volta.Id} IdentificacaoDaViagem=${volta.IdentificacaoDaViagem} ` +
            `voo=${(volta.Voos?.[0]?.Numero || volta.Voos?.[0]?.NumeroDoVoo) ?? '?'} ` +
            `preco=${volta.Preco?.Total ?? '?'}`)
        } else {
          console.log(`[TESTE-COMB]   volta → nenhum voo retornado`)
        }

        voosPorSistema[sistemaId] = { ida, volta, erro: null }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log(`[TESTE-COMB] Sistema ${sistemaId} (${nome}) exceção: ${msg}`)
        voosPorSistema[sistemaId] = { ida: null, volta: null, erro: msg }
      }
    }

    // ── 3. Testar combinações no Tarifar ────────────────────────────
    console.log(`[TESTE-COMB] ───────────────────────────────────────────`)
    console.log(`[TESTE-COMB] Iniciando testes de ${COMBINACOES.length} combinações`)

    type Resultado = {
      combinacao: string
      status: 'OK' | 'ERRO' | 'PULADO'
      precoIda?: number
      precoVolta?: number
      motivo?: string
      erro?: string
    }
    const resultados: Resultado[] = []

    for (const { ida: idaSistema, volta: voltaSistema } of COMBINACOES) {
      const nomeIda   = NOME_SISTEMA[idaSistema]
      const nomeVolta = NOME_SISTEMA[voltaSistema]
      const label     = `Ida ${nomeIda} (${idaSistema}) + Volta ${nomeVolta} (${voltaSistema})`

      const dadosIda   = voosPorSistema[idaSistema]
      const dadosVolta = voosPorSistema[voltaSistema]

      if (!dadosIda?.ida) {
        const motivo = `Sem voo de ida — sistema ${idaSistema}: ${dadosIda?.erro ?? 'sem voos disponíveis'}`
        console.log(`[TESTE-COMB] PULADO | ${label} | ${motivo}`)
        resultados.push({ combinacao: label, status: 'PULADO', motivo })
        continue
      }
      if (!dadosVolta?.volta) {
        const motivo = `Sem voo de volta — sistema ${voltaSistema}: ${dadosVolta?.erro ?? 'sem voos disponíveis'}`
        console.log(`[TESTE-COMB] PULADO | ${label} | ${motivo}`)
        resultados.push({ combinacao: label, status: 'PULADO', motivo })
        continue
      }

      const vooIda   = dadosIda.ida
      const vooVolta = dadosVolta.volta

      console.log(`[TESTE-COMB] Tarifando | ${label}`)
      console.log(`[TESTE-COMB]   ViagemIda=${vooIda.Id} IdentificacaoDaViagem=${vooIda.IdentificacaoDaViagem}`)
      console.log(`[TESTE-COMB]   ViagemVolta=${vooVolta.Id}`)

      try {
        const classesIda   = extrairClasses(vooIda)
        const classesVolta = extrairClasses(vooVolta)
        console.log(`[TESTE-COMB]   ClassesSelecionadas: ${JSON.stringify(classesIda)}`)
        console.log(`[TESTE-COMB]   ClassesSelecionadasVolta: ${JSON.stringify(classesVolta)}`)

        const tarifaBody = {
          ...cred,
          ClienteId: 0,
          IdentificacaoDaViagem:   vooIda.IdentificacaoDaViagem,
          ViagemIda:               vooIda.Id,
          ViagemVolta:             vooVolta.Id,
          ClassesSelecionadas:     classesIda,
          ClassesSelecionadasVolta: classesVolta,
          RetornarPlanoDeFinanciamento: true,
          RetornarRegrasTarifarias:     true,
          TarifarMelhorFamilia:         true,
          TarifarMelhorPreco:           true,
        }

        const tarifaRes  = await fetch(`${BASE}/Tarifar`, {
          method: 'POST',
          headers: makeHeaders(),
          body: JSON.stringify(tarifaBody),
        })
        const tarifaData = await tarifaRes.json()

        if (tarifaData.Exception) {
          const erro = tarifaData.Exception.Message ?? JSON.stringify(tarifaData.Exception)
          console.log(`[TESTE-COMB] ERRO    | ${label} | ${erro}`)
          resultados.push({ combinacao: label, status: 'ERRO', erro })
        } else {
          const precoIda   = tarifaData.ViagensTrecho1?.[0]?.Preco?.Total as number | undefined
          const precoVolta = tarifaData.ViagensTrecho2?.[0]?.Preco?.Total as number | undefined
          console.log(`[TESTE-COMB] OK      | ${label} | precoIda=${precoIda} precoVolta=${precoVolta}`)
          resultados.push({ combinacao: label, status: 'OK', precoIda, precoVolta })
        }
      } catch (e) {
        const erro = e instanceof Error ? e.message : String(e)
        console.log(`[TESTE-COMB] ERRO    | ${label} | exceção: ${erro}`)
        resultados.push({ combinacao: label, status: 'ERRO', erro: `exceção: ${erro}` })
      }
    }

    // ── 4. Relatório final ───────────────────────────────────────────
    const ok      = resultados.filter(r => r.status === 'OK')
    const erros   = resultados.filter(r => r.status === 'ERRO')
    const pulados = resultados.filter(r => r.status === 'PULADO')

    console.log(`[TESTE-COMB] ═══════════════════════════════════════════`)
    console.log(`[TESTE-COMB] RESULTADO FINAL: ${ok.length} OK | ${erros.length} ERRO | ${pulados.length} PULADOS`)
    ok.forEach(r =>      console.log(`[TESTE-COMB]   ✓ ${r.combinacao}`))
    erros.forEach(r =>   console.log(`[TESTE-COMB]   ✗ ${r.combinacao} → ${r.erro}`))
    pulados.forEach(r => console.log(`[TESTE-COMB]   ~ ${r.combinacao} → ${r.motivo}`))
    console.log(`[TESTE-COMB] ═══════════════════════════════════════════`)

    return NextResponse.json({
      parametros: { origem: ORIGEM, destino: DESTINO, dataIda: DATA_IDA, dataVolta: DATA_VOLTA },
      sistemasDisponiveis,
      voosPorSistema: Object.fromEntries(
        SISTEMAS_ALVO.map(id => [
          `${id} (${NOME_SISTEMA[id]})`,
          {
            idaDisponivel:   !!voosPorSistema[id]?.ida,
            voltaDisponivel: !!voosPorSistema[id]?.volta,
            erro:            voosPorSistema[id]?.erro ?? null,
            idaId:           voosPorSistema[id]?.ida?.Id ?? null,
            voltaId:         voosPorSistema[id]?.volta?.Id ?? null,
            idaIdentificacao: voosPorSistema[id]?.ida?.IdentificacaoDaViagem ?? null,
          },
        ])
      ),
      resumo: { ok: ok.length, erros: erros.length, pulados: pulados.length, total: resultados.length },
      resultados,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[TESTE-COMB] Erro crítico:', msg)
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
