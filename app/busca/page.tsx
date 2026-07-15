'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../lib/supabase'
import { buscarAeroportos, Aeroporto } from '../../lib/aeroportos'

interface VooLeg {
  Numero: number
  NumeroDoVoo?: number
  HoraSaida: number
  HoraChegada: number
  CiaMandatoria: { CodigoIata: string; Descricao: string }
  BagagemInclusa: boolean
  BagagemQuantidade?: number
  BagagemPeso?: number
  Origem: { CodigoIata: string; Descricao: string }
  Destino: { CodigoIata: string; Descricao: string }
  Classe?: string
  BaseTarifaria?: string
  Familia?: string
  FamiliaCodigo?: string
  Cabine?: string
}

interface Viagem {
  Id: number
  CiaMandatoria: { CodigoIata: string; Descricao: string }
  Origem: { CodigoIata: string; Descricao: string }
  Destino: { CodigoIata: string; Descricao: string }
  TempoDeDuracao: string
  NumeroParadas: number
  Preco: { Total: number }
  Voos: VooLeg[]
  Segmentos?: { Voos: VooLeg[] }[]
  IdentificacaoDaViagem: string
  Familia?: string
  FamiliaCodigo?: string
  BagagemInclusa?: boolean
}

interface Tarifa {
  familia: string
  familiaCodigo: string
  preco: number
  bagagemInclusa: boolean
  bagagemPeso: number | null
  bagagemQuantidade: number | null
  baseTarifaria: string
  classe: string
  identificacaoDaViagem: string
  viagem: Viagem
}

interface VooAgrupado {
  id: string
  numeroVoo: string
  origem: string
  destino: string
  horaSaida: number
  horaChegada: number
  duracao: string
  companhia: string
  numParadas: number
  voos: VooLeg[]
  tarifas: Tarifa[]
}

interface PoliticaViagem {
  id: string; empresa_id: string; ativa: boolean
  limite_valor_nacional: number | null; limite_valor_internacional: number | null
  antecedencia_minima_dias: number | null; familias_permitidas: string[] | null; max_parcelas: number | null
}

interface Trecho { origem: string; destino: string; data: string }
type TipoViagem = 'ida' | 'idavolta' | 'multiplos'
type FaseSeleção = 'ida' | 'volta'
type Etapa = 'selecao' | 'passageiro' | 'pagamento' | 'confirmacao'
type Ordenacao = 'preco' | 'duracao' | 'custo' | 'escalas'

interface PassageiroForm {
  nome: string; sobrenome: string; cpf: string
  nascimento: string; email: string; telefone: string
  sexo: 'M' | 'F'; tipo: 'ADT' | 'CHD' | 'INF'
}
function passageiroVazio(tipo: 'ADT' | 'CHD' | 'INF' = 'ADT'): PassageiroForm {
  return { nome: '', sobrenome: '', cpf: '', nascimento: '', email: '', telefone: '', sexo: 'M', tipo }
}

function getLegs(viagem: Viagem): VooLeg[] {
  return viagem.Voos?.length ? viagem.Voos : (viagem.Segmentos ?? []).flatMap(s => s.Voos ?? [])
}
function formatHora(hora: number): string {
  const s = String(hora).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}
