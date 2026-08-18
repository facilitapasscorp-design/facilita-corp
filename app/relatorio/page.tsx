'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../lib/supabase'

/* ── Tipos ─────────────────────────────────────────────────────────── */

interface Reserva {
  id: string
  localizador: string
  origem: string
  destino: string
  data_voo: string | null
  passageiro_nome: string | null
  passageiros: { nome?: string; sobrenome?: string; tipo?: string }[] | null
  valor: number | null
  status: 'Ativa' | 'Emitida' | 'Cancelada' | 'Expirada'
  created_at: string
  companhia: string | null
  grupo_reserva: string | null
  trecho: 'ida' | 'volta' | null
  fora_politica: boolean | null
  politica_motivos: { trecho?: string; motivos?: string[]; categoria?: string; detalhe?: string }[] | null
}

/** Uma viagem = um grupo de reservas (ida e volta viram duas linhas no banco). */
interface Viagem {
  chave: string
  linhas: Reserva[]
  ida: Reserva
  valor: number
  viajante: string
  qtdPassageiros: number
  acompanhantes: number
  compradoEm: Date
  dataVoo: Date | null
  antecedencia: number | null
  foraPolitica: boolean
  motivos: string[]
  categorias: string[]
}

/** Faixas de antecedência de compra. Fora do componente porque são fixas —
 *  dentro dele, seriam recriadas a cada render e entrariam como dependência. */
const FAIXAS: [string, number, number][] = [
  ['0–3 dias', 0, 3], ['4–7', 4, 7], ['8–14', 8, 14], ['15–21', 15, 21], ['22+', 22, 9999],
]

type Periodo = '30' | '90' | '180' | 'tudo'
type Escopo = 'emitidas' | 'todas'

/* ── Paleta de dados ───────────────────────────────────────────────────
   Um hue só para magnitude — o comprimento da barra carrega o valor, a cor
   não precisa carregar nada. Cores de status só aparecem acompanhadas de
   ícone e texto, nunca sozinhas. */
const SERIE   = '#2a78d6'
const CONTEXO = '#c3c2b7'
const AVISO   = '#fab219'
const GRID    = '#e1e0d9'
const TINTA   = '#52514e'
const MUDO    = '#898781'

/* ── Utilidades ────────────────────────────────────────────────────── */

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "joao  silva" e "JOAO SILVA" são a mesma pessoa. O campo é texto livre
 *  digitado por quem reserva, então normalizar na leitura é o mínimo. */
function normalizarNome(n: string | null): string {
  return (n ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || '—'
}

function diasEntre(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / 86400000)
}

/* ── Agrupamento: o coração do relatório ───────────────────────────────
   Uma viagem de ida e volta com companhias diferentes gera DUAS linhas em
   `reservas`. Contar linhas dobraria o número de viagens e cortaria o ticket
   médio pela metade. Aqui cada grupo vira uma viagem só, somando o valor dos
   trechos e usando a ida como referência de rota e data. */
function agruparViagens(reservas: Reserva[]): Viagem[] {
  const grupos = new Map<string, Reserva[]>()
  for (const r of reservas) {
    const chave = r.grupo_reserva ?? r.id
    const atual = grupos.get(chave)
    if (atual) atual.push(r)
    else grupos.set(chave, [r])
  }

  return [...grupos.entries()].map(([chave, linhas]) => {
    const ida = linhas.find(l => l.trecho === 'ida') ?? linhas[0]
    const compradoEm = new Date(ida.created_at)
    const dataVoo = ida.data_voo ? new Date(`${ida.data_voo}T12:00:00`) : null

    const motivos: string[] = []
    const categorias: string[] = []
    for (const l of linhas) {
      for (const m of l.politica_motivos ?? []) {
        for (const t of m.motivos ?? []) motivos.push(t)
        if (m.categoria) categorias.push(m.categoria)
      }
    }

    return {
      chave,
      linhas,
      ida,
      valor: linhas.reduce((s, l) => s + (l.valor ?? 0), 0),
      viajante: normalizarNome(ida.passageiro_nome),
      // Antes de agosto de 2026 a reserva só guardava o primeiro adulto, então
      // reserva antiga conta uma pessoa mesmo tendo levado três. Não dá para
      // inventar o que não foi gravado.
      qtdPassageiros: ida.passageiros?.length ?? 1,
      acompanhantes: Math.max((ida.passageiros?.length ?? 1) - 1, 0),
      compradoEm,
      dataVoo,
      antecedencia: dataVoo ? Math.max(diasEntre(compradoEm, dataVoo), 0) : null,
      foraPolitica: linhas.some(l => l.fora_politica === true),
      motivos,
      categorias,
    }
  })
}

