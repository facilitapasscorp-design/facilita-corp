'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface Reserva {
  id: string
  localizador: string
  origem: string
  destino: string
  data_voo: string | null
  passageiro_nome: string | null
  valor: number | null
  status: 'Ativa' | 'Emitida' | 'Cancelada' | 'Expirada'
  created_at: string
  companhia: string | null
  grupo_reserva: string | null
  trecho: 'ida' | 'volta' | null
  numero_bilhete: string | null
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  Ativa:     { label: 'Ativa',     bg: '#dcfce7', color: '#16a34a' },
  Emitida:   { label: 'Emitida',   bg: '#dbeafe', color: '#1d4ed8' },
  Cancelada: { label: 'Cancelada', bg: '#fee2e2', color: '#dc2626' },
  Expirada:  { label: 'Expirada',  bg: '#f3f4f6', color: '#6b7280' },
}

const NOME_CIA: Record<string, string> = { G3: 'GOL', LA: 'LATAM', JJ: 'LATAM', AD: 'AZUL', IB: 'Iberia' }
function nomeCompanhia(iata: string | null): string {
  if (!iata) return '—'
  return NOME_CIA[iata] ?? iata
}

interface FormaFinanciamento {
  FinanciamentoId: number; Parcelas: number; PrimeiraParcela: number; DemaisParcela: number
  SemJuros: boolean; Total: number
}

interface VooConsulta {
  numero: string; companhia: string | null; origem: string | null; destino: string | null
  dataSaida: string | null; dataChegada: string | null; horaSaida: number | null; horaChegada: number | null
  duracao: string | null; numeroParadas: number; icone: string | null
}
interface ViagemConsulta { companhia: string | null; origem: string | null; destino: string | null; valorTotal: number | null; voos: VooConsulta[] }
interface BilheteConsulta { numero: string | null; passageiro: string | null; dataDeEmissao: string | null; status: string | null }
interface PassageiroConsulta { nome: string; sobrenome: string; tipo: string }
interface ConsultaReserva {
  localizador: string; status: string | null; valorPendente: number | null
  bilhetes: BilheteConsulta[]; passageiros: PassageiroConsulta[]; viagens: ViagemConsulta[]
  formaPagamento: { bandeira: number | string | null; parcelas: number | string | null } | null
}
function labelParcela(f: FormaFinanciamento): string {
  if (f.Parcelas === 1) return `1x de ${formatValor(f.PrimeiraParcela)}`
  const base = `${f.Parcelas}x de ${formatValor(f.DemaisParcela)}`
  return f.SemJuros ? `${base} sem juros` : `${base} (total ${formatValor(f.Total)})`
}
const BANDEIRA_NOME: Record<string, string> = { '1': 'Visa', VI: 'Visa', '2': 'Amex', AM: 'Amex', '3': 'Mastercard', MC: 'Mastercard', '5': 'Diners', DC: 'Diners', '6': 'Hipercard', HC: 'Hipercard', '7': 'Elo', EL: 'Elo' }
function nomeBandeira(b: number | string | null): string {
  if (b == null) return ''
  return BANDEIRA_NOME[String(b)] ?? String(b)
}