function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDuracao(tempo: string): string {
  if (!tempo) return ''
  const [h, m] = tempo.split(':')
  const mm = parseInt(m, 10)
  return mm === 0 ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h ${mm}m`
}
function diaSeguinte(data: string): string {
  if (!data) return ''
  const d = new Date(data + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
function nomeCompanhia(iata: string): string {
  return iata === 'JJ' ? 'LATAM' : iata
}
function duracaoMinutos(tempo: string): number {
  if (!tempo) return 0
  const [h, m] = tempo.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
function legMinutos(leg: VooLeg): number {
  const s = Math.floor(leg.HoraSaida / 100) * 60 + (leg.HoraSaida % 100)
  const c = Math.floor(leg.HoraChegada / 100) * 60 + (leg.HoraChegada % 100)
  let d = c - s; if (d < 0) d += 1440; return d
}
function conexaoMinutos(prev: VooLeg, next: VooLeg): number {
  const c = Math.floor(prev.HoraChegada / 100) * 60 + (prev.HoraChegada % 100)
  const s = Math.floor(next.HoraSaida / 100) * 60 + (next.HoraSaida % 100)
  let d = s - c; if (d < 0) d += 1440; return d
}
function formatMinutos(m: number): string {
  const h = Math.floor(m / 60), min = m % 60
  return min === 0 ? `${h}h` : `${h}h ${min}m`
}
function ordenarGrupos(grupos: VooAgrupado[], ord: Ordenacao): VooAgrupado[] {
  return [...grupos].sort((a, b) => {
    switch (ord) {
      case 'preco':   return (a.tarifas[0]?.preco ?? 0) - (b.tarifas[0]?.preco ?? 0)
      case 'duracao': return duracaoMinutos(a.duracao) - duracaoMinutos(b.duracao)
      case 'custo': {
        const da = duracaoMinutos(a.duracao) || 1
        const db = duracaoMinutos(b.duracao) || 1
        return ((a.tarifas[0]?.preco ?? 0) / da) - ((b.tarifas[0]?.preco ?? 0) / db)
      }
      case 'escalas': return (a.numParadas ?? 0) - (b.numParadas ?? 0)
      default: return 0
    }
  })
}

function mascaraCPF(v: string): string {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function mascaraTel(v: string): string {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{4})$/, '$1-$2')
}
function mascaraCartao(v: string): string {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}
function mascaraValidade(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2')
}

const AZUL = '#18283A'
const DOURADO = '#B79D7D'
const FUNDO = '#F4F5F3'

const CIA: Record<string, { label: string; bg: string }> = {
  G3: { label: 'GOL',   bg: '#F97316' },
  LA: { label: 'LATAM', bg: '#7B1022' },
  JJ: { label: 'LATAM', bg: '#7B1022' },
  AD: { label: 'AZUL',  bg: '#1D4ED8' },
  IB: { label: 'Iberia',bg: '#8B1A1A' },
}

const INPUT = 'mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm text-[#18283A] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[#7a8694]'

function AeroportoInput({ value, onChange, placeholder, icon }: { value: string; onChange: (iata: string) => void; placeholder: string; icon?: React.ReactNode }) {
  const [query, setQuery] = useState(value)
  const [aberto, setAberto] = useState(false)
  const [sugestoes, setSugestoes] = useState<Aeroporto[]>([])
  const [focusIdx, setFocusIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const digitandoRef = useRef(false)

  useEffect(() => {
    if (digitandoRef.current) { digitandoRef.current = false; return }
    if (!value) { setQuery(''); return }
    if (value.length === 3) {
      const exact = buscarAeroportos(value).find(a => a.iata === value)
      if (exact) { setQuery(`${exact.iata} - ${exact.nome}`); return }
    }
    setQuery(value)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function abrir(v: string) {
    const r = buscarAeroportos(v); setSugestoes(r); setAberto(r.length > 0)
  }
  function handleChange(v: string) {
    setQuery(v); abrir(v); setFocusIdx(-1)
    const upper = v.trim().toUpperCase()
    if (upper.length === 3) {
      const exact = buscarAeroportos(upper).find(a => a.iata === upper && !a.grupo)
      if (exact) { selecionar(exact); return }
    }
    const novoValor = upper.slice(0, 3)
    if (novoValor !== value) digitandoRef.current = true
    onChange(novoValor)
  }
  function selecionar(a: Aeroporto) {
    setQuery(`${a.iata} - ${a.nome}`); onChange(a.iata); setAberto(false); setSugestoes([])
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!aberto) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, sugestoes.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && focusIdx >= 0) { e.preventDefault(); selecionar(sugestoes[focusIdx]) }
    else if (e.key === 'Escape') setAberto(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-400 pointer-events-none">{icon}</span>}
      <input type="text" placeholder={placeholder} value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (query.length >= 2) abrir(query) }}
        onKeyDown={handleKeyDown} autoComplete="off" className={`${INPUT} ${icon ? 'pl-10' : ''}`} />
      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-50 mt-1 left-0 right-0 sm:right-auto sm:w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {sugestoes.map((a, i) => (
            <button key={a.iata} type="button" onMouseDown={() => selecionar(a)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === focusIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              {a.grupo ? (
                <span className="shrink-0 inline-flex items-center justify-center text-white rounded-lg px-2 py-1 min-w-[44px]" style={{ backgroundColor: DOURADO }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m-1 4h1m4-4h1m-1 4h1M9 21v-4h6v4" />
                  </svg>
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center justify-center bg-blue-600 text-white font-bold text-xs rounded-lg px-2 py-1 min-w-[44px]">{a.iata}</span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-[#18283A]">{a.nome}</p>
                <p className="text-xs text-[#6b7684]">{a.grupo ? `${a.grupo.join(', ')}` : `${a.cidade}${a.estado ? `, ${a.estado}` : ''} · ${a.pais}`}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const NOME_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function isoParaData(v: string): Date { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d) }
function dataParaIso(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function formatDataExibicao(v: string): string { if (!v) return ''; const [y, m, d] = v.split('-'); return `${d}/${m}/${y}` }
function mesmoDia(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }

function DatePicker({ value, onChange, minDate, placeholder, openSignal }: {
  value: string
  onChange: (v: string) => void
  minDate?: string
  placeholder?: string
  openSignal?: number
}) {
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dataMinima = minDate ? isoParaData(minDate) : hoje
  const base = value ? isoParaData(value) : dataMinima
  const [mesAtual, setMesAtual] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1))

  const [minDateSincronizado, setMinDateSincronizado] = useState(minDate)
  if (minDate !== minDateSincronizado) {
    setMinDateSincronizado(minDate)
    if (minDate) { const d = isoParaData(minDate); setMesAtual(new Date(d.getFullYear(), d.getMonth(), 1)) }
  }

  const [openSignalSincronizado, setOpenSignalSincronizado] = useState(openSignal)
  if (openSignal !== openSignalSincronizado) {
    setOpenSignalSincronizado(openSignal)
    if (openSignal !== undefined) setAberto(true)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth()
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (Date | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => new Date(ano, mes, i + 1)),
  ]
  const valorSelecionado = value ? isoParaData(value) : null

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setAberto(o => !o)}
        className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm text-left bg-white flex items-center gap-2 focus:outline-none focus:ring-2 transition-colors"
        style={{ boxShadow: aberto ? `0 0 0 2px ${DOURADO}55` : undefined }}>
        <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="5" width="18" height="16" rx="2" /><path strokeLinecap="round" d="M3 9h18M8 3v4M16 3v4" />
        </svg>
        <span className={value ? 'text-gray-900' : 'text-[#7a8694]'}>{value ? formatDataExibicao(value) : (placeholder ?? 'dd/mm/aaaa')}</span>
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setAberto(false)} />
          <div className="fixed inset-x-4 bottom-4 z-50 sm:absolute sm:inset-auto sm:bottom-auto sm:left-0 sm:mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 sm:w-80">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-sm font-semibold" style={{ color: AZUL }}>{NOME_MESES[mes]} {ano}</span>
              <button type="button" onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS_SEMANA.map((d, i) => <div key={i} className="text-center text-[10px] font-semibold text-gray-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((d, i) => {
                if (!d) return <div key={i} />
                const bloqueado = d < dataMinima
                const selecionado = valorSelecionado ? mesmoDia(d, valorSelecionado) : false
                return (
                  <button key={i} type="button" disabled={bloqueado}
                    onClick={() => { onChange(dataParaIso(d)); setAberto(false) }}
                    className={`h-10 sm:h-8 rounded-lg text-xs font-medium transition-colors ${
                      bloqueado ? 'text-gray-300 cursor-not-allowed' : selecionado ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    style={selecionado ? { backgroundColor: AZUL } : {}}>
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AirlineBadge({ iata }: { iata: string }) {
  const c = CIA[iata] ?? { label: nomeCompanhia(iata), bg: '#4B5563' }
  return (
    <span className="inline-flex items-center justify-center rounded-md text-white font-bold text-xs px-2 py-1 min-w-[48px]"
      style={{ backgroundColor: c.bg }}>{c.label}</span>
  )
}

function resumoPassageiros(adultos: number, criancas: number, bebes: number): string {
  return [
    `${adultos} ${adultos === 1 ? 'adulto' : 'adultos'}`,
    criancas > 0 ? `${criancas} ${criancas === 1 ? 'criança' : 'crianças'}` : null,
    bebes > 0 ? `${bebes} ${bebes === 1 ? 'bebê' : 'bebês'}` : null,
  ].filter(Boolean).join(', ')
}

function PassageirosDropdown({ adultos, criancas, bebes, setAdultos, setCriancas, setBebes }: {
  adultos: number; criancas: number; bebes: number
  setAdultos: (v: number) => void; setCriancas: (v: number) => void; setBebes: (v: number) => void
}) {
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const total = adultos + criancas + bebes
  const linhas = [
    { label: 'Adultos', sub: 'Acima de 12 anos', val: adultos, set: setAdultos, min: 1, max: 9 - criancas - bebes },
    { label: 'Crianças', sub: '2 a 11 anos', val: criancas, set: setCriancas, min: 0, max: 9 - adultos - bebes },
    { label: 'Bebês', sub: 'Até 2 anos, no colo', val: bebes, set: setBebes, min: 0, max: Math.min(adultos, 9 - adultos - criancas) },
  ]

  return (
    <div ref={containerRef} className="relative">
      <label className="text-sm font-medium text-gray-700">Passageiros</label>
      <button type="button" onClick={() => setAberto(o => !o)}
        className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm text-left bg-white flex items-center justify-between gap-2 focus:outline-none transition-colors"
        style={{ boxShadow: aberto ? `0 0 0 2px ${DOURADO}55` : undefined }}>
        <span className="flex items-center gap-2 text-gray-900 truncate">
          <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 10-4-4 4 4 0 004 4zm6-4a4 4 0 11-4-4" />
          </svg>
          {resumoPassageiros(adultos, criancas, bebes)}
        </span>
        <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 left-0 right-0 sm:w-80 bg-white rounded-xl shadow-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {linhas.map(({ label, sub, val, set, min, max }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <div><p className="text-sm font-medium text-gray-800">{label}</p><p className="text-xs text-[#6b7684]">{sub}</p></div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => val > min && set(val - 1)} disabled={val <= min}
                  className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 text-lg font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">−</button>
                <span className="w-5 text-center text-sm font-bold text-gray-900">{val}</span>
                <button type="button" onClick={() => val < max && set(val + 1)} disabled={val >= max}
                  className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 text-lg font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">+</button>
              </div>
            </div>
          ))}
          {total >= 9 && <p className="px-4 py-2 text-amber-600 text-xs font-medium">Máximo de 9 passageiros atingido.</p>}
          <div className="px-4 py-2.5 bg-gray-50">
            <button type="button" onClick={() => setAberto(false)} className="w-full text-center text-xs font-semibold py-1.5 rounded-lg text-white transition-opacity hover:opacity-90" style={{ backgroundColor: AZUL }}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 animate-pulse border border-gray-100">
      <div className="flex items-center gap-4 mb-3">
        <div className="w-12 h-6 bg-gray-200 rounded-md" />
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-4 bg-gray-200 rounded" />
          <div className="flex-1 h-px bg-gray-200" />
          <div className="w-10 h-4 bg-gray-200 rounded" />
        </div>
        <div className="w-16 h-4 bg-gray-200 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="w-24 h-14 bg-gray-100 rounded-lg" />
        <div className="w-24 h-14 bg-gray-100 rounded-lg" />
      </div>
    </div>
  )
}

// ── Helpers de política ───────────────────────────────────────────
function isAeroportoBrasileiro(iata: string): boolean {
  const exact = buscarAeroportos(iata).find(a => a.iata === iata)
  return exact?.pais === 'Brasil'
}

function verificarViolacoes(
  voo: VooAgrupado,
  tarifa: Tarifa,
  politica: PoliticaViagem,
  dataVoo: string,
): string[] {
  if (!politica.ativa) return []
  const violacoes: string[] = []

  const isNacional = isAeroportoBrasileiro(voo.origem) && isAeroportoBrasileiro(voo.destino)
  const limite = isNacional ? politica.limite_valor_nacional : politica.limite_valor_internacional
  if (limite != null && tarifa.preco > limite) {
    violacoes.push(`valor ${formatPreco(tarifa.preco)} acima do limite de ${formatPreco(limite)}`)
  }

  if (politica.antecedencia_minima_dias != null && dataVoo) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const vooDate = new Date(dataVoo + 'T12:00:00')
    const dias = Math.round((vooDate.getTime() - hoje.getTime()) / 86400000)
    if (dias < politica.antecedencia_minima_dias) {
      violacoes.push(`antecedência de ${dias} dia${dias !== 1 ? 's' : ''} abaixo do mínimo de ${politica.antecedencia_minima_dias} dias`)
    }
  }

  const permitidas = politica.familias_permitidas
  if (permitidas && permitidas.length > 0) {
    const familia = (tarifa.familia || tarifa.familiaCodigo || '').toLowerCase()
    if (familia) {
      const ok = permitidas.some(p => {
        const pl = p.toLowerCase()
        if (pl === 'light')    return familia.includes('light') || familia.includes('lite')
        if (pl === 'standard') return familia.includes('standard') || familia.includes('classic') || familia.includes('basic')
        if (pl === 'plus')     return familia.includes('plus') || familia.includes('full') || familia.includes('premium') || familia.includes('confort')
        return familia.includes(pl)
      })
      if (!ok) violacoes.push(`família "${tarifa.familia || tarifa.familiaCodigo}" fora das famílias permitidas`)
    }
  }

  return violacoes
}

