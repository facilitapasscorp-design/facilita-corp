'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../lib/supabase'
import { buscarAeroportos, Aeroporto } from '../../lib/aeroportos'

// ── Tipos ─────────────────────────────────────────────────────────
interface VooLeg {
  Numero: number
  NumeroDoVoo?: number
  HoraSaida: number
  HoraChegada: number
  CiaMandatoria: { CodigoIata: string; Descricao: string }
  BagagemInclusa: boolean
  BagagemQuantidade?: number
  BagagemPeso?: number
  BagagemUnidadeDeMedida?: string
  BagagemIndicador?: number
  Origem: { CodigoIata: string; Descricao: string }
  Destino: { CodigoIata: string; Descricao: string }
  Classe?: string
  BaseTarifaria?: string
  Familia?: string
  FamiliaCodigo?: string
  Cabine?: string
  CabineTipo?: string
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
  // Campos de família que a WOOBA pode expor no nível da Viagem
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

// ── Helpers ───────────────────────────────────────────────────────
function getLegs(viagem: Viagem): VooLeg[] {
  return viagem.Voos?.length
    ? viagem.Voos
    : (viagem.Segmentos ?? []).flatMap(s => s.Voos ?? [])
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

// Máscaras de entrada
function mascaraCPF(v: string): string {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function mascaraTel(v: string): string {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2')
}
function mascaraCartao(v: string): string {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}
function mascaraValidade(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2')
}

const CIA: Record<string, { label: string; bg: string }> = {
  G3: { label: 'GOL',    bg: '#F97316' },
  LA: { label: 'LATAM',  bg: '#7B1022' },
  JJ: { label: 'LATAM',  bg: '#7B1022' },
  AD: { label: 'AZUL',   bg: '#1D4ED8' },
  IB: { label: 'Iberia', bg: '#8B1A1A' },
}

const INPUT = 'mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── AeroportoInput ────────────────────────────────────────────────
function AeroportoInput({
  value, onChange, placeholder,
}: { value: string; onChange: (iata: string) => void; placeholder: string }) {
  const [query, setQuery] = useState(value)
  const [aberto, setAberto] = useState(false)
  const [sugestoes, setSugestoes] = useState<Aeroporto[]>([])
  const [focusIdx, setFocusIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value) { setQuery(''); return }
    if (value.length === 3) {
      const exact = buscarAeroportos(value).find(a => a.iata === value)
      if (exact) { setQuery(`${exact.iata} - ${exact.nome}`); return }
    }
    setQuery(value)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function abrir(v: string) {
    const r = buscarAeroportos(v)
    setSugestoes(r)
    setAberto(r.length > 0)
  }

  function handleChange(v: string) {
    setQuery(v)
    abrir(v)
    setFocusIdx(-1)
    const upper = v.trim().toUpperCase()
    if (upper.length === 3) {
      const exact = buscarAeroportos(upper).find(a => a.iata === upper)
      if (exact) { selecionar(exact); return }
    }
    onChange(upper.slice(0, 3))
  }

  function selecionar(a: Aeroporto) {
    setQuery(`${a.iata} - ${a.nome}`)
    onChange(a.iata)
    setAberto(false)
    setSugestoes([])
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
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (query.length >= 2) abrir(query) }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className={INPUT}
      />
      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-50 mt-1 left-0 right-0 sm:right-auto sm:w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          {sugestoes.map((a, i) => (
            <button key={a.iata} type="button" onMouseDown={() => selecionar(a)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                i === focusIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}>
              <span className="shrink-0 inline-flex items-center justify-center bg-blue-600 text-white font-bold text-xs rounded-lg px-2 py-1 min-w-[44px]">
                {a.iata}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.nome}</p>
                <p className="text-xs text-gray-400">{a.cidade}{a.estado ? `, ${a.estado}` : ''} · {a.pais}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componentes ──────────────────────────────────────────────────
function AirlineBadge({ iata }: { iata: string }) {
  const c = CIA[iata] ?? { label: nomeCompanhia(iata), bg: '#4B5563' }
  return (
    <span className="inline-flex items-center justify-center rounded-lg text-white font-bold text-xs px-2.5 py-1.5 min-w-[52px]"
      style={{ backgroundColor: c.bg }}>
      {c.label}
    </span>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-6">
        <div className="w-14 h-8 bg-gray-200 rounded-lg" />
        <div className="flex-1 flex items-center gap-4">
          <div className="w-14 h-5 bg-gray-200 rounded" />
          <div className="flex-1 h-px bg-gray-200" />
          <div className="w-14 h-5 bg-gray-200 rounded" />
        </div>
        <div className="w-24 h-6 bg-gray-200 rounded" />
        <div className="w-28 h-9 bg-gray-200 rounded-lg" />
      </div>
      <div className="mt-3 flex gap-4">
        <div className="w-20 h-3 bg-gray-100 rounded" />
        <div className="w-16 h-3 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

function VooCard({
  voo, onSelecionar, labelBotao = 'Selecionar', onVerDetalhes,
}: {
  voo: VooAgrupado
  onSelecionar: (v: Viagem) => void
  labelBotao?: string
  onVerDetalhes?: (v: Viagem) => void
}) {
  const escalas      = voo.numParadas
  const escalasLabel = escalas === 0 ? 'Direto' : escalas === 1 ? '1 escala' : `${escalas} escalas`

  return (
    <div className="bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Cabeçalho do voo */}
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center gap-3 sm:gap-4">
        <div className="shrink-0 w-14 sm:w-16">
          <AirlineBadge iata={voo.companhia} />
        </div>

        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="text-right shrink-0">
            <p className="text-lg sm:text-xl font-semibold text-gray-900 leading-none">
              {formatHora(voo.horaSaida)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{voo.origem}</p>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <p className="text-xs text-gray-400">{formatDuracao(voo.duracao)}</p>
            <div className="w-full flex items-center gap-1">
              <div className="h-px flex-1 bg-gray-300" />
              {escalas > 0 && Array.from({ length: escalas }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
              ))}
              {escalas > 0 && <div className="h-px flex-1 bg-gray-300" />}
              <svg className="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2h0A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
              </svg>
            </div>
            <p className="text-xs font-medium" style={{ color: escalas === 0 ? '#22c55e' : '#f59e0b' }}>
              {escalasLabel}
            </p>
          </div>

          <div className="text-left shrink-0">
            <p className="text-lg sm:text-xl font-semibold text-gray-900 leading-none">
              {formatHora(voo.horaChegada)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{voo.destino}</p>
          </div>
        </div>
      </div>

      {/* Número do voo + link detalhes */}
      <div className="px-4 sm:px-5 pb-3 flex items-center gap-2 text-xs text-gray-400">
        {voo.numeroVoo && (
          <span>Voo {nomeCompanhia(voo.companhia)} {voo.numeroVoo}</span>
        )}
        {escalas > 0 && onVerDetalhes && voo.tarifas[0] && (
          <>
            {voo.numeroVoo && <span>·</span>}
            <button
              onClick={() => onVerDetalhes(voo.tarifas[0].viagem)}
              className="font-medium text-blue-600 hover:text-blue-800 underline transition-colors"
            >
              Ver detalhes
            </button>
          </>
        )}
      </div>

      {/* Colunas de tarifas — dados reais da API */}
      <div className="flex overflow-x-auto border-t border-gray-100 divide-x divide-gray-100">
        {voo.tarifas.map((tarifa, i) => {
          const nomeFam      = tarifa.familia || tarifa.familiaCodigo || tarifa.baseTarifaria || '—'
          const isMenorPreco = i === 0

          return (
            <button
              key={tarifa.identificacaoDaViagem || i}
              onClick={() => onSelecionar(tarifa.viagem)}
              className={`flex-1 min-w-[130px] sm:min-w-[155px] flex flex-col items-center gap-1.5 px-3 py-4 text-center transition-colors ${
                isMenorPreco ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {isMenorPreco ? (
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Menor preço
                </span>
              ) : (
                <span className="h-[18px]" />
              )}

              {/* Nome real da família tarifária */}
              <p className={`font-bold text-xs sm:text-sm uppercase tracking-wider leading-tight ${
                isMenorPreco ? 'text-blue-800' : 'text-gray-600'
              }`}>
                {nomeFam}
              </p>

              {/* Preço real */}
              <p className={`text-xl sm:text-2xl font-bold leading-none mt-0.5 ${
                isMenorPreco ? 'text-blue-900' : 'text-gray-900'
              }`}>
                {formatPreco(tarifa.preco)}
              </p>

              {/* Bagagem real */}
              <div className="flex flex-col items-center gap-0.5 mt-1">
                {tarifa.bagagemInclusa ? (
                  <>
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <rect x="5" y="7" width="14" height="13" rx="2" />
                      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="12" y1="11" x2="12" y2="16" />
                      <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" />
                    </svg>
                    <span className="text-[10px] sm:text-xs text-blue-600 font-medium">
                      {tarifa.bagagemQuantidade && tarifa.bagagemPeso
                        ? `${tarifa.bagagemQuantidade}x ${tarifa.bagagemPeso}kg`
                        : tarifa.bagagemPeso
                          ? `${tarifa.bagagemPeso}kg`
                          : tarifa.bagagemQuantidade
                            ? `${tarifa.bagagemQuantidade} mala${tarifa.bagagemQuantidade > 1 ? 's' : ''}`
                            : 'Inclusa'}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <rect x="5" y="7" width="14" height="13" rx="2" />
                        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <svg className="absolute inset-0 w-5 h-5 text-red-400" viewBox="0 0 24 24">
                        <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-400">Sem bagagem</span>
                  </>
                )}
              </div>

              <span className={`mt-1 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                isMenorPreco ? 'text-white' : 'bg-gray-100 text-gray-600'
              }`} style={isMenorPreco ? { backgroundColor: '#1a2744' } : {}}>
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
  const legs  = getLegs(viagem)
  const first = legs[0]
  const last  = legs[legs.length - 1]
  return (
    <div className="rounded-2xl px-5 py-4 flex items-center gap-4 mb-5"
      style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
      <svg className="w-4 h-4 shrink-0" style={{ color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>Ida selecionada</span>
        <AirlineBadge iata={viagem.CiaMandatoria?.CodigoIata ?? ''} />
        <span className="text-sm font-semibold text-gray-800">
          {first ? formatHora(first.HoraSaida) : '--'} → {last ? formatHora(last.HoraChegada) : '--'}
        </span>
        <span className="text-sm text-gray-500">
          {viagem.Origem?.CodigoIata} → {viagem.Destino?.CodigoIata}
        </span>
        <span className="text-sm text-gray-500">{formatDuracao(viagem.TempoDeDuracao)}</span>
        <span className="text-sm font-semibold text-gray-800">{formatPreco(viagem.Preco?.Total ?? 0)}</span>
      </div>
      <button onClick={onAlterar} className="text-xs font-medium shrink-0 underline" style={{ color: '#16a34a' }}>
        Alterar
      </button>
    </div>
  )
}

function ResumoVoo({ viagem, label }: { viagem: Viagem; label: string }) {
  const legs  = getLegs(viagem)
  const first = legs[0]
  const last  = legs[legs.length - 1]
  return (
    <div className="flex items-center gap-3 py-2">
      <AirlineBadge iata={viagem.CiaMandatoria?.CodigoIata ?? ''} />
      <div className="flex-1">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800">
          {viagem.Origem?.CodigoIata} → {viagem.Destino?.CodigoIata}
          <span className="font-normal text-gray-500 ml-2">
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
  const steps = [
    { id: 'selecao',    label: 'Seleção' },
    { id: 'passageiro', label: 'Passageiro' },
    { id: 'pagamento',  label: 'Pagamento' },
  ]
  const idx = etapa === 'confirmacao' ? 2 : steps.findIndex(s => s.id === etapa)
  return (
    <div className="flex items-center justify-center py-6">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i < idx ? 'bg-green-500 text-white' : i === idx ? 'text-white' : 'bg-gray-200 text-gray-400'
            }`} style={i === idx ? { backgroundColor: '#1a2744' } : {}}>
              {i < idx
                ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap ${i === idx ? 'text-gray-700 font-semibold' : i < idx ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-20 h-px mx-2 sm:mx-3 mb-5 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Modal detalhes do voo ─────────────────────────────────────────
function VooDetalhesModal({ viagem, onFechar }: { viagem: Viagem; onFechar: () => void }) {
  const legs = getLegs(viagem)
  const iata = viagem.CiaMandatoria?.CodigoIata ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Detalhes do voo</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {viagem.Origem?.CodigoIata} → {viagem.Destino?.CodigoIata} · {formatDuracao(viagem.TempoDeDuracao)} no total
            </p>
          </div>
          <button onClick={onFechar}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {legs.map((leg, i) => {
            const isLast = i === legs.length - 1
            const connMin = !isLast ? conexaoMinutos(leg, legs[i + 1]) : 0
            const connCurta = connMin > 0 && connMin < 60

            return (
              <div key={i}>
                {/* Partida (só para o 1º trecho; os demais compartilham o ponto de chegada anterior) */}
                {i === 0 && (
                  <div className="flex gap-4 mb-2">
                    <div className="flex flex-col items-center w-7">
                      <div className="w-3 h-3 rounded-full border-2 border-blue-600 bg-white mt-0.5 shrink-0" />
                      <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: 36 }} />
                    </div>
                    <div className="pb-2">
                      <p className="text-base font-bold text-gray-900">{formatHora(leg.HoraSaida)}</p>
                      <p className="text-sm text-gray-700">
                        {leg.Origem?.CodigoIata}
                        {leg.Origem?.Descricao ? <span className="text-gray-400"> · {leg.Origem.Descricao}</span> : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {nomeCompanhia(iata)} {leg.Numero || leg.NumeroDoVoo || ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Duração do trecho */}
                <div className="flex gap-4 mb-2">
                  <div className="flex justify-center w-7">
                    <div className="w-0.5 bg-gray-200" style={{ height: 20 }} />
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-0.5 rounded-full self-center">
                    {formatMinutos(legMinutos(leg))}
                  </span>
                </div>

                {/* Chegada / conexão / destino final */}
                <div className="flex gap-4 mb-2">
                  <div className="flex flex-col items-center w-7">
                    <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 ${
                      isLast ? 'bg-blue-600 border-blue-600' : 'bg-white border-orange-400'
                    }`} />
                    {!isLast && <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: 36 }} />}
                  </div>
                  <div className="pb-2">
                    <p className="text-base font-bold text-gray-900">{formatHora(leg.HoraChegada)}</p>
                    <p className="text-sm text-gray-700">
                      {leg.Destino?.CodigoIata}
                      {leg.Destino?.Descricao ? <span className="text-gray-400"> · {leg.Destino.Descricao}</span> : ''}
                    </p>
                    {!isLast && (
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          connCurta ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'
                        }`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Conexão · {formatMinutos(connMin)}
                          {connCurta && ' · Conexão curta'}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          Próximo: {nomeCompanhia(iata)} {legs[i + 1].Numero || legs[i + 1].NumeroDoVoo || ''} · parte às {formatHora(legs[i + 1].HoraSaida)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <div className="mt-3 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Duração total: <span className="font-semibold text-gray-800">{formatDuracao(viagem.TempoDeDuracao)}</span>
            </span>
            <AirlineBadge iata={iata} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function Busca() {
  const router = useRouter()

  // Formulário de busca
  const [tipo, setTipo]           = useState<TipoViagem>('idavolta')
  const [origem, setOrigem]       = useState('')
  const [destino, setDestino]     = useState('')
  const [dataIda, setDataIda]     = useState('')
  const [dataVolta, setDataVolta] = useState('')
  const [adultos, setAdultos]     = useState(1)
  const [criancas, setCriancas]   = useState(0)
  const [bebes, setBebes]         = useState(0)
  const [trechos, setTrechos]     = useState<Trecho[]>([
    { origem: '', destino: '', data: '' },
    { origem: '', destino: '', data: '' },
  ])

  // Resultados
  const [carregando, setCarregando]     = useState(false)
  const [erroVoo, setErroVoo]           = useState('')
  const [gruposIda, setGruposIda]       = useState<VooAgrupado[] | null>(null)
  const [gruposVolta, setGruposVolta]   = useState<VooAgrupado[] | null>(null)

  // Seleção / ordenação / detalhes
  const [fase, setFase]                               = useState<FaseSeleção>('ida')
  const [vooIdaSelecionado, setVooIdaSelecionado]     = useState<Viagem | null>(null)
  const [vooVoltaSelecionado, setVooVoltaSelecionado] = useState<Viagem | null>(null)
  const [ordenacao, setOrdenacao]                     = useState<Ordenacao>('preco')
  const [vooDetalhes, setVooDetalhes]                 = useState<Viagem | null>(null)

  // Etapa
  const [etapa, setEtapa] = useState<Etapa>('selecao')

  // Passageiros
  const [passageiros, setPassageiros]         = useState<PassageiroForm[]>([passageiroVazio()])
  const [carregandoReserva, setCarregandoReserva] = useState(false)
  const [erroReserva,       setErroReserva]       = useState('')
  const [localizador,       setLocalizador]        = useState('')

  // Cartão
  const [cartaoNumero,   setCartaoNumero]   = useState('')
  const [cartaoTitular,  setCartaoTitular]  = useState('')
  const [cartaoValidade, setCartaoValidade] = useState('')
  const [cartaoCVV,      setCartaoCVV]      = useState('')
  const [carregandoEmissao, setCarregandoEmissao] = useState(false)
  const [erroEmissao,       setErroEmissao]       = useState('')
  const [numeroBilhete,     setNumeroBilhete]      = useState('')
  const [nomeBilhete,       setNomeBilhete]        = useState('')

  // Financiamento
  const [formasFinanciamento, setFormasFinanciamento] = useState<{ FinanciamentoId: number; Parcelas: number }[]>([])
  const [financiamentoId,     setFinanciamentoId]     = useState<number>(61)
  const [parcelas,            setParcelas]            = useState<number>(1)
  const [chaveDeSeguranca,    setChaveDeSeguranca]    = useState<string | null>(null)
  const [codigoPagamento,     setCodigoPagamento]     = useState<number>(2)
  const [carregandoFormas,    setCarregandoFormas]    = useState(false)

  // Ref para focar campo de volta após selecionar ida
  const dataVoltaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/')
    })
  }, [router])

  useEffect(() => {
    setPassageiros([
      ...Array.from({ length: adultos }, () => passageiroVazio('ADT')),
      ...Array.from({ length: criancas }, () => passageiroVazio('CHD')),
      ...Array.from({ length: bebes }, () => passageiroVazio('INF')),
    ])
  }, [adultos, criancas, bebes])

  useEffect(() => {
    if (etapa !== 'pagamento' || !localizador) return
    setCarregandoFormas(true)
    setErroEmissao('')
    fetch('/api/iniciar-emissao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localizador }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.erro) { setErroEmissao(data.erro); return }
        setChaveDeSeguranca(data.chaveDeSeguranca ?? null)
        setCodigoPagamento(data.codigoPagamento ?? 2)
        const formas: { FinanciamentoId: number; Parcelas: number }[] = data.formasFinanciamento ?? []
        setFormasFinanciamento(formas)
        if (formas.length > 0) { setFinanciamentoId(formas[0].FinanciamentoId); setParcelas(formas[0].Parcelas) }
      })
      .catch(() => setErroEmissao('Erro ao carregar opções de pagamento'))
      .finally(() => setCarregandoFormas(false))
  }, [etapa, localizador])

  function atualizarTrecho(idx: number, campo: keyof Trecho, v: string) {
    setTrechos(prev => prev.map((t, i) => i === idx ? { ...t, [campo]: v } : t))
  }
  function adicionarTrecho() {
    if (trechos.length < 6) setTrechos(prev => [...prev, { origem: '', destino: '', data: '' }])
  }
  function removerTrecho(idx: number) {
    setTrechos(prev => prev.filter((_, i) => i !== idx))
  }
  function atualizarPassageiro(idx: number, campo: keyof PassageiroForm, valor: string) {
    setPassageiros(prev => prev.map((p, i) => i === idx ? { ...p, [campo]: valor } : p))
  }

  async function buscarVoos() {
    if (tipo === 'multiplos') {
      if (trechos.some(t => !t.origem || !t.destino || !t.data)) {
        setErroVoo('Preencha todos os campos dos trechos.'); return
      }
    } else if (!origem || !destino || !dataIda) {
      setErroVoo('Preencha origem, destino e data de ida.'); return
    }
    setCarregando(true); setErroVoo(''); setGruposIda(null); setGruposVolta(null)
    setFase('ida'); setVooIdaSelecionado(null); setVooVoltaSelecionado(null)
    const res = await fetch('/api/buscar-voos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem:    tipo === 'multiplos' ? trechos[0].origem  : origem,
        destino:   tipo === 'multiplos' ? trechos[0].destino : destino,
        dataIda:   tipo === 'multiplos' ? trechos[0].data    : dataIda,
        dataVolta: tipo === 'idavolta'  ? dataVolta           : undefined,
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
    if (tipo === 'idavolta') setFase('volta')
    else setEtapa('passageiro')
  }
  function selecionarVooVolta(viagem: Viagem) {
    setVooVoltaSelecionado(viagem); setEtapa('passageiro')
  }

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          user_id:         sessionData.session.user.id,
          localizador:     loc,
          origem:          vooIdaSelecionado?.Origem?.CodigoIata ?? '',
          destino:         vooIdaSelecionado?.Destino?.CodigoIata ?? '',
          data_voo:        dataIda || null,
          passageiro_nome: primAdulto ? `${primAdulto.nome} ${primAdulto.sobrenome}`.trim() : null,
          valor:           valorTotal > 0 ? valorTotal : null,
          status:          'Ativa',
        })
      }
    } catch {}
    setCarregandoReserva(false); setEtapa('pagamento')
  }

  async function emitirPassagem() {
    if (!cartaoNumero || !cartaoTitular || !cartaoValidade || !cartaoCVV) {
      setErroEmissao('Preencha todos os dados do cartão.'); return
    }
    setCarregandoEmissao(true); setErroEmissao('')
    const res = await fetch('/api/iniciar-emitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localizador, chaveDeSeguranca, codigoPagamento, financiamentoId,
        cartao: { numero: cartaoNumero, titular: cartaoTitular, validade: cartaoValidade, cvv: cartaoCVV, parcelas },
      }),
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
    setAdultos(1); setCriancas(0); setBebes(0)
    setPassageiros([passageiroVazio('ADT')])
    setOrigem(''); setDestino(''); setDataIda(''); setDataVolta('')
    setCartaoNumero(''); setCartaoTitular(''); setCartaoValidade(''); setCartaoCVV('')
    setFormasFinanciamento([]); setFinanciamentoId(61); setParcelas(1)
    setChaveDeSeguranca(null); setCodigoPagamento(2)
  }

  async function buscarFormasComCartao(numero: string, validade: string) {
    if (!localizador) return
    try {
      const res = await fetch('/api/iniciar-emissao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localizador, cartao: { numero, validade } }),
      })
      const data = await res.json()
      if (data.erro) return
      const formas: { FinanciamentoId: number; Parcelas: number }[] = data.formasFinanciamento ?? []
      setFormasFinanciamento(formas)
      if (formas.length > 0) { setFinanciamentoId(formas[0].FinanciamentoId); setParcelas(formas[0].Parcelas) }
    } catch {}
  }

  const minDataVolta    = diaSeguinte(dataIda)
  const gruposExibidos  = fase === 'volta' ? gruposVolta : gruposIda
  const gruposOrdenados = gruposExibidos ? ordenarGrupos(gruposExibidos, ordenacao) : null
  const totalEncontrado = gruposExibidos?.length ?? 0
  const precoTotal      = (vooIdaSelecionado?.Preco?.Total ?? 0) + (vooVoltaSelecionado?.Preco?.Total ?? 0)

  const ORDENACAO_OPTS: { id: Ordenacao; label: string }[] = [
    { id: 'preco',   label: 'Menor preço' },
    { id: 'duracao', label: 'Menor duração' },
    { id: 'custo',   label: 'Melhor custo-benefício' },
    { id: 'escalas', label: 'Menos escalas' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-gray-200" style={{ backgroundColor: '#F4F5F3' }}>
        <Image src="/logo.png" alt="Facilita Pass" width={120} height={38} style={{ objectFit: 'contain' }} />
        <div className="flex items-center gap-3 sm:gap-5">
          <button onClick={() => router.push('/painel')}
            className="text-xs sm:text-sm font-medium transition-colors hover:opacity-60"
            style={{ color: '#1a2744' }}>
            Minhas reservas
          </button>
          <button onClick={async () => { await createClient().auth.signOut(); router.replace('/') }}
            className="text-xs sm:text-sm transition-colors hover:opacity-60"
            style={{ color: '#1a2744' }}>
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* ════ ETAPA 1 — SELEÇÃO DO VOO ════ */}
        {etapa === 'selecao' && (
          <div className="py-8 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
              {/* Tipo de viagem */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { v: 'idavolta',  l: 'Ida e volta' },
                  { v: 'ida',       l: 'Só ida' },
                  { v: 'multiplos', l: 'Múltiplos destinos' },
                ] as const).map(op => (
                  <button key={op.v} onClick={() => setTipo(op.v)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tipo === op.v ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    style={tipo === op.v ? { backgroundColor: '#1a2744' } : {}}>
                    {op.l}
                  </button>
                ))}
              </div>

              {/* Campos simples */}
              {tipo !== 'multiplos' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Origem</label>
                      <AeroportoInput value={origem} onChange={setOrigem} placeholder="Ex: GRU ou São Paulo" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Destino</label>
                      <AeroportoInput value={destino} onChange={setDestino} placeholder="Ex: GIG ou Rio" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data de ida</label>
                      <input type="date" value={dataIda}
                        onChange={e => {
                          const v = e.target.value
                          setDataIda(v)
                          if (dataVolta && dataVolta <= v) setDataVolta('')
                          if (tipo === 'idavolta') setTimeout(() => dataVoltaRef.current?.focus(), 80)
                        }}
                        className={INPUT} />
                    </div>
                    {tipo === 'idavolta' && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Data de volta</label>
                        <input ref={dataVoltaRef} type="date" value={dataVolta} min={minDataVolta}
                          onChange={e => setDataVolta(e.target.value)} className={INPUT} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Múltiplos destinos */}
              {tipo === 'multiplos' && (
                <div className="space-y-3">
                  {trechos.map((trecho, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1">
                        {idx === 0 && <label className="text-sm font-medium text-gray-700">Origem</label>}
                        <input type="text" placeholder="Ex: GRU" value={trecho.origem} maxLength={3}
                          onChange={e => atualizarTrecho(idx, 'origem', e.target.value.toUpperCase())}
                          className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${idx === 0 ? 'mt-1' : ''}`} />
                      </div>
                      <div className="flex-1">
                        {idx === 0 && <label className="text-sm font-medium text-gray-700">Destino</label>}
                        <input type="text" placeholder="Ex: GIG" value={trecho.destino} maxLength={3}
                          onChange={e => atualizarTrecho(idx, 'destino', e.target.value.toUpperCase())}
                          className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${idx === 0 ? 'mt-1' : ''}`} />
                      </div>
                      <div className="flex-1">
                        {idx === 0 && <label className="text-sm font-medium text-gray-700">Data</label>}
                        <input type="date" value={trecho.data}
                          min={idx > 0 && trechos[idx - 1].data ? diaSeguinte(trechos[idx - 1].data) : undefined}
                          onChange={e => atualizarTrecho(idx, 'data', e.target.value)}
                          className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${idx === 0 ? 'mt-1' : ''}`} />
                      </div>
                      <div className={`shrink-0 ${idx === 0 ? 'mt-6' : ''}`}>
                        {idx >= 2 ? (
                          <button onClick={() => removerTrecho(idx)}
                            className="w-9 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ) : <div className="w-9" />}
                      </div>
                    </div>
                  ))}
                  {trechos.length < 6 && (
                    <button onClick={adicionarTrecho}
                      className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Adicionar trecho
                    </button>
                  )}
                </div>
              )}

              {/* Passageiros */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Passageiros</label>
                  <span className="text-xs text-gray-400 font-medium">
                    {adultos + criancas + bebes} {adultos + criancas + bebes === 1 ? 'passageiro' : 'passageiros'}
                  </span>
                </div>
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {([
                    { label: 'Adultos', sub: 'Acima de 12 anos', val: adultos, set: setAdultos, min: 1 },
                    { label: 'Crianças', sub: '2 a 11 anos', val: criancas, set: setCriancas, min: 0 },
                    { label: 'Bebês', sub: 'Até 2 anos', val: bebes, set: setBebes, min: 0 },
                  ] as const).map(({ label, sub, val, set, min }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{sub}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => val > min && set(val - 1)} disabled={val <= min}
                          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 text-lg font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-gray-900">{val}</span>
                        <button type="button"
                          onClick={() => adultos + criancas + bebes < 9 && set(val + 1)}
                          disabled={adultos + criancas + bebes >= 9}
                          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 text-lg font-medium hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {adultos + criancas + bebes >= 9 && (
                  <p className="text-amber-600 text-xs mt-2 font-medium">Máximo de 9 passageiros por busca atingido.</p>
                )}
              </div>

              {erroVoo && <p className="text-red-500 text-sm">{erroVoo}</p>}

              <button onClick={buscarVoos} disabled={carregando}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#1a2744' }}>
                {carregando ? 'Buscando voos...' : 'Buscar voos'}
              </button>
            </div>

            {/* Resultados */}
            {(carregando || gruposIda !== null) && (
              <div>
                {!carregando && fase === 'volta' && vooIdaSelecionado && (
                  <ResumoIdaSelecionada viagem={vooIdaSelecionado}
                    onAlterar={() => { setFase('ida'); setVooIdaSelecionado(null) }} />
                )}

                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-gray-700 font-semibold text-lg">
                    {carregando ? 'Buscando os melhores voos...'
                      : fase === 'volta' ? 'Selecione a melhor opção de volta'
                      : totalEncontrado === 0 ? ''
                      : `${totalEncontrado} ${totalEncontrado === 1 ? 'voo encontrado' : 'voos encontrados'}`}
                  </h2>
                  {!carregando && totalEncontrado > 0 && (
                    <span className="text-xs text-gray-400">
                      {fase === 'volta' ? `${destino} → ${origem}` : `${origem} → ${destino}`}
                    </span>
                  )}
                </div>

                {/* Barra de ordenação */}
                {!carregando && totalEncontrado > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
                    {ORDENACAO_OPTS.map(op => (
                      <button key={op.id} onClick={() => setOrdenacao(op.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          ordenacao === op.id
                            ? 'text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                        }`}
                        style={ordenacao === op.id ? { backgroundColor: '#1a2744' } : {}}>
                        {op.label}
                      </button>
                    ))}
                  </div>
                )}

                {carregando && <div className="space-y-3">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>}

                {!carregando && gruposExibidos?.length === 0 && (
                  <div className="bg-white rounded-2xl px-8 py-16 text-center shadow-sm">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhum voo encontrado para essa rota.</p>
                    <p className="text-gray-400 text-sm mt-1">Tente outras datas ou aeroportos.</p>
                  </div>
                )}

                {!carregando && gruposOrdenados && gruposOrdenados.length > 0 && (
                  <div className="space-y-3">
                    {gruposOrdenados.map((voo, idx) => (
                      <VooCard key={voo.id || idx} voo={voo}
                        onSelecionar={fase === 'volta' ? selecionarVooVolta : selecionarVooIda}
                        onVerDetalhes={setVooDetalhes}
                        labelBotao={fase === 'volta' ? 'Selecionar volta'
                          : tipo === 'idavolta' ? 'Selecionar ida' : 'Selecionar'} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ ETAPA 2 — PASSAGEIRO ════ */}
        {etapa === 'passageiro' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sua viagem</h3>
                {vooIdaSelecionado && <ResumoVoo viagem={vooIdaSelecionado} label="Ida" />}
                {vooVoltaSelecionado && <ResumoVoo viagem={vooVoltaSelecionado} label="Volta" />}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-5">
                  {passageiros.length === 1 ? 'Dados do passageiro' : 'Dados dos passageiros'}
                </h3>
                <div className="space-y-5">
                  {passageiros.map((p, idx) => {
                    const tipoLabel = p.tipo === 'ADT' ? 'Adulto' : p.tipo === 'CHD' ? 'Criança' : 'Bebê'
                    const numPorTipo = passageiros.slice(0, idx + 1).filter(x => x.tipo === p.tipo).length
                    const cabecalho = passageiros.length > 1 ? `${tipoLabel} ${numPorTipo}` : null
                    return (
                      <div key={idx} className={passageiros.length > 1 ? 'border border-gray-100 rounded-xl p-4 space-y-4' : 'space-y-4'}>
                        {cabecalho && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{cabecalho}</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Nome</label>
                            <input type="text" placeholder="JOAO" value={p.nome}
                              onChange={e => atualizarPassageiro(idx, 'nome', e.target.value.toUpperCase())} className={INPUT} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Sobrenome</label>
                            <input type="text" placeholder="SILVA" value={p.sobrenome}
                              onChange={e => atualizarPassageiro(idx, 'sobrenome', e.target.value.toUpperCase())} className={INPUT} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {p.tipo !== 'INF' && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">CPF</label>
                              <input type="text" placeholder="000.000.000-00" value={p.cpf}
                                onChange={e => atualizarPassageiro(idx, 'cpf', mascaraCPF(e.target.value))} className={INPUT} />
                            </div>
                          )}
                          <div>
                            <label className="text-sm font-medium text-gray-700">Data de nascimento</label>
                            <input type="date" value={p.nascimento}
                              onChange={e => atualizarPassageiro(idx, 'nascimento', e.target.value)} className={INPUT} />
                          </div>
                        </div>
                        {p.tipo === 'ADT' && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">E-mail</label>
                            <input type="email" placeholder="seu@email.com" value={p.email}
                              onChange={e => atualizarPassageiro(idx, 'email', e.target.value)} className={INPUT} />
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {p.tipo === 'ADT' && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Telefone</label>
                              <input type="text" placeholder="(11) 99999-9999" value={p.telefone}
                                onChange={e => atualizarPassageiro(idx, 'telefone', mascaraTel(e.target.value))} className={INPUT} />
                            </div>
                          )}
                          <div>
                            <label className="text-sm font-medium text-gray-700">Sexo</label>
                            <select value={p.sexo} onChange={e => atualizarPassageiro(idx, 'sexo', e.target.value as 'M' | 'F')}
                              className={`${INPUT} bg-white`}>
                              <option value="M">Masculino</option>
                              <option value="F">Feminino</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {erroReserva && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-600 text-sm">{erroReserva}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={() => setEtapa('selecao')}
                  className="sm:w-auto w-full px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                  ← Voltar
                </button>
                <button onClick={gerarReserva} disabled={carregandoReserva}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#1a2744' }}>
                  {carregandoReserva ? 'Gerando reserva...' : 'Gerar reserva'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════ ETAPA 3 — PAGAMENTO ════ */}
        {etapa === 'pagamento' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />
            <div className="space-y-4">
              {/* Resumo da reserva */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Reserva confirmada!</p>
                    <p className="text-sm text-gray-500">Localizador: <span className="font-bold text-gray-800 tracking-widest">{localizador}</span></p>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-1">
                  {vooIdaSelecionado && <ResumoVoo viagem={vooIdaSelecionado} label="Ida" />}
                  {vooVoltaSelecionado && <ResumoVoo viagem={vooVoltaSelecionado} label="Volta" />}
                  {precoTotal > 0 && (
                    <div className="flex justify-between pt-3 border-t border-gray-100 mt-2">
                      <span className="text-sm font-medium text-gray-700">Total</span>
                      <span className="text-base font-bold text-gray-900">{formatPreco(precoTotal)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulário de cartão */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-5">Pagamento</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Número do cartão</label>
                    <input type="text" placeholder="0000 0000 0000 0000" value={cartaoNumero}
                      onChange={e => {
                        const val = mascaraCartao(e.target.value)
                        setCartaoNumero(val)
                        if (val.replace(/\D/g, '').length === 16) buscarFormasComCartao(val, cartaoValidade)
                      }}
                      className={INPUT} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome no cartão</label>
                    <input type="text" placeholder="JOAO SILVA" value={cartaoTitular}
                      onChange={e => setCartaoTitular(e.target.value.toUpperCase())} className={INPUT} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Validade</label>
                      <input type="text" placeholder="MM/AA" value={cartaoValidade}
                        onChange={e => {
                          const val = mascaraValidade(e.target.value)
                          setCartaoValidade(val)
                          if (val.length >= 5) buscarFormasComCartao(cartaoNumero, val)
                        }} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">CVV</label>
                      <input type="text" placeholder="123" maxLength={4} value={cartaoCVV}
                        onChange={e => setCartaoCVV(e.target.value.replace(/\D/g, '').slice(0, 4))} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Parcelas</label>
                      {carregandoFormas ? (
                        <div className={`${INPUT} flex items-center text-gray-400`}>Carregando...</div>
                      ) : (
                        <select value={financiamentoId}
                          onChange={e => {
                            const id = Number(e.target.value)
                            const forma = formasFinanciamento.find(f => f.FinanciamentoId === id)
                            setFinanciamentoId(id); setParcelas(forma?.Parcelas ?? 1)
                          }}
                          className={`${INPUT} bg-white`}>
                          {formasFinanciamento.length > 0
                            ? formasFinanciamento.map(f => (
                                <option key={f.FinanciamentoId} value={f.FinanciamentoId}>
                                  {f.Parcelas}x {precoTotal > 0 ? formatPreco(precoTotal / f.Parcelas) : ''}
                                </option>
                              ))
                            : <option value={61}>1x {precoTotal > 0 ? formatPreco(precoTotal) : ''}</option>
                          }
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {erroEmissao && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-600 text-sm">{erroEmissao}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button onClick={() => setEtapa('passageiro')}
                    className="sm:w-auto w-full px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                    ← Voltar
                  </button>
                  <button onClick={emitirPassagem} disabled={carregandoEmissao}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: '#1a2744' }}>
                    {carregandoEmissao ? 'Emitindo passagem...' : 'Emitir passagem'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ ETAPA 4 — CONFIRMAÇÃO ════ */}
        {etapa === 'confirmacao' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />
            <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Passagem emitida!</h2>
              <p className="text-gray-500 mb-6">
                {nomeBilhete && <><span className="font-medium text-gray-700">{nomeBilhete}</span>, sua viagem está confirmada.</>}
              </p>
              <div className="inline-block bg-gray-50 rounded-2xl px-8 py-5 mb-8 text-left">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Número do bilhete</p>
                <p className="text-3xl font-bold text-gray-900 tracking-wider">{numeroBilhete}</p>
                <p className="text-xs text-gray-400 mt-2">Localizador: <span className="font-semibold text-gray-600">{localizador}</span></p>
              </div>
              <div className="space-y-2 text-sm text-gray-500 border-t border-gray-100 pt-6 mb-8">
                {vooIdaSelecionado && <ResumoVoo viagem={vooIdaSelecionado} label="Ida" />}
                {vooVoltaSelecionado && <ResumoVoo viagem={vooVoltaSelecionado} label="Volta" />}
              </div>
              <button onClick={novaBusca}
                className="px-8 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#1a2744' }}>
                Nova busca
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal de detalhes do voo */}
      {vooDetalhes && (
        <VooDetalhesModal viagem={vooDetalhes} onFechar={() => setVooDetalhes(null)} />
      )}

    </div>
  )
}