const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function parseWcfDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const m = v.match(/\/Date\((-?\d+)/)
  return m ? new Date(Number(m[1])) : null
}
function formatDataAbreviada(v: string | null | undefined): string {
  const d = parseWcfDate(v)
  if (!d) return ''
  return `${DIAS_SEMANA_ABREV[d.getDay()]}, ${d.getDate()} ${MESES_ABREV[d.getMonth()]}`
}
function diasEntre(saida: string | null | undefined, chegada: string | null | undefined): number {
  const ds = parseWcfDate(saida); const dc = parseWcfDate(chegada)
  if (!ds || !dc) return 0
  const a = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate())
  const b = new Date(dc.getFullYear(), dc.getMonth(), dc.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
function formatHoraVoo(h: number | null): string {
  if (h == null) return '--'
  const s = String(h).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

const INPUT = 'mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function formatData(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
function formatValor(v: number | null) {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function mascaraCartao(v: string): string {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}
function mascaraValidade(v: string): string {
  return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2')
}

function Skeleton() {
  return (
    <div className="rounded-xl border border-gray-100 p-5 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
      </div>
      <div className="flex gap-5 mb-4">
        <div className="h-3 w-24 bg-gray-100 rounded" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
      <div className="h-8 w-32 bg-gray-100 rounded-xl" />
    </div>
  )
}

export default function Painel() {
  const router = useRouter()
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'Ativa' | 'Emitida' | 'Cancelada'>('todas')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | 'hoje' | '7dias' | '30dias'>('todos')

  // ── Estado do modal de cancelamento ────────────────────────────
  const [cancelarReserva,        setCancelarReserva]        = useState<Reserva | null>(null)
  const [carregandoCancelamento, setCarregandoCancelamento] = useState(false)
  const [erroCancelamento,       setErroCancelamento]       = useState('')
  const [sucessoCancelamento,    setSucessoCancelamento]    = useState(false)

  // ── Estado do modal de chamado (solicitar alteração) ───────────
  const [chamadoReserva,   setChamadoReserva]   = useState<Reserva | null>(null)
  const [chamadoTipo,      setChamadoTipo]      = useState<'Alteração' | 'Cancelamento' | 'Dúvida' | 'Outro'>('Alteração')
  const [chamadoMensagem,  setChamadoMensagem]  = useState('')
  const [enviandoChamado,  setEnviandoChamado]  = useState(false)
  const [erroChamado,      setErroChamado]      = useState('')
  const [chamadoEnviado,   setChamadoEnviado]   = useState(false)

  // ── Estado do modal de pagamento ────────────────────────────────
  const [modalReserva,      setModalReserva]      = useState<Reserva | null>(null)
  const [carregandoFormas,  setCarregandoFormas]  = useState(false)
  const [carregandoParcelas, setCarregandoParcelas] = useState(false)
  const [formasFinanciamento, setFormasFinanciamento] = useState<FormaFinanciamento[]>([])
  const [financiamentoId,   setFinanciamentoId]   = useState<number>(61)
  const [parcelas,          setParcelas]          = useState<number>(1)
  const [chaveDeSeguranca,  setChaveDeSeguranca]  = useState<string | null>(null)
  const [codigoPagamento,   setCodigoPagamento]   = useState<number>(2)
  const [cartaoNumero,      setCartaoNumero]      = useState('')
  const [cartaoTitular,     setCartaoTitular]     = useState('')
  const [cartaoValidade,    setCartaoValidade]    = useState('')
  const [cartaoCVV,         setCartaoCVV]         = useState('')
  const [cartaoBandeira,    setCartaoBandeira]    = useState('VI')
  const [carregandoEmissao, setCarregandoEmissao] = useState(false)
  const [erroEmissao,       setErroEmissao]       = useState('')
  const [bilheteEmitido,    setBilheteEmitido]    = useState<{ numero: string; passageiro: string } | null>(null)

  // ── Estado do modal "Ver bilhete" ───────────────────────────────
  const [verBilheteGrupo,     setVerBilheteGrupo]     = useState<Reserva[] | null>(null)
  const [carregandoBilhete,   setCarregandoBilhete]   = useState(false)
  const [erroBilhete,         setErroBilhete]         = useState('')
  const [dadosBilhete,        setDadosBilhete]        = useState<ConsultaReserva[]>([])
  const [emailReenvio,        setEmailReenvio]        = useState('')
  const [enviandoComprovante, setEnviandoComprovante] = useState(false)
  const [comprovanteEnviado,  setComprovanteEnviado]  = useState(false)
  const [erroComprovante,     setErroComprovante]     = useState('')

  useEffect(() => {
    // Trigger server-side cancellation of expired reservas on page load
    fetch('/api/cancelar-expiradas').catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/'); return }

      let query = supabase
        .from('reservas')
        .select('*')
        .order('created_at', { ascending: false })

      if (filtroPeriodo !== 'todos') {
        const agora = new Date()
        let desde: Date
        if (filtroPeriodo === 'hoje') {
          desde = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
        } else if (filtroPeriodo === '7dias') {
          desde = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
        } else {
          desde = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)
        }
        query = query.gte('created_at', desde.toISOString()) as typeof query
      }

      const { data: rows } = await query
      setReservas((rows as Reserva[]) ?? [])
      setCarregando(false)
    })
  }, [router, filtroPeriodo])

  async function sair() {
    await createClient().auth.signOut()
    router.replace('/')
  }

  // Recebe a lista nova de formas de pagamento e só reseta a opção selecionada
  // se a escolha atual do usuário não existir mais na lista.
  function aplicarNovasFormas(formas: FormaFinanciamento[]) {
    setFormasFinanciamento(formas)
    if (formas.length === 0) return
    const aindaValida = formas.some(f => f.FinanciamentoId === financiamentoId)
    if (!aindaValida) {
      setFinanciamentoId(formas[0].FinanciamentoId)
      setParcelas(formas[0].Parcelas)
    }
  }

  // ── Modal: abre e busca formas de financiamento ─────────────────
  async function abrirModal(reserva: Reserva) {
    setModalReserva(reserva)
    setBilheteEmitido(null)
    setErroEmissao('')
    setCartaoNumero(''); setCartaoTitular(''); setCartaoValidade(''); setCartaoCVV('')
    setFormasFinanciamento([]); setFinanciamentoId(61); setParcelas(1)
    setCarregandoFormas(true)
    try {
      const res = await fetch('/api/iniciar-emissao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localizador: reserva.localizador }),
      })
      const data = await res.json()
      if (data.erro) { setErroEmissao(data.erro); return }
      setChaveDeSeguranca(data.chaveDeSeguranca ?? null)
      setCodigoPagamento(data.codigoPagamento ?? 2)
      aplicarNovasFormas(data.formasFinanciamento ?? [])
    } catch {
      setErroEmissao('Erro ao carregar opções de pagamento')
    } finally {
      setCarregandoFormas(false)
    }
  }

  function fecharModal() {
    setModalReserva(null)
    setBilheteEmitido(null)
    setErroEmissao('')
    setFormasFinanciamento([]); setFinanciamentoId(61); setParcelas(1)
    setChaveDeSeguranca(null); setCodigoPagamento(2)
  }

  // Busca formas de financiamento com dados do cartão (2ª chamada, sem IniciarEmissao)
  // Requer número completo (16 dígitos) e validade (MM/AA) para a API aceitar
  async function buscarFormasComCartao(numero: string, validade: string, titular: string, cvv: string, bandeira: string) {
    if (!modalReserva) return
    if (numero.replace(/\D/g, '').length < 16 || validade.length < 5 || !cvv) return
    setCarregandoParcelas(true)
    try {
      const res = await fetch('/api/iniciar-emissao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localizador: modalReserva.localizador, cartao: { numero, validade, titular, cvv, bandeira } }),
      })
      const data = await res.json()
      if (data.erro) return
      aplicarNovasFormas(data.formasFinanciamento ?? [])
    } finally {
      setCarregandoParcelas(false)
    }
  }

  useEffect(() => {
    if (!modalReserva?.localizador) return
    if (cartaoNumero.replace(/\D/g, '').length < 16) return
    if (cartaoValidade.length < 5) return
    if (!cartaoCVV) return
    const t = setTimeout(() => {
      buscarFormasComCartao(cartaoNumero, cartaoValidade, cartaoTitular, cartaoCVV, cartaoBandeira)
    }, 500)
    return () => clearTimeout(t)
  }, [cartaoNumero, cartaoValidade, cartaoCVV, cartaoBandeira, modalReserva?.localizador])

  // ── Modal: emite a passagem ──────────────────────────────────────
  async function emitir() {
    if (!cartaoNumero || !cartaoTitular || !cartaoValidade || !cartaoCVV) {
      setErroEmissao('Preencha todos os dados do cartão.'); return
    }
    setCarregandoEmissao(true); setErroEmissao('')
    try {
      const res = await fetch('/api/iniciar-emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localizador:     modalReserva!.localizador,
          chaveDeSeguranca,
          codigoPagamento,
          financiamentoId,
          cartao: { numero: cartaoNumero, titular: cartaoTitular, validade: cartaoValidade, cvv: cartaoCVV, parcelas, bandeira: cartaoBandeira },
        }),
      })
      const data = await res.json()
      if (data.erro) { setErroEmissao(data.erro); return }
      setBilheteEmitido({ numero: data.bilhete, passageiro: data.passageiro })
      setReservas(prev => prev.map(r =>
        r.id === modalReserva!.id ? { ...r, status: 'Emitida', numero_bilhete: data.bilhete } : r
      ))
      try {
        await createClient().from('reservas')
          .update({ status: 'Emitida', numero_bilhete: data.bilhete })
          .eq('localizador', modalReserva!.localizador)
      } catch {}
    } catch {
      setErroEmissao('Erro ao emitir passagem')
    } finally {
      setCarregandoEmissao(false)
    }
  }

  async function confirmarCancelamento() {
    if (!cancelarReserva) return
    setCarregandoCancelamento(true); setErroCancelamento('')
    try {
      const res = await fetch('/api/cancelar-reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localizador: cancelarReserva.localizador }),
      })
      const data = await res.json()
      if (data.erro) { setErroCancelamento(data.erro); return }
      setSucessoCancelamento(true)
      setReservas(prev => prev.map(r =>
        r.id === cancelarReserva.id ? { ...r, status: 'Cancelada' } : r
      ))
      try {
        await createClient().from('reservas')
          .update({ status: 'Cancelada' })
          .eq('localizador', cancelarReserva.localizador)
      } catch {}
    } catch {
      setErroCancelamento('Erro ao cancelar reserva')
    } finally {
      setCarregandoCancelamento(false)
    }
  }

  function fecharModalCancelamento() {
    setCancelarReserva(null); setErroCancelamento(''); setSucessoCancelamento(false)
  }

  async function enviarChamado() {
    if (!chamadoMensagem.trim()) { setErroChamado('Descreva sua solicitação.'); return }
    if (!chamadoReserva) return
    setEnviandoChamado(true); setErroChamado('')
    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reserva_id: chamadoReserva.id,
          localizador: chamadoReserva.localizador,
          tipo: chamadoTipo,
          mensagem: chamadoMensagem,
        }),
      })
      const data = await res.json()
      if (data.erro) { setErroChamado(data.erro); return }
      setChamadoEnviado(true)
    } catch {
      setErroChamado('Erro ao enviar solicitação')
    } finally {
      setEnviandoChamado(false)
    }
  }

  function fecharModalChamado() {
    setChamadoReserva(null); setChamadoTipo('Alteração'); setChamadoMensagem('')
    setErroChamado(''); setChamadoEnviado(false)
  }

  function statusExibido(r: Reserva): Reserva['status'] {
    if (r.status === 'Ativa') {
      const inicioDia = new Date()
      inicioDia.setHours(0, 0, 0, 0)
      if (new Date(r.created_at) < inicioDia) return 'Expirada'
    }
    return r.status
  }

  const reservasFiltradas = reservas.filter(r => {
    const s = statusExibido(r)
    return filtroStatus === 'todas' || s === filtroStatus
  })

  const contagemStatus = {
    Ativa:     reservas.filter(r => statusExibido(r) === 'Ativa').length,
    Emitida:   reservas.filter(r => statusExibido(r) === 'Emitida').length,
    Cancelada: reservas.filter(r => statusExibido(r) === 'Cancelada').length,
  }

  // Agrupa reservas com o mesmo grupo_reserva (ida/volta de companhias
  // diferentes); reservas sem grupo_reserva continuam soltas como hoje.
  type ItemExibido = { tipo: 'unica'; reserva: Reserva } | { tipo: 'grupo'; grupoReserva: string; reservas: Reserva[] }
  const itensExibidos: ItemExibido[] = []
  const gruposVistos = new Set<string>()
  for (const r of reservasFiltradas) {
    if (r.grupo_reserva) {
      if (gruposVistos.has(r.grupo_reserva)) continue
      gruposVistos.add(r.grupo_reserva)
      itensExibidos.push({
        tipo: 'grupo', grupoReserva: r.grupo_reserva,
        reservas: reservasFiltradas.filter(x => x.grupo_reserva === r.grupo_reserva),
      })
    } else {
      itensExibidos.push({ tipo: 'unica', reserva: r })
    }
  }

  function encontrarOutraDoGrupo(r: Reserva): Reserva | null {
    if (!r.grupo_reserva) return null
    return reservas.find(x => x.grupo_reserva === r.grupo_reserva && x.id !== r.id) ?? null
  }
  function todasDoGrupo(r: Reserva): Reserva[] {
    if (!r.grupo_reserva) return [r]
    return reservas.filter(x => x.grupo_reserva === r.grupo_reserva)
  }

  // ── "Ver bilhete": consulta ao vivo na WOOBA (dados completos de voos,
  // passageiros e pagamento não cabem no que guardamos localmente) ──────
  async function abrirVerBilhete(r: Reserva) {
    const grupo = todasDoGrupo(r)
    setVerBilheteGrupo(grupo)
    setDadosBilhete([]); setErroBilhete('')
    setEmailReenvio(''); setComprovanteEnviado(false); setErroComprovante('')
    setCarregandoBilhete(true)
    try {
      const resultados = await Promise.all(grupo.map(g =>
        fetch('/api/consultar-reserva', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localizador: g.localizador }),
        }).then(res => res.json())
      ))
      const comErro = resultados.find(d => d.erro)
      if (comErro) { setErroBilhete(comErro.erro); return }
      setDadosBilhete(resultados as ConsultaReserva[])
    } catch {
      setErroBilhete('Erro ao consultar o bilhete.')
    } finally {
      setCarregandoBilhete(false)
    }
  }
  function fecharVerBilhete() {
    setVerBilheteGrupo(null); setDadosBilhete([]); setErroBilhete('')
  }
  async function reenviarComprovante() {
    if (!verBilheteGrupo || !emailReenvio.trim()) return
    setEnviandoComprovante(true); setErroComprovante(''); setComprovanteEnviado(false)
    try {
      const resultados = await Promise.all(verBilheteGrupo.map(g =>
        fetch('/api/reenviar-comprovante', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localizador: g.localizador, para: emailReenvio.trim() }),
        }).then(res => res.json())
      ))
      const comErro = resultados.find(d => d.erro)
      if (comErro) { setErroComprovante(comErro.erro); return }
      setComprovanteEnviado(true)
    } catch {
      setErroComprovante('Erro ao reenviar o comprovante.')
    } finally {
      setEnviandoComprovante(false)
    }
  }

  function renderReserva(r: Reserva, aninhada = false) {
    const exibido = statusExibido(r)
    const st = STATUS[exibido] ?? STATUS.Expirada
    const pendenteAninhada = aninhada && exibido === 'Ativa'
    return (
      <div
        key={r.id}
        className={aninhada ? 'rounded-lg border p-4 transition-colors' : 'rounded-xl border p-5 transition-colors'}
        style={{ borderColor: pendenteAninhada ? '#fbbf24' : '#f3f4f6', backgroundColor: pendenteAninhada ? '#fffbeb' : 'white' }}
        onMouseEnter={e => { if (!pendenteAninhada) (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb' }}
        onMouseLeave={e => { if (!pendenteAninhada) (e.currentTarget as HTMLDivElement).style.borderColor = '#f3f4f6' }}
      >
        {aninhada && r.trecho && (
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#6b7684' }}>
            {r.trecho === 'ida' ? '✈ Ida' : '✈ Volta'} — {nomeCompanhia(r.companhia)}
            {pendenteAninhada && <span style={{ color: '#b45309' }}>· Pagamento pendente</span>}
          </p>
        )}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-base sm:text-lg font-bold text-gray-900 tracking-widest font-mono">
                {r.localizador}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: st.bg, color: st.color }}>
                {st.label}
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-gray-700">{r.origem} → {r.destino}</p>
          </div>
          <p className="text-base sm:text-lg font-bold text-gray-900 shrink-0">{formatValor(r.valor)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-4">
          {r.passageiro_nome && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {r.passageiro_nome}
            </span>
          )}
          {r.data_voo && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatData(r.data_voo)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {exibido === 'Ativa' && (
            <>
              <button
                onClick={() => abrirModal(r)}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#18283A' }}
              >
                Pagar e emitir
              </button>
              <button
                onClick={() => { setCancelarReserva(r); setErroCancelamento(''); setSucessoCancelamento(false) }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
              >
                Cancelar
              </button>
              <span className="text-xs font-medium text-amber-600">
                ⚠️ Expira às 23:59 de hoje
              </span>
            </>
          )}

          {exibido === 'Emitida' && (
            <button onClick={() => abrirVerBilhete(r)}
              className="px-5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              Ver bilhete
            </button>
          )}

          <button
            onClick={() => { setChamadoReserva(r); setChamadoTipo('Alteração'); setChamadoMensagem(''); setErroChamado(''); setChamadoEnviado(false) }}
            className="text-xs font-medium underline transition-colors"
            style={{ color: '#6b7684' }}
          >
            Solicitar alteração
          </button>
        </div>
      </div>
    )
  }

  const outraDoGrupo = modalReserva ? encontrarOutraDoGrupo(modalReserva) : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F5F3' }}>
      {/* Header */}
      <div
        className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-gray-200"
        style={{ backgroundColor: '#F4F5F3' }}
      >
        <button type="button" onClick={() => router.push('/busca')} aria-label="Ir para a busca"
          className="cursor-pointer transition-opacity hover:opacity-85">
          <Image src="/logo-header.png" alt="Facilita Pass" width={163} height={36} className="h-7 sm:h-9 w-auto" style={{ objectFit: 'contain' }} />
        </button>
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={() => router.push('/busca')}
            className="text-sm font-medium transition-colors hover:opacity-60"
            style={{ color: '#18283A' }}
          >
            Buscar voos
          </button>
          <button
            onClick={sair}
            className="text-sm transition-colors hover:opacity-60"
            style={{ color: '#18283A' }}
          >
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Minhas reservas</h1>
            <button
              onClick={() => router.push('/busca')}
              className="px-4 sm:px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#18283A' }}
            >
              + Nova busca
            </button>
          </div>

          {/* Filtros */}
          {!carregando && reservas.length > 0 && (
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {([
                  { id: 'todas',     label: `Todas (${reservas.length})` },
                  { id: 'Ativa',     label: `Reservadas (${contagemStatus.Ativa})` },
                  { id: 'Emitida',   label: `Emitidas (${contagemStatus.Emitida})` },
                  { id: 'Cancelada', label: `Canceladas (${contagemStatus.Cancelada})` },
                ] as const).map(op => (
                  <button key={op.id} onClick={() => setFiltroStatus(op.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filtroStatus === op.id
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={filtroStatus === op.id ? { backgroundColor: '#18283A' } : {}}>
                    {op.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {([
                  { id: 'todos',   label: 'Qualquer data' },
                  { id: 'hoje',    label: 'Hoje' },
                  { id: '7dias',   label: 'Últimos 7 dias' },
                  { id: '30dias',  label: 'Últimos 30 dias' },
                ] as const).map(op => (
                  <button key={op.id} onClick={() => { setFiltroPeriodo(op.id); setCarregando(true) }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filtroPeriodo === op.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {carregando ? (
            <div className="p-6 space-y-4">
              <Skeleton /><Skeleton /><Skeleton />
            </div>
          ) : reservas.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#d1d5db' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="font-medium" style={{ color: '#6b7684' }}>Nenhuma reserva encontrada</p>
              <p className="text-sm mt-1" style={{ color: '#7a8694' }}>Suas reservas aparecerão aqui após a busca.</p>
            </div>
          ) : reservasFiltradas.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-gray-400">Nenhuma reserva encontrada para esse filtro.</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-4">
              {itensExibidos.map(item => {
                if (item.tipo === 'unica') return renderReserva(item.reserva)
                const grupo = item.reservas
                const ida = grupo.find(r => r.trecho === 'ida') ?? grupo[0]
                return (
                  <div key={item.grupoReserva} className="rounded-xl border-2 p-4 sm:p-5" style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900">Viagem {ida.origem} ⇄ {ida.destino}</h3>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}>
                        {grupo.length} companhias — {grupo.length} pagamentos
                      </span>
                    </div>
                    <div className="space-y-3">
                      {grupo.map(r => renderReserva(r, true))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de cancelamento ───────────────────────────────── */}
      {cancelarReserva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={e => { if (e.target === e.currentTarget) fecharModalCancelamento() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              {sucessoCancelamento ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-900 mb-1">Reserva cancelada</p>
                  <p className="text-sm text-gray-500 mb-5">
                    O localizador <span className="font-mono font-bold">{cancelarReserva.localizador}</span> foi cancelado com sucesso.
                  </p>
                  <button onClick={fecharModalCancelamento}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#18283A' }}>
                    Fechar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Cancelar reserva</p>
                      <p className="text-xs text-gray-400 font-mono">{cancelarReserva.localizador}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-5">
                    Deseja realmente cancelar esta reserva? Esta ação não pode ser desfeita.
                  </p>
                  {erroCancelamento && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-red-600 text-sm">{erroCancelamento}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={fecharModalCancelamento}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                      Não, voltar
                    </button>
                    <button onClick={confirmarCancelamento} disabled={carregandoCancelamento}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">
                      {carregandoCancelamento ? 'Cancelando...' : 'Sim, cancelar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de chamado (solicitar alteração) ─────────────────── */}
      {chamadoReserva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={e => { if (e.target === e.currentTarget) fecharModalChamado() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              {chamadoEnviado ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-900 mb-1">Solicitação enviada!</p>
                  <p className="text-sm text-gray-500 mb-5">Nossa equipe entrará em contato.</p>
                  <button onClick={fecharModalChamado}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#18283A' }}>
                    Fechar
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-gray-900 mb-1">Solicitar alteração</p>
                  <p className="text-xs text-gray-400 mb-4">Conte pra gente o que você precisa e nossa equipe entra em contato.</p>

                  <div className="rounded-xl p-4 space-y-1.5 mb-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Localizador</span>
                      <span className="font-mono font-bold text-gray-900 tracking-widest">{chamadoReserva.localizador}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Rota</span>
                      <span className="text-sm font-semibold text-gray-700">{chamadoReserva.origem} → {chamadoReserva.destino}</span>
                    </div>
                    {chamadoReserva.data_voo && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">Data</span>
                        <span className="text-sm text-gray-700">{formatData(chamadoReserva.data_voo)}</span>
                      </div>
                    )}
                  </div>

                  <label className="text-sm font-medium text-gray-700">Tipo de solicitação</label>
                  <select value={chamadoTipo} onChange={e => setChamadoTipo(e.target.value as typeof chamadoTipo)} className={`${INPUT} bg-white`}>
                    <option value="Alteração">Alteração</option>
                    <option value="Cancelamento">Cancelamento</option>
                    <option value="Dúvida">Dúvida</option>
                    <option value="Outro">Outro</option>
                  </select>

                  <label className="text-sm font-medium text-gray-700 mt-4 block">Descreva sua solicitação</label>
                  <textarea value={chamadoMensagem} onChange={e => setChamadoMensagem(e.target.value)} rows={4}
                    placeholder="Explique o que você precisa..."
                    className={`${INPUT} resize-none`} />

                  {erroChamado && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-red-600 text-sm">{erroChamado}</p>
                    </div>
                  )}

                  <div className="flex gap-3 mt-5">
                    <button onClick={fecharModalChamado}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={enviarChamado} disabled={enviandoChamado}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: '#18283A' }}>
                      {enviandoChamado ? 'Enviando...' : 'Enviar solicitação'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de pagamento ──────────────────────────────────── */}
      {modalReserva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={e => { if (e.target === e.currentTarget) fecharModal() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {bilheteEmitido ? 'Passagem emitida!' : 'Emitir passagem'}
              </h2>
              <button onClick={fecharModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Aviso de pagamento separado (reserva com múltiplos localizadores) */}
              {outraDoGrupo && (
                <div className="rounded-xl px-4 py-3 space-y-2" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <p className="text-sm font-semibold" style={{ color: '#1e40af' }}>
                    Você está pagando: {modalReserva.trecho === 'volta' ? 'Volta' : 'Ida'} — {nomeCompanhia(modalReserva.companhia)} — Localizador {modalReserva.localizador} — {modalReserva.origem} → {modalReserva.destino} — {formatValor(modalReserva.valor)}
                  </p>
                  {statusExibido(outraDoGrupo) !== 'Emitida' && (
                    <p className="text-xs" style={{ color: '#1e40af' }}>
                      Este pagamento cobre apenas o trecho da {nomeCompanhia(modalReserva.companhia)}. O trecho da {nomeCompanhia(outraDoGrupo.companhia)} (localizador {outraDoGrupo.localizador}) deve ser pago separadamente.
                    </p>
                  )}
                </div>
              )}

              {/* Resumo da reserva */}
              <div className="rounded-xl p-4 space-y-1.5" style={{ backgroundColor: '#f8fafc' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Localizador</span>
                  <span className="font-mono font-bold text-gray-900 tracking-widest">{modalReserva.localizador}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Rota</span>
                  <span className="text-sm font-semibold text-gray-700">{modalReserva.origem} → {modalReserva.destino}</span>
                </div>
                {modalReserva.data_voo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Data</span>
                    <span className="text-sm text-gray-700">{formatData(modalReserva.data_voo)}</span>
                  </div>
                )}
                {modalReserva.passageiro_nome && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Passageiro</span>
                    <span className="text-sm text-gray-700">{modalReserva.passageiro_nome}</span>
                  </div>
                )}
                {modalReserva.valor && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 mt-1.5">
                    <span className="text-xs text-gray-500 font-medium">Total</span>
                    <span className="text-base font-bold text-gray-900">{formatValor(modalReserva.valor)}</span>
                  </div>
                )}
              </div>

              {/* Estado: carregando formas */}
              {carregandoFormas && (
                <div className="flex items-center justify-center py-8 gap-3 text-gray-400">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-sm">Carregando opções de pagamento...</span>
                </div>
              )}

              {/* Estado: sucesso */}
              {bilheteEmitido && (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  {bilheteEmitido.passageiro && (
                    <p className="text-sm text-gray-500 mb-3">
                      <span className="font-medium text-gray-700">{bilheteEmitido.passageiro}</span>, sua viagem está confirmada.
                    </p>
                  )}
                  {bilheteEmitido.numero && (
                    <div className="inline-block bg-gray-50 rounded-xl px-6 py-4">
                      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Número do bilhete</p>
                      <p className="text-2xl font-bold text-gray-900 tracking-wider">{bilheteEmitido.numero}</p>
                    </div>
                  )}
                  {outraDoGrupo && statusExibido(outraDoGrupo) !== 'Emitida' && (
                    <div className="mt-5 rounded-xl px-4 py-3 text-left" style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a' }}>
                      <p className="text-sm" style={{ color: '#92400e' }}>
                        Não esqueça de pagar o outro trecho ({nomeCompanhia(outraDoGrupo.companhia)} — {outraDoGrupo.localizador}) para garantir sua viagem completa.
                      </p>
                      <button onClick={() => abrirModal(outraDoGrupo)}
                        className="mt-2.5 px-4 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#92400e' }}>
                        Pagar agora
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Formulário de cartão */}
              {!carregandoFormas && !bilheteEmitido && (
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
                  <div>
                    <label className="text-sm font-medium text-gray-700">Número do cartão</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cartaoNumero}
                      onChange={e => {
                        const val = mascaraCartao(e.target.value)
                        setCartaoNumero(val)
                      }}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome no cartão</label>
                    <input type="text" placeholder="JOAO SILVA" value={cartaoTitular}
                      onChange={e => setCartaoTitular(e.target.value.toUpperCase())} className={INPUT} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Validade</label>
                      <input type="text" placeholder="MM/AA" value={cartaoValidade}
                        onChange={e => {
                          const val = mascaraValidade(e.target.value)
                          setCartaoValidade(val)
                        }} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">CVV</label>
                      <input type="text" placeholder="123" maxLength={4} value={cartaoCVV}
                        onChange={e => setCartaoCVV(e.target.value.replace(/\D/g, '').slice(0, 4))} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Parcelas</label>
                      {carregandoParcelas ? (
                        <div className={`${INPUT} flex items-center text-gray-400`}>Calculando parcelas...</div>
                      ) : (
                      <select
                        value={financiamentoId}
                        onChange={e => {
                          const id = Number(e.target.value)
                          const forma = formasFinanciamento.find(f => f.FinanciamentoId === id)
                          setFinanciamentoId(id)
                          setParcelas(forma?.Parcelas ?? 1)
                        }}
                        className={`${INPUT} bg-white`}
                      >
                        {formasFinanciamento.length > 0
                          ? formasFinanciamento.map(f => (
                              <option key={f.FinanciamentoId} value={f.FinanciamentoId}>
                                {labelParcela(f)}
                              </option>
                            ))
                          : <option value={61}>1x {modalReserva.valor ? formatValor(modalReserva.valor) : ''}</option>
                        }
                      </select>
                      )}
                    </div>
                  </div>

                  {erroEmissao && (
                    <div className="rounded-lg p-3 bg-red-50 border border-red-200">
                      <p className="text-red-600 text-sm">{erroEmissao}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Erro ao carregar formas */}
              {!carregandoFormas && !bilheteEmitido && erroEmissao && formasFinanciamento.length === 0 && (
                <div className="rounded-lg p-3 bg-red-50 border border-red-200">
                  <p className="text-red-600 text-sm">{erroEmissao}</p>
                </div>
              )}
            </div>

            {/* Footer do modal */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              {bilheteEmitido ? (
                <button onClick={fecharModal}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#18283A' }}>
                  Fechar
                </button>
              ) : (
                <>
                  <button onClick={fecharModal}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={emitir}
                    disabled={carregandoEmissao || carregandoFormas || carregandoParcelas}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: '#18283A' }}
                  >
                    {carregandoEmissao ? 'Emitindo...' : 'Emitir passagem'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal "Ver bilhete" ─────────────────────────────────── */}
      {verBilheteGrupo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:relative print:p-0 print:bg-white"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={e => { if (e.target === e.currentTarget) fecharVerBilhete() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-h-none print:max-w-none">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between print:border-b-2" style={{ borderColor: '#18283A' }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#B79D7D' }}>Facilita Pass</p>
                <h2 className="text-lg font-bold" style={{ color: '#18283A' }}>Comprovante da viagem</h2>
              </div>
              <button onClick={fecharVerBilhete} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 print:hidden">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {carregandoBilhete && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 w-48 bg-gray-100 rounded" />
                  <div className="h-24 bg-gray-100 rounded-xl" />
                  <div className="h-24 bg-gray-100 rounded-xl" />
                </div>
              )}

              {!carregandoBilhete && erroBilhete && (
                <div className="rounded-lg p-3 bg-red-50 border border-red-200">
                  <p className="text-red-600 text-sm">{erroBilhete}</p>
                </div>
              )}

              {!carregandoBilhete && !erroBilhete && dadosBilhete.map(dados => (
                <div key={dados.localizador} className="rounded-xl border border-gray-100 p-4 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Localizador</p>
                      <p className="text-base font-bold tracking-widest" style={{ color: '#18283A' }}>{dados.localizador}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                      {dados.status ?? 'Emitida'}
                    </span>
                  </div>

                  {dados.bilhetes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Bilhete(s)</p>
                      {dados.bilhetes.map((b, i) => (
                        <p key={i} className="text-sm text-gray-700">
                          <span className="font-mono font-semibold">{b.numero ?? '—'}</span>
                          {b.passageiro && <span className="text-gray-400"> — {b.passageiro}</span>}
                        </p>
                      ))}
                    </div>
                  )}

                  {dados.passageiros.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Passageiro(s)</p>
                      <p className="text-sm text-gray-700">
                        {dados.passageiros.map(p => `${p.nome} ${p.sobrenome}`.trim()).join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {dados.viagens.map((v, vi) => {
                      const numEscalas = Math.max(v.voos.length - 1, 0)
                      const escalasTexto = numEscalas === 0 ? 'Direto'
                        : numEscalas === 1 ? `1 escala em ${v.voos[0]?.destino ?? ''}`
                        : `${numEscalas} escalas`
                      const primeiro = v.voos[0]
                      const ultimo = v.voos[v.voos.length - 1]
                      const diffDias = diasEntre(primeiro?.dataSaida, ultimo?.dataChegada)
                      return (
                        <div key={vi} className="rounded-lg bg-gray-50 p-3">
                          <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                            <p className="text-sm font-semibold text-gray-800">
                              {nomeCompanhia(v.companhia)} — {v.origem} → {v.destino}
                            </p>
                            <p className="text-xs text-gray-400">{formatDataAbreviada(primeiro?.dataSaida)}</p>
                          </div>
                          <p className="text-sm text-gray-600 flex items-center gap-1.5 flex-wrap">
                            {formatHoraVoo(primeiro?.horaSaida ?? null)} → {formatHoraVoo(ultimo?.horaChegada ?? null)}
                            {diffDias > 0 && (
                              <span className="inline-flex items-center justify-center text-[10px] font-bold text-white rounded px-1 leading-tight" style={{ backgroundColor: '#dc2626' }}>
                                +{diffDias}
                              </span>
                            )}
                            <span className="text-gray-400">· {primeiro?.duracao ?? ''} · {escalasTexto}</span>
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Valor pago</p>
                      <p className="text-base font-bold text-gray-900">
                        {formatValor(dados.viagens.reduce((s, v) => s + (v.valorTotal ?? 0), 0) || null)}
                      </p>
                    </div>
                    {dados.formaPagamento?.parcelas != null && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Forma de pagamento</p>
                        <p className="text-sm text-gray-700">
                          {nomeBandeira(dados.formaPagamento.bandeira)} — {dados.formaPagamento.parcelas}x
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {!carregandoBilhete && !erroBilhete && dadosBilhete.length > 0 && (
                <div className="rounded-xl p-4 print:hidden" style={{ backgroundColor: '#faf7f2', border: '1px solid #B79D7D55' }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: '#18283A' }}>Reenviar comprovante por e-mail</p>
                  {comprovanteEnviado ? (
                    <p className="text-sm text-green-600">✅ Comprovante reenviado com sucesso.</p>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="email" placeholder="email@destino.com" value={emailReenvio}
                        onChange={e => setEmailReenvio(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={reenviarComprovante} disabled={enviandoComprovante || !emailReenvio.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: '#18283A' }}>
                        {enviandoComprovante ? 'Enviando...' : 'Reenviar'}
                      </button>
                    </div>
                  )}
                  {erroComprovante && <p className="text-sm text-red-600 mt-2">{erroComprovante}</p>}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 print:hidden">
              <button onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Imprimir
              </button>
              <button onClick={fecharVerBilhete}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#18283A' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
