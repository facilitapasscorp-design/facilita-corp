'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────
interface VooLeg {
  Numero: number
  NumeroDoVoo?: number
  HoraSaida: number
  HoraChegada: number
  CiaMandatoria: { CodigoIata: string; Descricao: string }
  BagagemInclusa: boolean
  Origem: { CodigoIata: string; Descricao: string }
  Destino: { CodigoIata: string; Descricao: string }
  Classe?: string
  BaseTarifaria?: { Codigo: string; Familia: string }[]
  Familia?: string
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
}

interface Trecho { origem: string; destino: string; data: string }
type TipoViagem = 'ida' | 'idavolta' | 'multiplos'
type FaseSeleção = 'ida' | 'volta'
type Etapa = 'selecao' | 'passageiro' | 'pagamento' | 'confirmacao'

interface PassageiroForm {
  nome: string; sobrenome: string; cpf: string
  nascimento: string; email: string; telefone: string
  sexo: 'M' | 'F'; tipo: 'ADT' | 'CHD' | 'INF'
}
function passageiroVazio(tipo: 'ADT' | 'CHD' | 'INF' = 'ADT'): PassageiroForm {
  return { nome: '', sobrenome: '', cpf: '', nascimento: '', email: '', telefone: '', sexo: 'M', tipo }
}

// ── Helpers ───────────────────────────────────────────────────────
function formatHora(hora: number): string {
  const s = String(hora).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}
function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDuracao(tempo: string): string {
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
  AD: { label: 'AZUL',   bg: '#1D4ED8' },
  IB: { label: 'Iberia', bg: '#8B1A1A' },
}

