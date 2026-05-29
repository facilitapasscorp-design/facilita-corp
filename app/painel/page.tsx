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
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  Ativa:     { label: 'Ativa',     bg: '#dcfce7', color: '#16a34a' },
  Emitida:   { label: 'Emitida',   bg: '#dbeafe', color: '#1d4ed8' },
  Cancelada: { label: 'Cancelada', bg: '#fee2e2', color: '#dc2626' },
  Expirada:  { label: 'Expirada',  bg: '#f3f4f6', color: '#6b7280' },
}

const INPUT = 'mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

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

  // ── Estado do modal de pagamento ────────────────────────────────
  const [modalReserva,      setModalReserva]      = useState<Reserva | null>(null)
  const [carregandoFormas,  setCarregandoFormas]  = useState(false)
  const [formasFinanciamento, setFormasFinanciamento] = useState<{ FinanciamentoId: number; Parcelas: number }[]>([])
  const [financiamentoId,   setFinanciamentoId]   = useState<number>(61)
  const [parcelas,          setParcelas]          = useState<number>(1)
  const [chaveDeSeguranca,  setChaveDeSeguranca]  = useState<string | null>(null)
  const [codigoPagamento,   setCodigoPagamento]   = useState<number>(2)
  const [cartaoNumero,      setCartaoNumero]      = useState('')
  const [cartaoTitular,     setCartaoTitular]     = useState('')
  const [cartaoValidade,    setCartaoValidade]    = useState('')
  const [cartaoCVV,         setCartaoCVV]         = useState('')
  const [carregandoEmissao, setCarregandoEmissao] = useState(false)
  const [erroEmissao,       setErroEmissao]       = useState('')
  const [bilheteEmitido,    setBilheteEmitido]    = useState<{ numero: string; passageiro: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/'); return }
      const { data: rows } = await supabase
        .from('reservas')
        .select('*')
        .order('created_at', { ascending: false })
      setReservas((rows as Reserva[]) ?? [])
      setCarregando(false)
    })
  }, [router])

  async function sair() {
    await createClient().auth.signOut()
    router.replace('/')
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
      const formas: { FinanciamentoId: number; Parcelas: number }[] = data.formasFinanciamento ?? []
      setFormasFinanciamento(formas)
      if (formas.length > 0) {
        setFinanciamentoId(formas[0].FinanciamentoId)
        setParcelas(formas[0].Parcelas)
      }
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
  async function buscarFormasComCartao(numero: string, validade: string, localizador: string) {
    if (numero.replace(/\D/g, '').length < 16) return
    if (validade.length < 5) return
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
      if (formas.length > 0) {
        setFinanciamentoId(formas[0].FinanciamentoId)
        setParcelas(formas[0].Parcelas)
      }
    } catch {}
  }

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
          cartao: { numero: cartaoNumero, titular: cartaoTitular, validade: cartaoValidade, cvv: cartaoCVV, parcelas },
        }),
      })
      const data = await res.json()
      if (data.erro) { setErroEmissao(data.erro); return }
      setBilheteEmitido({ numero: data.bilhete, passageiro: data.passageiro })
      setReservas(prev => prev.map(r =>
        r.id === modalReserva!.id ? { ...r, status: 'Emitida' } : r
      ))
      try {
        await createClient().from('reservas')
          .update({ status: 'Emitida' })
          .eq('localizador', modalReserva!.localizador)
      } catch {}
    } catch {
      setErroEmissao('Erro ao emitir passagem')
    } finally {
      setCarregandoEmissao(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1a2744' }}>
      {/* Header */}
      <div
        className="px-8 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Image src="/logo.png" alt="Facilita Pass" width={130} height={40} style={{ objectFit: 'contain' }} />
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push('/busca')}
            className="text-sm font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,0.65)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)' }}
          >
            Buscar voos
          </button>
          <button
            onClick={sair}
            className="text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)' }}
          >
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Minhas reservas</h1>
            <button
              onClick={() => router.push('/busca')}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#1a2744' }}
            >
              + Nova busca
            </button>
          </div>

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
              <p className="font-medium" style={{ color: '#9ca3af' }}>Nenhuma reserva encontrada</p>
              <p className="text-sm mt-1" style={{ color: '#d1d5db' }}>Suas reservas aparecerão aqui após a busca.</p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {reservas.map(r => {
                const st = STATUS[r.status] ?? STATUS.Expirada
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border p-5 transition-colors"
                    style={{ borderColor: '#f3f4f6' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#f3f4f6' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-lg font-bold text-gray-900 tracking-widest font-mono">
                            {r.localizador}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ backgroundColor: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-base font-semibold text-gray-700">{r.origem} → {r.destino}</p>
                      </div>
                      <p className="text-lg font-bold text-gray-900 shrink-0 ml-4">{formatValor(r.valor)}</p>
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

                    {r.status === 'Ativa' && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => abrirModal(r)}
                          className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
                          style={{ backgroundColor: '#1a2744' }}
                        >
                          Pagar e emitir
                        </button>
                        <span className="text-xs font-medium text-amber-600">
                          ⚠️ Expira às 23:00 de hoje
                        </span>
                      </div>
                    )}

                    {r.status === 'Emitida' && (
                      <button className="px-5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                        Ver bilhete
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

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
                </div>
              )}

              {/* Formulário de cartão */}
              {!carregandoFormas && !bilheteEmitido && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Número do cartão</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cartaoNumero}
                      onChange={e => {
                        const val = mascaraCartao(e.target.value)
                        setCartaoNumero(val)
                        if (modalReserva) buscarFormasComCartao(val, cartaoValidade, modalReserva.localizador)
                      }}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome no cartão</label>
                    <input type="text" placeholder="JOAO SILVA" value={cartaoTitular}
                      onChange={e => setCartaoTitular(e.target.value.toUpperCase())} className={INPUT} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Validade</label>
                      <input type="text" placeholder="MM/AA" value={cartaoValidade}
                        onChange={e => {
                          const val = mascaraValidade(e.target.value)
                          setCartaoValidade(val)
                          if (modalReserva && val.length >= 5) buscarFormasComCartao(cartaoNumero, val, modalReserva.localizador)
                        }} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">CVV</label>
                      <input type="text" placeholder="123" maxLength={4} value={cartaoCVV}
                        onChange={e => setCartaoCVV(e.target.value.replace(/\D/g, '').slice(0, 4))} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Parcelas</label>
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
                                {f.Parcelas}x {modalReserva.valor ? formatValor(modalReserva.valor! / f.Parcelas) : ''}
                              </option>
                            ))
                          : <option value={61}>1x {modalReserva.valor ? formatValor(modalReserva.valor) : ''}</option>
                        }
                      </select>
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
                  style={{ backgroundColor: '#1a2744' }}>
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
                    disabled={carregandoEmissao || carregandoFormas}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: '#1a2744' }}
                  >
                    {carregandoEmissao ? 'Emitindo...' : 'Emitir passagem'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