/* ── Peças visuais ─────────────────────────────────────────────────── */

function Cartao({ children, titulo, nota, className = '' }: {
  children: React.ReactNode; titulo?: string; nota?: string; className?: string
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-5 ${className}`}>
      {titulo && <h3 className="text-sm font-semibold text-gray-700">{titulo}</h3>}
      {nota && <p className="text-xs mt-0.5 mb-3" style={{ color: MUDO }}>{nota}</p>}
      {children}
    </div>
  )
}

function Kpi({ rotulo, valor, apoio, alerta }: {
  rotulo: string; valor: string; apoio?: string; alerta?: boolean
}) {
  return (
    <Cartao>
      <p className="text-xs mb-1.5" style={{ color: TINTA }}>{rotulo}</p>
      <div className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight whitespace-nowrap">{valor}</div>
      {apoio && (
        <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: alerta ? '#92400e' : MUDO }}>
          {alerta && <span aria-hidden="true">⚠</span>}{apoio}
        </p>
      )}
    </Cartao>
  )
}

function BarrasHorizontais({ dados, formata }: {
  dados: { rotulo: string; valor: number }[]; formata: (v: number) => string
}) {
  if (dados.length === 0) return <p className="text-sm py-6 text-center" style={{ color: MUDO }}>Sem dados no período.</p>
  const max = Math.max(...dados.map(d => d.valor), 1)
  return (
    <div className="space-y-2">
      {dados.map(d => (
        <div key={d.rotulo} className="flex items-center gap-3">
          <span className="text-xs w-28 sm:w-36 shrink-0 truncate text-right" style={{ color: TINTA }} title={d.rotulo}>
            {d.rotulo}
          </span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="h-6 rounded" style={{ width: `${Math.max((d.valor / max) * 100, 2)}%`, backgroundColor: SERIE }} />
            <span className="text-xs font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formata(d.valor)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Colunas({ dados }: { dados: { rotulo: string; valor: number; apoio: string; forte: boolean }[] }) {
  const max = Math.max(...dados.map(d => d.valor), 1)
  return (
    <div className="flex items-end gap-2 sm:gap-3 h-44">
      {dados.map(d => (
        <div key={d.rotulo} className="flex-1 flex flex-col items-center justify-end h-full">
          <span className="text-xs font-semibold text-gray-900 tabular-nums mb-1">{d.valor}</span>
          <div className="w-full rounded-t"
            style={{ height: `${Math.max((d.valor / max) * 100, 2)}%`, backgroundColor: d.forte ? SERIE : CONTEXO }} />
          <span className="text-[10px] mt-2 text-center leading-tight" style={{ color: MUDO }}>{d.rotulo}</span>
          <span className="text-[10px] text-center tabular-nums" style={{ color: TINTA }}>{d.apoio}</span>
        </div>
      ))}
    </div>
  )
}

function LinhaMensal({ dados }: { dados: { rotulo: string; valor: number }[] }) {
  if (dados.length === 0) return <p className="text-sm py-6 text-center" style={{ color: MUDO }}>Sem dados no período.</p>
  const max = Math.max(...dados.map(d => d.valor), 1)
  const W = 520, H = 180, L = 54, R = 12, T = 12, B = 28
  const pw = W - L - R, ph = H - T - B
  const x = (i: number) => dados.length === 1 ? L + pw / 2 : L + (pw / (dados.length - 1)) * i
  const y = (v: number) => T + ph - (v / max) * ph

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
      aria-label={`Gasto por mês, de ${brl(Math.min(...dados.map(d => d.valor)))} a ${brl(max)}`}>
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke={GRID} strokeWidth={1} />
          <text x={L - 8} y={y(max * f) + 3.5} textAnchor="end" fontSize={10} fill={MUDO}>
            {max * f >= 1000 ? `${Math.round((max * f) / 1000)}k` : Math.round(max * f)}
          </text>
        </g>
      ))}
      <path d={dados.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.valor)}`).join(' ')}
        fill="none" stroke={SERIE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {dados.map((d, i) => (
        <g key={d.rotulo}>
          <circle cx={x(i)} cy={y(d.valor)} r={4} fill={SERIE} stroke="#fff" strokeWidth={2} />
          <title>{`${d.rotulo} · ${brl(d.valor)}`}</title>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={MUDO}>{d.rotulo}</text>
        </g>
      ))}
    </svg>
  )
}