const INPUT = 'mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── Componentes ──────────────────────────────────────────────────
function AirlineBadge({ iata }: { iata: string }) {
  const c = CIA[iata] ?? { label: iata, bg: '#4B5563' }
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
  viagem, onSelecionar, labelBotao = 'Selecionar',
}: { viagem: Viagem; onSelecionar: (v: Viagem) => void; labelBotao?: string }) {
  const first = viagem.Voos?.[0]
  const last  = viagem.Voos?.[viagem.Voos.length - 1]
  const iata  = viagem.CiaMandatoria?.CodigoIata ?? ''
  const escalas = viagem.NumeroParadas
  const escalasLabel = escalas === 0 ? 'Direto' : escalas === 1 ? '1 escala' : `${escalas} escalas`

  return (
    <div className="bg-white rounded-2xl px-6 py-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-5">
        <div className="w-16 shrink-0"><AirlineBadge iata={iata} /></div>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="text-right shrink-0">
            <p className="text-xl font-semibold text-gray-900 leading-none">
              {first ? formatHora(first.HoraSaida) : '--:--'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{viagem.Origem?.CodigoIata}</p>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <p className="text-xs text-gray-400">{formatDuracao(viagem.TempoDeDuracao)}</p>
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
            <p className="text-xl font-semibold text-gray-900 leading-none">
              {last ? formatHora(last.HoraChegada) : '--:--'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{viagem.Destino?.CodigoIata}</p>
          </div>
        </div>

        <div className="shrink-0 text-right flex flex-col items-end gap-2 ml-4">
          <p className="text-xl font-bold text-gray-900">{formatPreco(viagem.Preco?.Total ?? 0)}</p>
          <button onClick={() => onSelecionar(viagem)}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-80 transition-opacity"
            style={{ backgroundColor: '#1a2744' }}>
            {labelBotao}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-gray-50 pt-3">
        <span className="text-xs text-gray-400">
          {first?.Numero ? `Voo ${iata} ${first.Numero}` : iata}
        </span>
        <span className="text-gray-200">·</span>
        <span className="text-xs text-gray-400">
          {first?.BagagemInclusa ? '✓ Bagagem inclusa' : 'Sem bagagem despachada'}
        </span>
      </div>
    </div>
  )
}

function ResumoIdaSelecionada({ viagem, onAlterar }: { viagem: Viagem; onAlterar: () => void }) {
  const first = viagem.Voos?.[0]
  const last  = viagem.Voos?.[viagem.Voos.length - 1]
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

// Resumo compacto de 1 voo para as etapas 2 e 3
function ResumoVoo({ viagem, label }: { viagem: Viagem; label: string }) {
  const first = viagem.Voos?.[0]
  const last  = viagem.Voos?.[viagem.Voos.length - 1]
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
            <div className={`w-20 h-px mx-3 mb-5 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
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

  // Resultados da busca
  const [carregando, setCarregando] = useState(false)
  const [erroVoo, setErroVoo]       = useState('')
  const [voosIda, setVoosIda]       = useState<Viagem[] | null>(null)
  const [voosVolta, setVoosVolta]   = useState<Viagem[] | null>(null)

  // Seleção de voos
  const [fase, setFase]                           = useState<FaseSeleção>('ida')
  const [vooIdaSelecionado, setVooIdaSelecionado] = useState<Viagem | null>(null)
  const [vooVoltaSelecionado, setVooVoltaSelecionado] = useState<Viagem | null>(null)

  // Etapa do fluxo
  const [etapa, setEtapa] = useState<Etapa>('selecao')

  // Dados dos passageiros
  const [passageiros, setPassageiros] = useState<PassageiroForm[]>([passageiroVazio()])
  const [carregandoReserva, setCarregandoReserva] = useState(false)
  const [erroReserva,       setErroReserva]       = useState('')
  const [localizador,       setLocalizador]        = useState('')

  // Dados do cartão
  const [cartaoNumero,   setCartaoNumero]   = useState('')
  const [cartaoTitular,  setCartaoTitular]  = useState('')
  const [cartaoValidade, setCartaoValidade] = useState('')
  const [cartaoCVV,      setCartaoCVV]      = useState('')
  const [cartaoParcelas, setCartaoParcelas] = useState(1)
  const [carregandoEmissao, setCarregandoEmissao] = useState(false)
  const [erroEmissao,       setErroEmissao]       = useState('')
  const [numeroBilhete,     setNumeroBilhete]      = useState('')
  const [nomeBilhete,       setNomeBilhete]        = useState('')

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

  // ── Múltiplos trechos ─────────────────────────────────────────
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

  // ── Busca ─────────────────────────────────────────────────────
  async function buscarVoos() {
    if (tipo === 'multiplos') {
      if (trechos.some(t => !t.origem || !t.destino || !t.data)) {
        setErroVoo('Preencha todos os campos dos trechos.'); return
      }
    } else if (!origem || !destino || !dataIda) {
      setErroVoo('Preencha origem, destino e data de ida.'); return
    }

    setCarregando(true); setErroVoo(''); setVoosIda(null); setVoosVolta(null)
    setFase('ida'); setVooIdaSelecionado(null); setVooVoltaSelecionado(null)

    const res = await fetch('/api/buscar-voos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origem:   tipo === 'multiplos' ? trechos[0].origem  : origem,
        destino:  tipo === 'multiplos' ? trechos[0].destino : destino,
        dataIda:  tipo === 'multiplos' ? trechos[0].data    : dataIda,
        dataVolta: tipo === 'idavolta' ? dataVolta : undefined,
        adultos, criancas, bebes, tipo,
      }),
    })
    const data = await res.json()
    setCarregando(false)
    if (data.erro) { setErroVoo(data.erro) }
    else { setVoosIda(data.voos ?? []); setVoosVolta(data.voosVolta ?? []) }
  }

  // ── Seleção de voos → avança etapa ───────────────────────────
  function selecionarVooIda(viagem: Viagem) {
    setVooIdaSelecionado(viagem)
    if (tipo === 'idavolta') { setFase('volta') }
    else { setEtapa('passageiro') }
  }

  function selecionarVooVolta(viagem: Viagem) {
    setVooVoltaSelecionado(viagem)
    setEtapa('passageiro')
  }

  // ── Gerar reserva ─────────────────────────────────────────────
  async function gerarReserva() {
    for (const p of passageiros) {
      const camposBase = !p.nome || !p.sobrenome || !p.nascimento
      const faltaCPF   = p.tipo !== 'INF' && !p.cpf
      const faltaContato = p.tipo === 'ADT' && (!p.email || !p.telefone)
      if (camposBase || faltaCPF || faltaContato) {
        setErroReserva('Preencha todos os campos obrigatórios de todos os passageiros.'); return
      }
    }
    setCarregandoReserva(true); setErroReserva('')
    try {
      const res = await fetch('/api/tarifar-reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vooIda: vooIdaSelecionado, vooVolta: vooVoltaSelecionado, passageiros }),
      })
      const data = await res.json()
      setLocalizador(data.localizador || 'SANDBOX')
    } catch {
      setLocalizador('SANDBOX')
    }
    setCarregandoReserva(false)
    setEtapa('pagamento')
  }

  // ── Emitir passagem ───────────────────────────────────────────
  async function emitirPassagem() {
    if (!cartaoNumero || !cartaoTitular || !cartaoValidade || !cartaoCVV) {
      setErroEmissao('Preencha todos os dados do cartão.'); return
    }
    setCarregandoEmissao(true); setErroEmissao('')
    const res = await fetch('/api/iniciar-emitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localizador,
        cartao: {
          numero: cartaoNumero, titular: cartaoTitular,
          validade: cartaoValidade, cvv: cartaoCVV, parcelas: cartaoParcelas,
        },
      }),
    })
    const data = await res.json()
    setCarregandoEmissao(false)
    if (data.erro) { setErroEmissao(data.erro) }
    else { setNumeroBilhete(data.bilhete); setNomeBilhete(data.passageiro); setEtapa('confirmacao') }
  }

  // ── Nova busca ────────────────────────────────────────────────
  function novaBusca() {
    setEtapa('selecao'); setVoosIda(null); setVoosVolta(null)
    setVooIdaSelecionado(null); setVooVoltaSelecionado(null); setFase('ida')
    setLocalizador(''); setNumeroBilhete(''); setNomeBilhete('')
    setAdultos(1); setCriancas(0); setBebes(0)
    setPassageiros([passageiroVazio('ADT')])
    setCartaoNumero(''); setCartaoTitular(''); setCartaoValidade(''); setCartaoCVV('')
  }

  const minDataVolta    = diaSeguinte(dataIda)
  const voosExibidos    = fase === 'volta' ? voosVolta : voosIda
  const totalEncontrado = voosExibidos?.length ?? 0

  const precoTotal = (vooIdaSelecionado?.Preco?.Total ?? 0) + (vooVoltaSelecionado?.Preco?.Total ?? 0)

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="px-8 py-4 flex items-center justify-between" style={{ backgroundColor: '#1a2744' }}>
        <Image src="/logo.png" alt="Facilita Pass" width={130} height={40} style={{ objectFit: 'contain' }} />
        <button
          onClick={async () => { await createClient().auth.signOut(); router.replace('/') }}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Sair
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6">

        {/* ════════════════════════════════════════════════════════
            ETAPA 1 — SELEÇÃO DO VOO
        ════════════════════════════════════════════════════════ */}
        {etapa === 'selecao' && (
          <div className="py-8 space-y-6">
            {/* Formulário */}
            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
              {/* Tipo */}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Origem</label>
                      <input type="text" placeholder="Ex: GRU" value={origem} maxLength={3}
                        onChange={e => setOrigem(e.target.value.toUpperCase())} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Destino</label>
                      <input type="text" placeholder="Ex: GIG" value={destino} maxLength={3}
                        onChange={e => setDestino(e.target.value.toUpperCase())} className={INPUT} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data de ida</label>
                      <input type="date" value={dataIda}
                        onChange={e => { setDataIda(e.target.value); if (dataVolta && dataVolta <= e.target.value) setDataVolta('') }}
                        className={INPUT} />
                    </div>
                    {tipo === 'idavolta' && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Data de volta</label>
                        <input type="date" value={dataVolta} min={minDataVolta}
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
                  <p className="text-amber-600 text-xs mt-2 font-medium">
                    Máximo de 9 passageiros por busca atingido.
                  </p>
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
            {(carregando || voosIda !== null) && (
              <div>
                {!carregando && fase === 'volta' && vooIdaSelecionado && (
                  <ResumoIdaSelecionada viagem={vooIdaSelecionado}
                    onAlterar={() => { setFase('ida'); setVooIdaSelecionado(null) }} />
                )}

                <div className="flex items-baseline justify-between mb-4">
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

                {carregando && (
                  <div className="space-y-3">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>
                )}

                {!carregando && voosExibidos?.length === 0 && (
                  <div className="bg-white rounded-2xl px-8 py-16 text-center shadow-sm">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <p className="text-gray-500 font-medium">Nenhum voo encontrado para essa rota.</p>
                    <p className="text-gray-400 text-sm mt-1">Tente outras datas ou aeroportos.</p>
                  </div>
                )}

                {!carregando && voosExibidos && voosExibidos.length > 0 && (
                  <div className="space-y-3">
                    {voosExibidos.map((v, idx) => (
                      <VooCard key={v.Id || idx} viagem={v}
                        onSelecionar={fase === 'volta' ? selecionarVooVolta : selecionarVooIda}
                        labelBotao={fase === 'volta' ? 'Selecionar volta'
                          : tipo === 'idavolta' ? 'Selecionar ida' : 'Selecionar'} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            ETAPA 2 — DADOS DO PASSAGEIRO E RESERVA
        ════════════════════════════════════════════════════════ */}
        {etapa === 'passageiro' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />

            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
              {/* Resumo dos voos selecionados */}
              <div className="border-b border-gray-100 pb-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sua viagem</h3>
                {vooIdaSelecionado && <ResumoVoo viagem={vooIdaSelecionado} label="Ida" />}
                {vooVoltaSelecionado && <ResumoVoo viagem={vooVoltaSelecionado} label="Volta" />}
              </div>

              {/* Formulário */}
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
                        {cabecalho && (
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{cabecalho}</p>
                        )}
                        <div className="grid grid-cols-2 gap-4">
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
                        <div className="grid grid-cols-2 gap-4">
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
                        <div className="grid grid-cols-2 gap-4">
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

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEtapa('selecao')}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
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

        {/* ════════════════════════════════════════════════════════
            ETAPA 3 — PAGAMENTO
        ════════════════════════════════════════════════════════ */}
        {etapa === 'pagamento' && (
          <div className="py-4">
            <IndicadorEtapas etapa={etapa} />

            <div className="space-y-4">
              {/* Confirmação da reserva */}
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
                      onChange={e => setCartaoNumero(mascaraCartao(e.target.value))} className={INPUT} />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome no cartão</label>
                    <input type="text" placeholder="JOAO SILVA" value={cartaoTitular}
                      onChange={e => setCartaoTitular(e.target.value.toUpperCase())} className={INPUT} />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Validade</label>
                      <input type="text" placeholder="MM/AA" value={cartaoValidade}
                        onChange={e => setCartaoValidade(mascaraValidade(e.target.value))} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">CVV</label>
                      <input type="text" placeholder="123" maxLength={4} value={cartaoCVV}
                        onChange={e => setCartaoCVV(e.target.value.replace(/\D/g, '').slice(0, 4))} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Parcelas</label>
                      <select value={cartaoParcelas} onChange={e => setCartaoParcelas(Number(e.target.value))}
                        className={`${INPUT} bg-white`}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}x {precoTotal > 0 ? formatPreco(precoTotal / n) : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {erroEmissao && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-600 text-sm">{erroEmissao}</p>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setEtapa('passageiro')}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
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

        {/* ════════════════════════════════════════════════════════
            ETAPA 4 — CONFIRMAÇÃO
        ════════════════════════════════════════════════════════ */}
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
    </div>
  )
}