// ── VooCard minimalista ───────────────────────────────────────────
function VooCard({ voo, onSelecionar, labelBotao = 'Selecionar', onVerDetalhes, politica, dataVoo, onViolacao }: {
  voo: VooAgrupado
  onSelecionar: (v: Viagem) => void
  labelBotao?: string
  onVerDetalhes?: (v: Viagem) => void
  politica?: PoliticaViagem | null
  dataVoo?: string
  onViolacao?: (viagem: Viagem, motivos: string[]) => void
}) {
  const escalas      = voo.numParadas
  const escalasLabel = escalas === 0 ? 'Direto' : escalas === 1 ? '1 escala' : `${escalas} escalas`
  const escalasCor   = escalas === 0 ? '#16a34a' : '#d97706'

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">

      {/* Cabeçalho compacto */}
      <div className="px-4 py-3 flex items-center gap-3">
        <AirlineBadge iata={voo.companhia} />

        {/* Horários */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatHora(voo.horaSaida)}</span>
          <span className="text-gray-300 text-xs">→</span>
          <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatHora(voo.horaChegada)}</span>
          <span className="text-xs text-gray-400 ml-1">{voo.origem}·{voo.destino}</span>
        </div>

        {/* Duração + escalas */}
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">{formatDuracao(voo.duracao)}</p>
          <p className="text-xs font-medium" style={{ color: escalasCor }}>{escalasLabel}</p>
        </div>
      </div>

      {/* Linha info: número do voo + ver detalhes */}
      {(voo.numeroVoo || (escalas > 0 && onVerDetalhes)) && (
        <div className="px-4 pb-2 flex items-center gap-2 text-xs text-gray-400">
          {voo.numeroVoo && <span>{nomeCompanhia(voo.companhia)} {voo.numeroVoo}</span>}
          {escalas > 0 && onVerDetalhes && voo.tarifas[0] && (
            <>
              {voo.numeroVoo && <span>·</span>}
              <button onClick={() => onVerDetalhes(voo.tarifas[0].viagem)}
                className="text-blue-500 hover:text-blue-700 underline transition-colors">
                Ver detalhes
              </button>
            </>
          )}
        </div>
      )}

      {/* Tarifas — colunas finas */}
      <div className="flex overflow-x-auto border-t border-gray-100 divide-x divide-gray-100">
        {voo.tarifas.map((tarifa, i) => {
          const violacoes  = politica && dataVoo ? verificarViolacoes(voo, tarifa, politica, dataVoo) : []
          const foraPolicy = violacoes.length > 0
          const nomeFam    = tarifa.familia || tarifa.familiaCodigo || '—'
          const menor      = i === 0

          return (
            <button key={tarifa.identificacaoDaViagem || i}
              onClick={() => {
                if (foraPolicy && onViolacao) onViolacao(tarifa.viagem, violacoes)
                else onSelecionar(tarifa.viagem)
              }}
              className={`flex-1 min-w-[110px] flex flex-col items-center gap-1 px-2.5 py-2.5 text-center transition-colors ${
                menor ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white hover:bg-gray-50'
              }`}>

              {/* Badge fora da política */}
              {foraPolicy && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm leading-tight"
                  style={{ backgroundColor: '#fef9c3', color: '#92400e' }}>⚠️ Fora da política</span>
              )}

              {/* Nome da família */}
              <p className={`text-[10px] font-bold uppercase tracking-widest leading-none ${
                menor ? 'text-slate-700' : 'text-gray-400'
              }`}>{nomeFam}</p>

              {/* Preço */}
              <p className={`text-base font-bold leading-tight tabular-nums ${
                menor ? 'text-slate-900' : 'text-gray-700'
              }`}>{formatPreco(tarifa.preco)}</p>

              {/* Bagagem */}
              <div className="flex items-center gap-1">
                {tarifa.bagagemInclusa ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="5" y="7" width="14" height="13" rx="2"/>
                      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="12" y1="11" x2="12" y2="16"/>
                      <line x1="9.5" y1="13.5" x2="14.5" y2="13.5"/>
                    </svg>
                    <span className="text-[10px] text-blue-600 font-medium">
                      {tarifa.bagagemQuantidade && tarifa.bagagemPeso
                        ? `${tarifa.bagagemQuantidade}x ${tarifa.bagagemPeso}kg`
                        : tarifa.bagagemPeso ? `${tarifa.bagagemPeso}kg`
                        : tarifa.bagagemQuantidade ? `${tarifa.bagagemQuantidade} mala${tarifa.bagagemQuantidade > 1 ? 's' : ''}`
                        : 'Inclusa'}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="relative w-3.5 h-3.5">
                      <svg className="w-3.5 h-3.5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="5" y="7" width="14" height="13" rx="2"/>
                        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      <svg className="absolute inset-0 w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24">
                        <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="text-[10px] text-gray-400">Sem bagagem</span>
                  </>
                )}
              </div>

              {/* Botão */}
              <span className={`mt-0.5 text-[10px] font-semibold px-2.5 py-1 rounded-md ${
                menor ? 'text-white' : 'bg-gray-100 text-gray-500'
              }`} style={menor ? { backgroundColor: '#18283A' } : {}}>
                {labelBotao}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ResumoIdaSelecionada({ viagem, onAlterar }: { viagem: Viagem; onAlterar: () => void }) {
  const legs = getLegs(viagem); const first = legs[0]; const last = legs[legs.length - 1]
  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3 mb-4"
      style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
      <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-xs font-semibold text-green-700">Ida selecionada</span>
        <AirlineBadge iata={viagem.CiaMandatoria?.CodigoIata ?? ''} />
        <span className="font-semibold text-gray-800 tabular-nums">
          {first ? formatHora(first.HoraSaida) : '--'} → {last ? formatHora(last.HoraChegada) : '--'}
        </span>
        <span className="text-gray-500">{viagem.Origem?.CodigoIata} → {viagem.Destino?.CodigoIata}</span>
        <span className="font-semibold text-gray-800">{formatPreco(viagem.Preco?.Total ?? 0)}</span>
      </div>
      <button onClick={onAlterar} className="text-xs font-medium text-green-700 underline shrink-0">Alterar</button>
    </div>
  )
}

function ResumoVoo({ viagem, label }: { viagem: Viagem; label: string }) {
  const legs = getLegs(viagem); const first = legs[0]; const last = legs[legs.length - 1]
  return (
    <div className="flex items-center gap-3 py-2">
      <AirlineBadge iata={viagem.CiaMandatoria?.CodigoIata ?? ''} />
      <div className="flex-1">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800">
          {viagem.Origem?.CodigoIata} → {viagem.Destino?.CodigoIata}
          <span className="font-normal text-gray-500 ml-2 tabular-nums">
            {first ? formatHora(first.HoraSaida) : '--'} → {last ? formatHora(last.HoraChegada) : '--'}
          </span>
          <span className="text-gray-400 ml-2">· {formatDuracao(viagem.TempoDeDuracao)}</span>
        </p>
      </div>
      <p className="text-sm font-bold text-gray-900">{formatPreco(viagem.Preco?.Total ?? 0)}</p>
    </div>
  )
}

function IndicadorEtapas({ etapa }: { etapa: Etapa }) {
  const steps = [{ id: 'selecao', label: 'Seleção' }, { id: 'passageiro', label: 'Passageiro' }, { id: 'pagamento', label: 'Pagamento' }]
  const idx = etapa === 'confirmacao' ? 2 : steps.findIndex(s => s.id === etapa)
  return (
    <div className="flex items-center justify-center py-6">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i < idx ? 'bg-green-500 text-white' : i === idx ? 'text-white' : 'bg-gray-200 text-gray-400'
            }`} style={i === idx ? { backgroundColor: '#18283A' } : {}}>
              {i < idx ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap ${i === idx ? 'text-gray-700 font-semibold' : i < idx ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{step.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`w-8 sm:w-20 h-px mx-2 sm:mx-3 mb-5 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

function VooDetalhesModal({ viagem, onFechar }: { viagem: Viagem; onFechar: () => void }) {
  const legs = getLegs(viagem)
  const iata = viagem.CiaMandatoria?.CodigoIata ?? ''
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Detalhes do voo</h2>
            <p className="text-xs text-gray-400 mt-0.5">{viagem.Origem?.CodigoIata} → {viagem.Destino?.CodigoIata} · {formatDuracao(viagem.TempoDeDuracao)}</p>
          </div>
          <button onClick={onFechar} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">
          {legs.map((leg, i) => {
            const isLast = i === legs.length - 1
            const connMin = !isLast ? conexaoMinutos(leg, legs[i + 1]) : 0
            return (
              <div key={i}>
                {i === 0 && (
                  <div className="flex gap-4 mb-2">
                    <div className="flex flex-col items-center w-7">
                      <div className="w-3 h-3 rounded-full border-2 border-blue-600 bg-white mt-0.5 shrink-0" />
                      <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: 36 }} />
                    </div>
                    <div className="pb-2">
                      <p className="text-base font-bold text-gray-900">{formatHora(leg.HoraSaida)}</p>
                      <p className="text-sm text-gray-700">{leg.Origem?.CodigoIata}{leg.Origem?.Descricao ? <span className="text-gray-400"> · {leg.Origem.Descricao}</span> : ''}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{nomeCompanhia(iata)} {leg.Numero || leg.NumeroDoVoo || ''}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-4 mb-2">
                  <div className="flex justify-center w-7"><div className="w-0.5 bg-gray-200" style={{ height: 20 }} /></div>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-0.5 rounded-full self-center">{formatMinutos(legMinutos(leg))}</span>
                </div>
                <div className="flex gap-4 mb-2">
                  <div className="flex flex-col items-center w-7">
                    <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 ${isLast ? 'bg-blue-600 border-blue-600' : 'bg-white border-orange-400'}`} />
                    {!isLast && <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: 36 }} />}
                  </div>
                  <div className="pb-2">
                    <p className="text-base font-bold text-gray-900">{formatHora(leg.HoraChegada)}</p>
                    <p className="text-sm text-gray-700">{leg.Destino?.CodigoIata}{leg.Destino?.Descricao ? <span className="text-gray-400"> · {leg.Destino.Descricao}</span> : ''}</p>
                    {!isLast && (
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${connMin < 60 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'}`}>
                          Conexão · {formatMinutos(connMin)}{connMin < 60 && ' · Curta'}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">Próximo: {nomeCompanhia(iata)} {legs[i + 1].Numero || legs[i + 1].NumeroDoVoo || ''} · {formatHora(legs[i + 1].HoraSaida)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div className="mt-3 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-800">{formatDuracao(viagem.TempoDeDuracao)}</span></span>
            <AirlineBadge iata={iata} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Busca() {
  const router = useRouter()
  const [tipo, setTipo]           = useState<TipoViagem>('idavolta')
  const [origem, setOrigem]       = useState('')
  const [destino, setDestino]     = useState('')
  const [dataIda, setDataIda]     = useState('')
  const [dataVolta, setDataVolta] = useState('')
  const [adultos, setAdultos]     = useState(1)
  const [criancas, setCriancas]   = useState(0)
  const [bebes, setBebes]         = useState(0)
  const [trechos, setTrechos]     = useState<Trecho[]>([{ origem: '', destino: '', data: '' }, { origem: '', destino: '', data: '' }])
  const [carregando, setCarregando]     = useState(false)
  const [erroVoo, setErroVoo]           = useState('')
  const [gruposIda, setGruposIda]       = useState<VooAgrupado[] | null>(null)
  const [gruposVolta, setGruposVolta]   = useState<VooAgrupado[] | null>(null)
  const [fase, setFase]                               = useState<FaseSeleção>('ida')
  const [vooIdaSelecionado, setVooIdaSelecionado]     = useState<Viagem | null>(null)
  const [vooVoltaSelecionado, setVooVoltaSelecionado] = useState<Viagem | null>(null)
  const [ordenacao, setOrdenacao]                     = useState<Ordenacao>('preco')
  const [vooDetalhes, setVooDetalhes]                 = useState<Viagem | null>(null)
  const [etapa, setEtapa] = useState<Etapa>('selecao')
  const [passageiros, setPassageiros]             = useState<PassageiroForm[]>([passageiroVazio()])
  const [carregandoReserva, setCarregandoReserva] = useState(false)
  const [erroReserva,       setErroReserva]       = useState('')
  const [localizador,       setLocalizador]        = useState('')
  const [cartaoNumero,   setCartaoNumero]   = useState('')
  const [cartaoBandeira, setCartaoBandeira] = useState('VI')
  const [cartaoTitular,  setCartaoTitular]  = useState('')
  const [cartaoValidade, setCartaoValidade] = useState('')
  const [cartaoCVV,      setCartaoCVV]      = useState('')
  const [carregandoEmissao, setCarregandoEmissao] = useState(false)
  const [erroEmissao,       setErroEmissao]       = useState('')
  const [numeroBilhete,     setNumeroBilhete]      = useState('')
  const [nomeBilhete,       setNomeBilhete]        = useState('')
  const [formasFinanciamento, setFormasFinanciamento] = useState<{ FinanciamentoId: number; Parcelas: number; PrimeiraParcela: number; DemaisParcela: number }[]>([])
  const [financiamentoId,     setFinanciamentoId]     = useState<number>(61)
  const [parcelas,            setParcelas]            = useState<number>(1)
  const [chaveDeSeguranca,    setChaveDeSeguranca]    = useState<string | null>(null)
  const [codigoPagamento,     setCodigoPagamento]     = useState<number>(2)
  const [carregandoFormas,    setCarregandoFormas]    = useState(false)
  const [politica, setPolitica] = useState<PoliticaViagem | null>(null)
  const [avisoPolitica, setAvisoPolitica] = useState<{ viagem: Viagem; motivos: string[]; onContinuar: () => void } | null>(null)
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [voltaAbrirSignal, setVoltaAbrirSignal] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/'); return }
      const userId = data.session.user.id
      const [{ data: pol }, { data: usuario }] = await Promise.all([
        supabase.from('politicas_viagem').select('*').eq('ativa', true).maybeSingle(),
        supabase.from('usuarios_empresas').select('nome').eq('user_id', userId).maybeSingle(),
      ])
      if (pol) setPolitica(pol as PoliticaViagem)
      setNomeUsuario((usuario as { nome: string | null } | null)?.nome ?? null)
    })
  }, [router])

  useEffect(() => {
    setPassageiros([
      ...Array.from({ length: adultos },  () => passageiroVazio('ADT')),
      ...Array.from({ length: criancas }, () => passageiroVazio('CHD')),
      ...Array.from({ length: bebes },    () => passageiroVazio('INF')),
    ])
  }, [adultos, criancas, bebes])

  useEffect(() => {
    if (etapa !== 'pagamento' || !localizador) return
    setCarregandoFormas(true); setErroEmissao('')
    fetch('/api/iniciar-emissao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localizador }) })
      .then(r => r.json())
      .then(data => {
        if (data.erro) { setErroEmissao(data.erro); return }
        setChaveDeSeguranca(data.chaveDeSeguranca ?? null)
        setCodigoPagamento(data.codigoPagamento ?? 2)
        const formas: { FinanciamentoId: number; Parcelas: number; PrimeiraParcela: number; DemaisParcela: number }[] = data.formasFinanciamento ?? []
        setFormasFinanciamento(formas)
        if (formas.length > 0) { setFinanciamentoId(formas[0].FinanciamentoId); setParcelas(formas[0].Parcelas) }
      })
      .catch(() => setErroEmissao('Erro ao carregar opções de pagamento'))
      .finally(() => setCarregandoFormas(false))
  }, [etapa, localizador])

  useEffect(() => {
    if (!localizador) return
    if (cartaoNumero.replace(/\D/g, '').length < 16) return
    if (cartaoValidade.length < 5) return
    if (!cartaoCVV) return
    const t = setTimeout(() => {
      buscarFormasComCartao(cartaoNumero, cartaoValidade, cartaoTitular, cartaoCVV, cartaoBandeira)
    }, 500)
    return () => clearTimeout(t)
  }, [cartaoNumero, cartaoValidade, cartaoCVV, cartaoBandeira, localizador])

  function atualizarTrecho(idx: number, campo: keyof Trecho, v: string) {
    setTrechos(prev => prev.map((t, i) => i === idx ? { ...t, [campo]: v } : t))
  }
  function adicionarTrecho() { if (trechos.length < 6) setTrechos(prev => [...prev, { origem: '', destino: '', data: '' }]) }
  function removerTrecho(idx: number) { setTrechos(prev => prev.filter((_, i) => i !== idx)) }
  function atualizarPassageiro(idx: number, campo: keyof PassageiroForm, valor: string) {
    setPassageiros(prev => prev.map((p, i) => i === idx ? { ...p, [campo]: valor } : p))
  }

  async function buscarVoos() {
    if (tipo === 'multiplos') {
      if (trechos.some(t => !t.origem || !t.destino || !t.data)) { setErroVoo('Preencha todos os campos dos trechos.'); return }
    } else if (!origem || !destino || !dataIda) { setErroVoo('Preencha origem, destino e data de ida.'); return }
    setCarregando(true); setErroVoo(''); setGruposIda(null); setGruposVolta(null)
    setFase('ida'); setVooIdaSelecionado(null); setVooVoltaSelecionado(null)
    const res = await fetch('/api/buscar-voos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem:  tipo === 'multiplos' ? trechos[0].origem  : origem,
        destino: tipo === 'multiplos' ? trechos[0].destino : destino,
        dataIda: tipo === 'multiplos' ? trechos[0].data    : dataIda,
        dataVolta: tipo === 'idavolta' ? dataVolta : undefined,
        adultos, criancas, bebes, tipo,
      }),
    })
    const data = await res.json()
    setCarregando(false)
    if (data.erro) setErroVoo(data.erro)
    else { setGruposIda(data.grupos ?? []); setGruposVolta(data.gruposVolta ?? []) }
  }

  function selecionarVooIda(viagem: Viagem) {
    setVooIdaSelecionado(viagem)
    if (tipo === 'idavolta') setFase('volta'); else setEtapa('passageiro')
  }
  function selecionarVooVolta(viagem: Viagem) { setVooVoltaSelecionado(viagem); setEtapa('passageiro') }

  async function gerarReserva() {
    for (const p of passageiros) {
      if (!p.nome || !p.sobrenome || !p.nascimento) { setErroReserva('Preencha todos os campos obrigatórios.'); return }
      if (p.tipo !== 'INF' && !p.cpf) { setErroReserva('Preencha todos os campos obrigatórios.'); return }
      if (p.tipo === 'ADT' && (!p.email || !p.telefone)) { setErroReserva('Preencha todos os campos obrigatórios.'); return }
    }
    setCarregandoReserva(true); setErroReserva('')
    let loc = ''
    try {
      const res = await fetch('/api/tarifar-reservar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vooIda: vooIdaSelecionado, vooVolta: vooVoltaSelecionado, passageiros }),
      })
      const data = await res.json()
      if (data.erro) { setErroReserva(data.erro); setCarregandoReserva(false); return }
      loc = data.localizador || ''
    } catch (err: unknown) {
      setErroReserva(err instanceof Error ? err.message : 'Erro ao conectar')
      setCarregandoReserva(false); return
    }
    if (!loc) { setErroReserva('Não foi possível gerar a reserva'); setCarregandoReserva(false); return }
    setLocalizador(loc)
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session) {
        const primAdulto = passageiros.find(p => p.tipo === 'ADT')
        const valorTotal = (vooIdaSelecionado?.Preco?.Total ?? 0) + (vooVoltaSelecionado?.Preco?.Total ?? 0)
        await supabase.from('reservas').insert({
          user_id: sessionData.session.user.id, localizador: loc,
          origem: vooIdaSelecionado?.Origem?.CodigoIata ?? '', destino: vooIdaSelecionado?.Destino?.CodigoIata ?? '',
          data_voo: dataIda || null,
          passageiro_nome: primAdulto ? `${primAdulto.nome} ${primAdulto.sobrenome}`.trim() : null,
          valor: valorTotal > 0 ? valorTotal : null, status: 'Ativa',
        })
      }
    } catch {}
    setCarregandoReserva(false); setEtapa('pagamento')
  }

  async function emitirPassagem() {
    if (!cartaoNumero || !cartaoTitular || !cartaoValidade || !cartaoCVV) { setErroEmissao('Preencha todos os dados do cartão.'); return }
    setCarregandoEmissao(true); setErroEmissao('')
    const res = await fetch('/api/iniciar-emitir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localizador, chaveDeSeguranca, codigoPagamento, financiamentoId,
        cartao: { numero: cartaoNumero, titular: cartaoTitular, validade: cartaoValidade, cvv: cartaoCVV, parcelas, bandeira: cartaoBandeira } }),
    })
    const data = await res.json()
    setCarregandoEmissao(false)
    if (data.erro) { setErroEmissao(data.erro) }
    else {
      setNumeroBilhete(data.bilhete); setNomeBilhete(data.passageiro); setEtapa('confirmacao')
      try { await createClient().from('reservas').update({ status: 'Emitida' }).eq('localizador', localizador) } catch {}
    }
  }

  function novaBusca() {
    setEtapa('selecao'); setGruposIda(null); setGruposVolta(null)
    setVooIdaSelecionado(null); setVooVoltaSelecionado(null); setFase('ida')
    setLocalizador(''); setNumeroBilhete(''); setNomeBilhete('')
    setAdultos(1); setCriancas(0); setBebes(0); setPassageiros([passageiroVazio('ADT')])
    setOrigem(''); setDestino(''); setDataIda(''); setDataVolta('')
    setCartaoNumero(''); setCartaoTitular(''); setCartaoValidade(''); setCartaoCVV('')
    setFormasFinanciamento([]); setFinanciamentoId(61); setParcelas(1)
    setChaveDeSeguranca(null); setCodigoPagamento(2)
  }

  async function buscarFormasComCartao(numero: string, validade: string, titular: string, cvv: string, bandeira: string) {
    if (!localizador) return
    if (numero.replace(/\D/g, '').length < 16 || validade.length < 5 || !cvv) return
    setCarregandoFormas(true)
    try {
      const res = await fetch('/api/iniciar-emissao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localizador, cartao: { numero, validade, titular, cvv, bandeira } }),
      })
      const data = await res.json()
      if (data.erro) return
      const formas: { FinanciamentoId: number; Parcelas: number; PrimeiraParcela: number; DemaisParcela: number }[] = data.formasFinanciamento ?? []
      setFormasFinanciamento(formas)
      if (formas.length > 0) { setFinanciamentoId(formas[0].FinanciamentoId); setParcelas(formas[0].Parcelas) }
    } finally {
      setCarregandoFormas(false)
    }
  }

  const minDataVolta    = diaSeguinte(dataIda)
  const gruposExibidos  = fase === 'volta' ? gruposVolta : gruposIda
  const gruposOrdenados = gruposExibidos ? ordenarGrupos(gruposExibidos, ordenacao) : null
  const totalEncontrado = gruposExibidos?.length ?? 0
  const precoTotal      = (vooIdaSelecionado?.Preco?.Total ?? 0) + (vooVoltaSelecionado?.Preco?.Total ?? 0)

  const ORDENACAO_OPTS: { id: Ordenacao; label: string }[] = [
    { id: 'preco', label: 'Menor preço' }, { id: 'duracao', label: 'Menor duração' },
    { id: 'custo', label: 'Melhor custo-benefício' }, { id: 'escalas', label: 'Menos escalas' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: FUNDO }}>
      <div className="relative px-4 sm:px-8 py-4 flex items-center justify-between border-b border-gray-200" style={{ backgroundColor: FUNDO }}>
        <Image src="/logo-header.png" alt="Facilita Pass" width={260} height={42} className="h-9 sm:h-11 w-auto" style={{ objectFit: 'contain' }} />

        <div className="hidden sm:flex items-center gap-5">
          <button onClick={() => router.push('/painel')} className="text-sm font-medium hover:opacity-60 transition-colors" style={{ color: AZUL }}>Minhas reservas</button>
          <button onClick={async () => { await createClient().auth.signOut(); router.replace('/') }} className="text-sm hover:opacity-60 transition-colors" style={{ color: AZUL }}>Sair</button>
        </div>

        <button type="button" aria-label="Menu" onClick={() => setMenuMobileAberto(o => !o)}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors" style={{ color: AZUL }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuMobileAberto
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>

        {menuMobileAberto && (
          <div className="sm:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-md flex flex-col z-40">
            <button onClick={() => { setMenuMobileAberto(false); router.push('/painel') }} className="text-left px-5 py-3 text-sm font-medium border-b border-gray-100" style={{ color: AZUL }}>Minhas reservas</button>
            <button onClick={async () => { setMenuMobileAberto(false); await createClient().auth.signOut(); router.replace('/') }} className="text-left px-5 py-3 text-sm" style={{ color: AZUL }}>Sair</button>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {etapa === 'selecao' && (
          <div className="py-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: AZUL }}>{nomeUsuario ? `Olá, ${nomeUsuario} 👋` : 'Olá 👋'}</h1>
                <p className="text-sm text-gray-500 mt-1">Encontre as melhores tarifas para sua próxima viagem corporativa.</p>
              </div>
              <a href="https://wa.me/5544991272314?text=Ol%C3%A1%2C%20vim%20do%20suporte%20do%20sistema%2C%20e%20estou%20com%20uma%20d%C3%BAvida"
                target="_blank" rel="noopener noreferrer"
                className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#25D366' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 004.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2m0 1.67c2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24M8.53 6.87c-.16 0-.43.06-.65.31s-.86.85-.86 2.07.89 2.4 1.01 2.56 1.75 2.8 4.35 3.83c2.15.85 2.59.68 3.06.64s1.5-.61 1.71-1.2.21-1.09.15-1.2-.24-.17-.5-.3-1.5-.74-1.74-.82-.4-.13-.58.13-.68.82-.83 1-.31.19-.57.06a7.28 7.28 0 01-2.13-1.32 8.03 8.03 0 01-1.47-1.83c-.15-.26-.01-.4.12-.53.12-.12.27-.31.4-.47s.17-.26.26-.44.04-.33-.02-.46-.58-1.4-.79-1.92-.42-.44-.58-.45-.33-.01-.5-.01" /></svg>
                Suporte
              </a>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex gap-2 flex-wrap">
                {([{ v: 'idavolta', l: 'Ida e volta' }, { v: 'ida', l: 'Só ida' }, { v: 'multiplos', l: 'Múltiplos destinos' }] as const).map(op => (
                  <button key={op.v} onClick={() => setTipo(op.v)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tipo === op.v ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    style={tipo === op.v ? { backgroundColor: AZUL } : {}}>{op.l}</button>
                ))}
              </div>

              {tipo !== 'multiplos' && (
                <>
                  <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-3 items-center">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Origem</label>
                      <AeroportoInput value={origem} onChange={setOrigem} placeholder="Ex: GRU ou São Paulo"
                        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-3 2v1.5l4.5-1.5 4.5 1.5V21l-3-2v-5.5z" /></svg>} />
                    </div>
                    <button type="button" onClick={() => { setOrigem(destino); setDestino(origem) }}
                      aria-label="Trocar origem e destino"
                      className="mx-auto sm:mx-0 sm:mt-6 w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-transform duration-300 rotate-90 sm:rotate-0 hover:rotate-[270deg] sm:hover:rotate-180"
                      style={{ borderColor: DOURADO, color: DOURADO }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Destino</label>
                      <AeroportoInput value={destino} onChange={setDestino} placeholder="Ex: GIG ou Rio"
                        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2a7 7 0 017 7.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data de ida</label>
                      <DatePicker value={dataIda} onChange={v => { setDataIda(v); if (dataVolta && dataVolta <= v) setDataVolta(''); if (tipo === 'idavolta') setVoltaAbrirSignal(s => s + 1) }} placeholder="dd/mm/aaaa" />
                    </div>
                    {tipo === 'idavolta' && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Data de volta</label>
                        <DatePicker value={dataVolta} onChange={setDataVolta} minDate={minDataVolta} placeholder="dd/mm/aaaa" openSignal={voltaAbrirSignal} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {tipo === 'multiplos' && (
                <div className="space-y-3">
                  {trechos.map((trecho, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1">{idx === 0 && <label className="text-sm font-medium text-gray-700">Origem</label>}<input type="text" placeholder="Ex: GRU" value={trecho.origem} maxLength={3} onChange={e => atualizarTrecho(idx, 'origem', e.target.value.toUpperCase())} className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm text-[#18283A] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[#7a8694] ${idx === 0 ? 'mt-1' : ''}`} /></div>
                      <div className="flex-1">{idx === 0 && <label className="text-sm font-medium text-gray-700">Destino</label>}<input type="text" placeholder="Ex: GIG" value={trecho.destino} maxLength={3} onChange={e => atualizarTrecho(idx, 'destino', e.target.value.toUpperCase())} className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm text-[#18283A] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[#7a8694] ${idx === 0 ? 'mt-1' : ''}`} /></div>
                      <div className="flex-1">{idx === 0 && <label className="text-sm font-medium text-gray-700">Data</label>}<input type="date" value={trecho.data} min={idx > 0 && trechos[idx-1].data ? diaSeguinte(trechos[idx-1].data) : undefined} onChange={e => atualizarTrecho(idx, 'data', e.target.value)} className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm text-[#18283A] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[#7a8694] ${idx === 0 ? 'mt-1' : ''}`} /></div>
                      <div className={`shrink-0 ${idx === 0 ? 'mt-6' : ''}`}>
                        {idx >= 2 ? (<button onClick={() => removerTrecho(idx)} className="w-9 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>) : <div className="w-9" />}
                      </div>
                    </div>
                  ))}
                  {trechos.length < 6 && (<button onClick={adicionarTrecho} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>Adicionar trecho</button>)}
                </div>
              )}

              <PassageirosDropdown adultos={adultos} criancas={criancas} bebes={bebes} setAdultos={setAdultos} setCriancas={setCriancas} setBebes={setBebes} />

              {erroVoo && <p className="text-red-500 text-sm">{erroVoo}</p>}
              <button onClick={buscarVoos} disabled={carregando} className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2" style={{ backgroundColor: AZUL }}>
                {!carregando && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                  </svg>
                )}
                {carregando ? 'Buscando voos...' : 'Buscar voos'}
              </button>
            </div>

            {(carregando || gruposIda !== null) && (
              <div>
                {!carregando && fase === 'volta' && vooIdaSelecionado && (
                  <ResumoIdaSelecionada viagem={vooIdaSelecionado} onAlterar={() => { setFase('ida'); setVooIdaSelecionado(null) }} />
                )}
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-gray-700 font-semibold">
                    {carregando ? 'Buscando...' : fase === 'volta' ? 'Selecione a volta' : totalEncontrado === 0 ? '' : `${totalEncontrado} ${totalEncontrado === 1 ? 'voo encontrado' : 'voos encontrados'}`}
                  </h2>
                  {!carregando && totalEncontrado > 0 && (
                    <span className="text-xs text-gray-400">{fase === 'volta' ? `${destino} → ${origem}` : `${origem} → ${destino}`}</span>
                  )}
                </div>

                {!carregando && totalEncontrado > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                    {ORDENACAO_OPTS.map(op => (
                      <button key={op.id} onClick={() => setOrdenacao(op.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${ordenacao === op.id ? 'text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
                        style={ordenacao === op.id ? { backgroundColor: '#18283A' } : {}}>{op.label}</button>
                    ))}
                  </div>
                )}

                {carregando && <div className="space-y-2">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>}

                {!carregando && gruposExibidos?.length === 0 && (
                  <div className="bg-white rounded-xl px-8 py-12 text-center border border-gray-100">
                    <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    <p className="text-gray-500 font-medium text-sm">Nenhum voo encontrado para essa rota.</p>
                    <p className="text-gray-400 text-xs mt-1">Tente outras datas ou aeroportos.</p>
                  </div>
                )}

                {!carregando && gruposOrdenados && gruposOrdenados.length > 0 && (
                  <div className="space-y-2">
                    {gruposOrdenados.map((voo, idx) => (
                      <VooCard key={voo.id || idx} voo={voo}
                        onSelecionar={fase === 'volta' ? selecionarVooVolta : selecionarVooIda}
                        onVerDetalhes={setVooDetalhes}
                        labelBotao={fase === 'volta' ? 'Selecionar volta' : tipo === 'idavolta' ? 'Selecionar ida' : 'Selecionar'}
                        politica={politica}
                        dataVoo={dataIda}
                        onViolacao={(viagem, motivos) => {
                          const fn = fase === 'volta' ? selecionarVooVolta : selecionarVooIda
                          setAvisoPolitica({ viagem, motivos, onContinuar: () => { setAvisoPolitica(null); fn(viagem) } })
                        }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {etapa === 'passageiro' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Sua viagem</h3>
                {vooIdaSelecionado && <ResumoVoo viagem={vooIdaSelecionado} label="Ida" />}
                {vooVoltaSelecionado && <ResumoVoo viagem={vooVoltaSelecionado} label="Volta" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-5">{passageiros.length === 1 ? 'Dados do passageiro' : 'Dados dos passageiros'}</h3>
                <div className="space-y-5">
                  {passageiros.map((p, idx) => {
                    const tipoLabel = p.tipo === 'ADT' ? 'Adulto' : p.tipo === 'CHD' ? 'Criança' : 'Bebê'
                    const numPorTipo = passageiros.slice(0, idx + 1).filter(x => x.tipo === p.tipo).length
                    const cabecalho = passageiros.length > 1 ? `${tipoLabel} ${numPorTipo}` : null
                    return (
                      <div key={idx} className={passageiros.length > 1 ? 'border border-gray-100 rounded-xl p-4 space-y-4' : 'space-y-4'}>
                        {cabecalho && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{cabecalho}</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div><label className="text-sm font-medium text-gray-700">Nome</label><input type="text" placeholder="JOAO" value={p.nome} onChange={e => atualizarPassageiro(idx, 'nome', e.target.value.toUpperCase())} className={INPUT} /></div>
                          <div><label className="text-sm font-medium text-gray-700">Sobrenome</label><input type="text" placeholder="SILVA" value={p.sobrenome} onChange={e => atualizarPassageiro(idx, 'sobrenome', e.target.value.toUpperCase())} className={INPUT} /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {p.tipo !== 'INF' && <div><label className="text-sm font-medium text-gray-700">CPF</label><input type="text" placeholder="000.000.000-00" value={p.cpf} onChange={e => atualizarPassageiro(idx, 'cpf', mascaraCPF(e.target.value))} className={INPUT} /></div>}
                          <div><label className="text-sm font-medium text-gray-700">Data de nascimento</label><input type="date" value={p.nascimento} onChange={e => atualizarPassageiro(idx, 'nascimento', e.target.value)} className={INPUT} /></div>
                        </div>
                        {p.tipo === 'ADT' && <div><label className="text-sm font-medium text-gray-700">E-mail</label><input type="email" placeholder="seu@email.com" value={p.email} onChange={e => atualizarPassageiro(idx, 'email', e.target.value)} className={INPUT} /></div>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {p.tipo === 'ADT' && <div><label className="text-sm font-medium text-gray-700">Telefone</label><input type="text" placeholder="(11) 99999-9999" value={p.telefone} onChange={e => atualizarPassageiro(idx, 'telefone', mascaraTel(e.target.value))} className={INPUT} /></div>}
                          <div><label className="text-sm font-medium text-gray-700">Sexo</label><select value={p.sexo} onChange={e => atualizarPassageiro(idx, 'sexo', e.target.value as 'M' | 'F')} className={`${INPUT} bg-white`}><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {erroReserva && <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200"><p className="text-red-600 text-sm">{erroReserva}</p></div>}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={() => setEtapa('selecao')} className="sm:w-auto w-full px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">← Voltar</button>
                <button onClick={gerarReserva} disabled={carregandoReserva} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#18283A' }}>{carregandoReserva ? 'Gerando reserva...' : 'Gerar reserva'}</button>
              </div>
            </div>
          </div>
        )}

        {etapa === 'pagamento' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Reserva confirmada!</p>
                    <p className="text-xs text-gray-500">Localizador: <span className="font-bold text-gray-800 tracking-widest">{localizador}</span></p>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-1">
                  {vooIdaSelecionado && <ResumoVoo viagem={vooIdaSelecionado} label="Ida" />}
                  {vooVoltaSelecionado && <ResumoVoo viagem={vooVoltaSelecionado} label="Volta" />}
                  {precoTotal > 0 && <div className="flex justify-between pt-3 border-t border-gray-100 mt-2"><span className="text-sm font-medium text-gray-700">Total</span><span className="text-base font-bold text-gray-900">{formatPreco(precoTotal)}</span></div>}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-5">Pagamento</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Bandeira</label>
                    <select value={cartaoBandeira} onChange={e => setCartaoBandeira(e.target.value)} className={`${INPUT} bg-white`}>
                      <option value="VI">Visa</option>
                      <option value="MC">Mastercard</option>
                      <option value="AM">Amex</option>
                      <option value="DC">Diners</option>
                      <option value="EL">Elo</option>
                      <option value="HC">Hipercard</option>
                    </select>
                  </div>
                  <div><label className="text-sm font-medium text-gray-700">Número do cartão</label><input type="text" placeholder="0000 0000 0000 0000" value={cartaoNumero} onChange={e => { const val = mascaraCartao(e.target.value); setCartaoNumero(val) }} className={INPUT} /></div>
                  <div><label className="text-sm font-medium text-gray-700">Nome no cartão</label><input type="text" placeholder="JOAO SILVA" value={cartaoTitular} onChange={e => setCartaoTitular(e.target.value.toUpperCase())} className={INPUT} /></div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div><label className="text-sm font-medium text-gray-700">Validade</label><input type="text" placeholder="MM/AA" value={cartaoValidade} onChange={e => { const val = mascaraValidade(e.target.value); setCartaoValidade(val) }} className={INPUT} /></div>
                    <div><label className="text-sm font-medium text-gray-700">CVV</label><input type="text" placeholder="123" maxLength={4} value={cartaoCVV} onChange={e => setCartaoCVV(e.target.value.replace(/\D/g, '').slice(0, 4))} className={INPUT} /></div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Parcelas</label>
                      {carregandoFormas ? <div className={`${INPUT} flex items-center text-gray-400`}>Calculando parcelas...</div> : (
                        <select value={financiamentoId} onChange={e => { const id = Number(e.target.value); const forma = formasFinanciamento.find(f => f.FinanciamentoId === id); setFinanciamentoId(id); setParcelas(forma?.Parcelas ?? 1) }} className={`${INPUT} bg-white`}>
                          {formasFinanciamento.length > 0 ? formasFinanciamento.map(f => <option key={f.FinanciamentoId} value={f.FinanciamentoId}>{f.Parcelas === 1 ? `1x ${formatPreco(f.PrimeiraParcela)}` : `${f.Parcelas}x de ${formatPreco(f.DemaisParcela)}`}</option>) : <option value={61}>1x {precoTotal > 0 ? formatPreco(precoTotal) : ''}</option>}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                {politica?.max_parcelas != null && parcelas > politica.max_parcelas && (
                  <div className="mt-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a' }}>
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <p className="text-sm" style={{ color: '#92400e' }}>
                      {parcelas}x excede o máximo de {politica.max_parcelas}x permitido pela política de viagens da sua empresa.
                    </p>
                  </div>
                )}
                {erroEmissao && <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200"><p className="text-red-600 text-sm">{erroEmissao}</p></div>}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button onClick={() => setEtapa('passageiro')} className="sm:w-auto w-full px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">← Voltar</button>
                  <button onClick={emitirPassagem} disabled={carregandoEmissao || carregandoFormas} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#18283A' }}>{carregandoEmissao ? 'Emitindo passagem...' : 'Emitir passagem'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {etapa === 'confirmacao' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />
            <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Passagem emitida!</h2>
              <p className="text-gray-500 mb-6">{nomeBilhete && <><span className="font-medium text-gray-700">{nomeBilhete}</span>, sua viagem está confirmada.</>}</p>
              <div className="inline-block bg-gray-50 rounded-2xl px-8 py-5 mb-8 text-left">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Número do bilhete</p>
                <p className="text-3xl font-bold text-gray-900 tracking-wider">{numeroBilhete}</p>
                <p className="text-xs text-gray-400 mt-2">Localizador: <span className="font-semibold text-gray-600">{localizador}</span></p>
              </div>
              <div className="space-y-2 text-sm text-gray-500 border-t border-gray-100 pt-6 mb-8">
                {vooIdaSelecionado && <ResumoVoo viagem={vooIdaSelecionado} label="Ida" />}
                {vooVoltaSelecionado && <ResumoVoo viagem={vooVoltaSelecionado} label="Volta" />}
              </div>
              <button onClick={novaBusca} className="px-8 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#18283A' }}>Nova busca</button>
            </div>
          </div>
        )}

      </div>

      {vooDetalhes && <VooDetalhesModal viagem={vooDetalhes} onFechar={() => setVooDetalhes(null)} />}

      {avisoPolitica && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#fef9c3' }}>
                <svg className="w-5 h-5" style={{ color: '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Fora da política de viagens</h3>
                <p className="text-sm text-gray-600 mb-3">Esta passagem está fora da política de viagens da sua empresa:</p>
                <ul className="space-y-1.5">
                  {avisoPolitica.motivos.map((m, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5" style={{ color: '#92400e' }}>
                      <span className="shrink-0 mt-0.5">•</span>{m}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-500 mt-3">Deseja continuar mesmo assim?</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAvisoPolitica(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Escolher outro voo
              </button>
              <button onClick={avisoPolitica.onContinuar}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#18283A' }}>
                Continuar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
