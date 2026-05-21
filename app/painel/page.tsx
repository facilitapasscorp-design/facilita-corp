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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1a2744' }}>
      {/* Header */}
      <div
        className="px-8 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Image
          src="/logo.png"
          alt="Facilita Pass"
          width={130}
          height={40}
          style={{ objectFit: 'contain' }}
        />
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
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Cabeçalho do card */}
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

          {/* Conteúdo */}
          {carregando ? (
            <div className="p-6 space-y-4">
              <Skeleton /><Skeleton /><Skeleton />
            </div>
          ) : reservas.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <svg
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: '#d1d5db' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="font-medium" style={{ color: '#9ca3af' }}>Nenhuma reserva encontrada</p>
              <p className="text-sm mt-1" style={{ color: '#d1d5db' }}>
                Suas reservas aparecerão aqui após a busca.
              </p>
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
                    {/* Linha principal */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-lg font-bold text-gray-900 tracking-widest font-mono">
                            {r.localizador}
                          </span>
                          <span
                            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ backgroundColor: st.bg, color: st.color }}
                          >
                            {st.label}
                          </span>
                        </div>
                        <p className="text-base font-semibold text-gray-700">
                          {r.origem} → {r.destino}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-gray-900 shrink-0 ml-4">
                        {formatValor(r.valor)}
                      </p>
                    </div>

                    {/* Detalhes */}
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

                    {/* Ações */}
                    {r.status === 'Ativa' && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => router.push('/busca')}
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
                      <button
                        className="px-5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
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
    </div>
  )
}