/* ── Página ────────────────────────────────────────────────────────── */

export default function Relatorio() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [empresa, setEmpresa] = useState<string>('')
  const [periodo, setPeriodo] = useState<Periodo>('180')
  const [escopo, setEscopo] = useState<Escopo>('emitidas')
  // Congela o "agora" na montagem: o recorte do período não deve escorregar
  // a cada re-render, e ler o relógio durante a renderização é impuro.
  const [agora] = useState(() => Date.now())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/entrar'); return }

      const { data: vinculo } = await supabase
        .from('usuarios_empresas')
        .select('papel_empresa, empresas(nome)')
        .eq('user_id', data.session.user.id)
        .maybeSingle()

      // O relatório é da empresa, não do viajante: só admin da empresa entra.
      if (vinculo?.papel_empresa !== 'admin') { setSemAcesso(true); setCarregando(false); return }
      setEmpresa((vinculo?.empresas as unknown as { nome: string } | null)?.nome ?? '')

      // A RLS já limita às reservas da empresa deste admin — não é preciso
      // (nem seria confiável) filtrar por empresa aqui no navegador.
      const { data: linhas } = await supabase
        .from('reservas').select('*').order('created_at', { ascending: false })
      setReservas((linhas ?? []) as Reserva[])
      setCarregando(false)
    })
  }, [router])

  const viagens = useMemo(() => {
    const desde = periodo === 'tudo' ? null : new Date(agora - Number(periodo) * 86400000)
    const filtradas = reservas.filter(r => {
      if (escopo === 'emitidas' && r.status !== 'Emitida') return false
      if (desde && new Date(r.created_at) < desde) return false
      return true
    })
    return agruparViagens(filtradas)
  }, [reservas, periodo, escopo, agora])

  const total       = viagens.reduce((s, v) => s + v.valor, 0)
  const ticketMedio = viagens.length ? total / viagens.length : 0
  const totalPassageiros = viagens.reduce((s, v) => s + v.qtdPassageiros, 0)
  const comAntec    = viagens.filter(v => v.antecedencia != null)
  const antecMedia  = comAntec.length
    ? Math.round(comAntec.reduce((s, v) => s + (v.antecedencia ?? 0), 0) / comAntec.length)
    : null

  const fora = viagens.filter(v => v.foraPolitica)
  const pctDentro = viagens.length ? Math.round(((viagens.length - fora.length) / viagens.length) * 100) : 100

  const porMes = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const v of viagens) {
      const k = `${v.compradoEm.getFullYear()}-${String(v.compradoEm.getMonth()).padStart(2, '0')}`
      mapa.set(k, (mapa.get(k) ?? 0) + v.valor)
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([k, valor]) => ({ rotulo: MESES[Number(k.split('-')[1])], valor }))
  }, [viagens])

  const porViajante = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const v of viagens) mapa.set(v.viajante, (mapa.get(v.viajante) ?? 0) + v.valor)
    return [...mapa.entries()].map(([rotulo, valor]) => ({ rotulo, valor }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8)
  }, [viagens])

  const porAntecedencia = useMemo(() => FAIXAS.map(([rotulo, min, max], i) => {
    const naFaixa = comAntec.filter(v => (v.antecedencia ?? 0) >= min && (v.antecedencia ?? 0) <= max)
    const medio = naFaixa.length ? naFaixa.reduce((s, v) => s + v.valor, 0) / naFaixa.length : 0
    return { rotulo, valor: naFaixa.length, apoio: medio ? brl(medio) : '—', forte: i < 2 }
  }), [comAntec])

  const porRota = useMemo(() => {
    const mapa = new Map<string, { viagens: number; valor: number; cias: Set<string> }>()
    for (const v of viagens) {
      // A rota da viagem é a da IDA. Sem isso, uma ida e volta apareceria
      // como GRU→GIG e GIG→GRU, duas rotas distintas para a mesma viagem.
      const k = `${v.ida.origem} → ${v.ida.destino}`
      const atual = mapa.get(k) ?? { viagens: 0, valor: 0, cias: new Set<string>() }
      atual.viagens += 1
      atual.valor += v.valor
      for (const l of v.linhas) if (l.companhia) atual.cias.add(l.companhia)
      mapa.set(k, atual)
    }
    return [...mapa.entries()].map(([rota, d]) => ({ rota, ...d, cias: [...d.cias].join(', ') || '—' }))
      .sort((a, b) => b.viagens - a.viagens).slice(0, 6)
  }, [viagens])

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const v of fora) for (const c of new Set(v.categorias)) mapa.set(c, (mapa.get(c) ?? 0) + 1)
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [fora])

  async function sair() {
    await createClient().auth.signOut()
    router.replace('/entrar')
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: MUDO }}>Carregando…</div>
  }

  if (semAcesso) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-gray-700">O relatório de viagens é visível para administradores da empresa.</p>
        <button onClick={() => router.push('/painel')}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#18283A' }}>
          Voltar para minhas reservas
        </button>
      </div>
    )
  }

  const rotuloPeriodo = periodo === 'tudo' ? 'Todo o histórico'
    : periodo === '30' ? 'Últimos 30 dias' : periodo === '90' ? 'Últimos 90 dias' : 'Últimos 6 meses'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F5F3' }}>
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-gray-200 no-imprimir"
        style={{ backgroundColor: '#F4F5F3' }}>
        <button type="button" onClick={() => router.push('/busca')} aria-label="Ir para a busca"
          className="cursor-pointer transition-opacity hover:opacity-85">
          <Image src="/logo-header.png" alt="Facilita Pass" width={163} height={36}
            className="h-7 sm:h-9 w-auto" style={{ objectFit: 'contain' }} />
        </button>
        <div className="flex items-center gap-4 sm:gap-6">
          <button onClick={() => router.push('/busca')} className="text-sm font-medium hover:opacity-60" style={{ color: '#18283A' }}>Buscar voos</button>
          <button onClick={() => router.push('/painel')} className="text-sm font-medium hover:opacity-60" style={{ color: '#18283A' }}>Minhas reservas</button>
          <button onClick={sair} className="text-sm hover:opacity-60" style={{ color: '#18283A' }}>Sair</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relatorio-imprimivel">

        {/* Título + filtros */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Relatório de viagens</h1>
            <p className="text-sm mt-0.5" style={{ color: TINTA }}>
              {empresa ? `${empresa} · ` : ''}{rotuloPeriodo}
              {escopo === 'emitidas' ? ' · passagens emitidas' : ' · todas as reservas'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 no-imprimir">
            {([['30', '30 dias'], ['90', '90 dias'], ['180', '6 meses'], ['tudo', 'Tudo']] as [Periodo, string][]).map(([id, rot]) => (
              <button key={id} onClick={() => setPeriodo(id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  periodo === id ? 'text-white border-transparent font-semibold' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                style={periodo === id ? { backgroundColor: '#18283A' } : { color: TINTA }}>
                {rot}
              </button>
            ))}
            <button onClick={() => setEscopo(e => e === 'emitidas' ? 'todas' : 'emitidas')}
              className="text-xs px-3 py-1.5 rounded-full border bg-white border-gray-200 hover:bg-gray-50"
              style={{ color: TINTA }}>
              {escopo === 'emitidas' ? 'Só emitidas' : 'Todas as reservas'}
            </button>
            <button onClick={() => window.print()}
              className="text-xs px-3 py-1.5 rounded-full text-white font-semibold hover:opacity-85"
              style={{ backgroundColor: '#18283A' }}>
              Exportar PDF
            </button>
          </div>
        </div>

        {viagens.length === 0 ? (
          <Cartao>
            <div className="py-12 text-center">
              <p className="text-gray-700 font-medium">Nenhuma viagem no período.</p>
              <p className="text-sm mt-2" style={{ color: MUDO }}>
                {escopo === 'emitidas'
                  ? 'O relatório conta passagens efetivamente emitidas. Use "Todas as reservas" para incluir as que ainda não foram pagas.'
                  : 'Tente um período maior.'}
              </p>
            </div>
          </Cartao>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <Kpi rotulo="Gasto no período" valor={brl(total)} apoio={`${viagens.length} ${viagens.length === 1 ? 'viagem' : 'viagens'}`} />
              <Kpi rotulo="Pessoas transportadas" valor={String(totalPassageiros)}
                apoio={totalPassageiros > viagens.length ? 'somando acompanhantes' : 'uma por viagem'} />
              <Kpi rotulo="Antecedência média"
                valor={antecMedia != null ? `${antecMedia} ${antecMedia === 1 ? 'dia' : 'dias'}` : '—'}
                apoio={antecMedia != null && antecMedia < 14 ? 'Compra tardia encarece a tarifa' : 'dias entre a compra e o voo'}
                alerta={antecMedia != null && antecMedia < 14} />
              <Kpi rotulo="Dentro da política" valor={`${pctDentro}%`}
                apoio={fora.length ? `${fora.length} fora — ${brl(fora.reduce((s, v) => s + v.valor, 0))}` : 'nenhuma exceção'}
                alerta={fora.length > 0} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2 mb-4">
              <Cartao titulo="Gasto por mês" nota="Pelo mês da compra">
                <LinhaMensal dados={porMes} />
              </Cartao>

              <Cartao titulo="Conformidade com a política" nota="Proporção de viagens dentro das regras da empresa">
                <div className="flex items-baseline gap-3 mt-3 mb-3">
                  <span className="text-3xl font-bold text-gray-900">{pctDentro}%</span>
                  <span className="text-sm" style={{ color: TINTA }}>dentro da política</span>
                </div>
                <div className="h-3 rounded-full flex gap-0.5 overflow-hidden" style={{ backgroundColor: CONTEXO }}>
                  <div style={{ width: `${pctDentro}%`, backgroundColor: SERIE }} />
                  <div style={{ width: `${100 - pctDentro}%`, backgroundColor: AVISO }} />
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: TINTA }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SERIE }} />
                    {viagens.length - fora.length} dentro
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: AVISO }} />
                    ⚠ {fora.length} fora
                  </span>
                </div>
                {porCategoria.length > 0 && (
                  <p className="text-xs mt-3" style={{ color: MUDO }}>
                    Motivo mais comum: {porCategoria[0][0]} ({porCategoria[0][1]}
                    {porCategoria[0][1] === 1 ? ' viagem' : ' viagens'})
                  </p>
                )}
              </Cartao>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 mb-4">
              <Cartao titulo="Gasto por viajante" nota="Oito maiores do período">
                <BarrasHorizontais dados={porViajante} formata={brl} />
              </Cartao>

              <Cartao titulo="Antecedência da compra" nota="Quantas viagens por faixa — e o ticket médio de cada">
                <Colunas dados={porAntecedencia} />
              </Cartao>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Cartao titulo="Rotas mais usadas" nota="Base para negociar acordo comercial">
                {porRota.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: MUDO }}>Sem dados.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Rota', 'Cia', 'Viagens', 'Gasto'].map((c, i) => (
                          <th key={c} className={`pb-2 text-[11px] uppercase tracking-wide font-semibold ${i > 1 ? 'text-right' : 'text-left'}`}
                            style={{ color: MUDO }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porRota.map(r => (
                        <tr key={r.rota} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5 font-semibold text-gray-900 tabular-nums">{r.rota}</td>
                          <td className="py-2.5" style={{ color: TINTA }}>{r.cias}</td>
                          <td className="py-2.5 text-right tabular-nums font-semibold text-gray-900">{r.viagens}</td>
                          <td className="py-2.5 text-right tabular-nums font-semibold text-gray-900">{brl(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Cartao>

              <Cartao titulo="Viagens fora da política" nota="Quem comprou, quanto custou e por quê">
                {fora.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: MUDO }}>
                    Nenhuma exceção no período.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {fora.slice(0, 8).map(v => (
                      <div key={v.chave} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{v.viajante}</p>
                            <p className="text-xs tabular-nums" style={{ color: TINTA }}>
                              {v.ida.origem} → {v.ida.destino}
                              {v.dataVoo && ` · ${v.dataVoo.getDate()} ${MESES[v.dataVoo.getMonth()]}`}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{brl(v.valor)}</span>
                        </div>
                        {v.categorias.length > 0 && (
                          <p className="text-xs mt-1" style={{ color: '#92400e' }}>{[...new Set(v.categorias)].join(' · ')}</p>
                        )}
                        {v.motivos.length > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: MUDO }}>{[...new Set(v.motivos)].join(' · ')}</p>
                        )}
                      </div>
                    ))}
                    {fora.length > 8 && (
                      <p className="text-xs pt-1" style={{ color: MUDO }}>+ {fora.length - 8} outras no período.</p>
                    )}
                  </div>
                )}
              </Cartao>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
