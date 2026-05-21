'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

const ADMIN_EMAIL = 'corp@facilitapass.com.br'

// ── Types ──────────────────────────────────────────────────────────────────
interface Empresa {
  id: string; nome: string; cnpj: string | null
  telefone: string | null; email: string | null; ativa: boolean; created_at: string
}
interface UsuarioEmpresa {
  id: string; user_id: string; empresa_id: string
  nome: string | null; email: string | null; created_at: string
  empresas?: { nome: string } | null
}
interface Reserva {
  id: string; user_id: string; localizador: string
  origem: string; destino: string; data_voo: string | null
  passageiro_nome: string | null; valor: number | null; status: string; created_at: string
}
interface InfoUsuario { empresa_id: string; empresa_nome: string; usuario_nome: string }

type Secao = 'empresas' | 'usuarios' | 'reservas'

// ── Helpers ────────────────────────────────────────────────────────────────
function mascaraCNPJ(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}
function formatData(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatValor(v: number | null) {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Ativa:     { bg: '#dcfce7', color: '#16a34a' },
  Emitida:   { bg: '#dbeafe', color: '#1d4ed8' },
  Cancelada: { bg: '#fee2e2', color: '#dc2626' },
  Expirada:  { bg: '#f3f4f6', color: '#6b7280' },
}

const INPUT = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'

// ── Sidebar icons ──────────────────────────────────────────────────────────
function IconPredio({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 9h1m4 0h1M9 13h1m4 0h1" />
    </svg>
  )
}
function IconPessoa({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}
function IconPassagem({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  )
}

// ── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {children}
      </div>
    </div>
  )
}

// ── Table wrapper ──────────────────────────────────────────────────────────
function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-gray-100">
        {cols.map(c => (
          <th key={c} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Admin() {
  const router = useRouter()
  const [secao, setSecao] = useState<Secao>('empresas')
  const [accessToken, setAccessToken] = useState('')

  // Empresas
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [modalEmpresa, setModalEmpresa] = useState(false)
  const [novaEmpresa, setNovaEmpresa] = useState({ nome: '', cnpj: '', telefone: '', email: '' })
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false)
  const [erroEmpresa, setErroEmpresa] = useState('')

  // Usuários
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
  const [modalUsuario, setModalUsuario] = useState(false)
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', empresa_id: '' })
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [erroUsuario, setErroUsuario] = useState('')

  // Reservas
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [mapaInfo, setMapaInfo] = useState<Record<string, InfoUsuario>>({})
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/'); return }
      if (data.session.user.email !== ADMIN_EMAIL) { router.replace('/busca'); return }
      setAccessToken(data.session.access_token)
      await carregarTudo(supabase)
      setCarregando(false)
    })
  }, [router])

  async function carregarTudo(supabase: ReturnType<typeof createClient>) {
    const [empRes, usrRes, resRes] = await Promise.all([
      supabase.from('empresas').select('*').order('nome'),
      supabase.from('usuarios_empresas').select('*, empresas(nome)').order('created_at', { ascending: false }),
      supabase.from('reservas').select('*').order('created_at', { ascending: false }),
    ])
    setEmpresas((empRes.data ?? []) as Empresa[])
    setUsuarios((usrRes.data ?? []) as UsuarioEmpresa[])
    setReservas((resRes.data ?? []) as Reserva[])

    const mapa: Record<string, InfoUsuario> = {}
    for (const u of (usrRes.data ?? []) as UsuarioEmpresa[]) {
      mapa[u.user_id] = {
        empresa_id:   u.empresa_id,
        empresa_nome: (u.empresas as { nome: string } | null)?.nome ?? '—',
        usuario_nome: u.nome ?? '—',
      }
    }
    setMapaInfo(mapa)
  }

  async function salvarEmpresa() {
    if (!novaEmpresa.nome) { setErroEmpresa('Nome é obrigatório.'); return }
    setSalvandoEmpresa(true); setErroEmpresa('')
    const supabase = createClient()
    const { error } = await supabase.from('empresas').insert({
      nome: novaEmpresa.nome,
      cnpj: novaEmpresa.cnpj || null,
      telefone: novaEmpresa.telefone || null,
      email: novaEmpresa.email || null,
    })
    if (error) { setErroEmpresa(error.message) }
    else {
      setModalEmpresa(false)
      setNovaEmpresa({ nome: '', cnpj: '', telefone: '', email: '' })
      const { data } = await supabase.from('empresas').select('*').order('nome')
      setEmpresas((data ?? []) as Empresa[])
    }
    setSalvandoEmpresa(false)
  }

  async function toggleAtiva(empresa: Empresa) {
    const supabase = createClient()
    await supabase.from('empresas').update({ ativa: !empresa.ativa }).eq('id', empresa.id)
    setEmpresas(prev => prev.map(e => e.id === empresa.id ? { ...e, ativa: !e.ativa } : e))
  }

  async function salvarUsuario() {
    const { nome, email, senha, empresa_id } = novoUsuario
    if (!nome || !email || !senha || !empresa_id) { setErroUsuario('Preencha todos os campos.'); return }
    setSalvandoUsuario(true); setErroUsuario('')
    const res = await fetch('/api/admin/criar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ nome, email, senha, empresa_id }),
    })
    const data = await res.json()
    if (data.erro) { setErroUsuario(data.erro) }
    else {
      setModalUsuario(false)
      setNovoUsuario({ nome: '', email: '', senha: '', empresa_id: '' })
      const supabase = createClient()
      const { data: rows } = await supabase.from('usuarios_empresas').select('*, empresas(nome)').order('created_at', { ascending: false })
      setUsuarios((rows ?? []) as UsuarioEmpresa[])
    }
    setSalvandoUsuario(false)
  }

  // Reservas filtradas
  const reservasFiltradas = reservas.filter(r => {
    const info = mapaInfo[r.user_id]
    if (filtroEmpresa && info?.empresa_id !== filtroEmpresa) return false
    if (filtroStatus && r.status !== filtroStatus) return false
    return true
  })

  const navItems: { id: Secao; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    { id: 'empresas',  label: 'Empresas',  icon: a => <IconPredio   cls={`w-5 h-5 ${a ? 'text-white' : 'text-white/50'}`} /> },
    { id: 'usuarios',  label: 'Usuários',  icon: a => <IconPessoa   cls={`w-5 h-5 ${a ? 'text-white' : 'text-white/50'}`} /> },
    { id: 'reservas',  label: 'Reservas',  icon: a => <IconPassagem cls={`w-5 h-5 ${a ? 'text-white' : 'text-white/50'}`} /> },
  ]

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1a2744' }}>
        <p className="text-white/40 text-sm">Carregando painel...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1a2744' }}>
      {/* Header */}
      <div
        className="px-8 py-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Image src="/logo.png" alt="Facilita Pass" width={130} height={40} style={{ objectFit: 'contain' }} />
        <button
          onClick={async () => { await createClient().auth.signOut(); router.replace('/') }}
          className="text-sm transition-colors"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)' }}
        >
          Sair
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="w-52 shrink-0 flex flex-col py-6 px-3 gap-1"
          style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          {navItems.map(item => {
            const active = secao === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSecao(item.id)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-colors"
                style={{
                  backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
              >
                {item.icon(active)}
                {item.label}
              </button>
            )
          })}
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto p-6">

          {/* ── EMPRESAS ─────────────────────────────────────────── */}
          {secao === 'empresas' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Empresas</h2>
                <button
                  onClick={() => { setErroEmpresa(''); setModalEmpresa(true) }}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#1a2744' }}
                >
                  + Nova empresa
                </button>
              </div>

              {empresas.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">Nenhuma empresa cadastrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <TableHead cols={['Nome', 'CNPJ', 'Telefone', 'E-mail', 'Status', '']} />
                    <tbody className="divide-y divide-gray-50">
                      {empresas.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3.5 px-4 text-sm font-semibold text-gray-900">{e.nome}</td>
                          <td className="py-3.5 px-4 text-sm text-gray-500 font-mono">{e.cnpj ?? '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-gray-500">{e.telefone ?? '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-gray-500">{e.email ?? '—'}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={e.ativa
                                ? { backgroundColor: '#dcfce7', color: '#16a34a' }
                                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                            >
                              {e.ativa ? 'Ativa' : 'Inativa'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => toggleAtiva(e)}
                              className="text-xs font-medium underline transition-colors"
                              style={{ color: e.ativa ? '#dc2626' : '#16a34a' }}
                            >
                              {e.ativa ? 'Desativar' : 'Ativar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── USUÁRIOS ─────────────────────────────────────────── */}
          {secao === 'usuarios' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Usuários</h2>
                <button
                  onClick={() => { setErroUsuario(''); setModalUsuario(true) }}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#1a2744' }}
                >
                  + Novo usuário
                </button>
              </div>

              {usuarios.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">Nenhum usuário cadastrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <TableHead cols={['Nome', 'E-mail', 'Empresa', 'Cadastrado em']} />
                    <tbody className="divide-y divide-gray-50">
                      {usuarios.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3.5 px-4 text-sm font-semibold text-gray-900">{u.nome ?? '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-gray-500">{u.email ?? '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-gray-700">
                            {(u.empresas as { nome: string } | null)?.nome ?? '—'}
                          </td>
                          <td className="py-3.5 px-4 text-sm text-gray-400">{formatData(u.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── RESERVAS ─────────────────────────────────────────── */}
          {secao === 'reservas' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-900">Reservas</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={filtroEmpresa}
                    onChange={e => setFiltroEmpresa(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Todas as empresas</option>
                    {empresas.map(e => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                  <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Todos os status</option>
                    {['Ativa', 'Emitida', 'Cancelada', 'Expirada'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
                {reservasFiltradas.length} {reservasFiltradas.length === 1 ? 'reserva' : 'reservas'}
              </div>

              {reservasFiltradas.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">Nenhuma reserva encontrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <TableHead cols={['Localizador', 'Empresa', 'Passageiro', 'Rota', 'Data', 'Valor', 'Status']} />
                    <tbody className="divide-y divide-gray-50">
                      {reservasFiltradas.map(r => {
                        const info = mapaInfo[r.user_id]
                        const st = STATUS_BADGE[r.status] ?? STATUS_BADGE.Expirada
                        return (
                          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3.5 px-4 text-sm font-bold text-gray-900 font-mono tracking-wider">
                              {r.localizador}
                            </td>
                            <td className="py-3.5 px-4 text-sm text-gray-700">{info?.empresa_nome ?? '—'}</td>
                            <td className="py-3.5 px-4 text-sm text-gray-700">
                              {r.passageiro_nome ?? info?.usuario_nome ?? '—'}
                            </td>
                            <td className="py-3.5 px-4 text-sm font-medium text-gray-900">
                              {r.origem} → {r.destino}
                            </td>
                            <td className="py-3.5 px-4 text-sm text-gray-500">{formatData(r.data_voo)}</td>
                            <td className="py-3.5 px-4 text-sm font-semibold text-gray-900">{formatValor(r.valor)}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: st.bg, color: st.color }}
                              >
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ── Modal nova empresa ─────────────────────────────────────── */}
      {modalEmpresa && (
        <Modal onClose={() => setModalEmpresa(false)}>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Nova empresa</h3>
          <p className="text-sm text-gray-500 mb-5">Preencha os dados da empresa.</p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome da empresa *</label>
              <input type="text" placeholder="Empresa LTDA" value={novaEmpresa.nome}
                onChange={e => setNovaEmpresa(p => ({ ...p, nome: e.target.value }))}
                className={INPUT} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">CNPJ</label>
              <input type="text" placeholder="00.000.000/0000-00" value={novaEmpresa.cnpj}
                onChange={e => setNovaEmpresa(p => ({ ...p, cnpj: mascaraCNPJ(e.target.value) }))}
                className={INPUT} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Telefone</label>
              <input type="text" placeholder="(11) 99999-9999" value={novaEmpresa.telefone}
                onChange={e => setNovaEmpresa(p => ({ ...p, telefone: e.target.value }))}
                className={INPUT} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">E-mail</label>
              <input type="email" placeholder="contato@empresa.com" value={novaEmpresa.email}
                onChange={e => setNovaEmpresa(p => ({ ...p, email: e.target.value }))}
                className={INPUT} />
            </div>

            {erroEmpresa && <p className="text-red-500 text-sm">{erroEmpresa}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalEmpresa(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={salvarEmpresa} disabled={salvandoEmpresa}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#1a2744' }}>
                {salvandoEmpresa ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal novo usuário ─────────────────────────────────────── */}
      {modalUsuario && (
        <Modal onClose={() => setModalUsuario(false)}>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Novo usuário</h3>
          <p className="text-sm text-gray-500 mb-5">O usuário receberá acesso ao sistema.</p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome completo *</label>
              <input type="text" placeholder="João Silva" value={novoUsuario.nome}
                onChange={e => setNovoUsuario(p => ({ ...p, nome: e.target.value }))}
                className={INPUT} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">E-mail *</label>
              <input type="email" placeholder="joao@empresa.com" value={novoUsuario.email}
                onChange={e => setNovoUsuario(p => ({ ...p, email: e.target.value }))}
                className={INPUT} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Senha temporária *</label>
              <input type="text" placeholder="Mínimo 6 caracteres" value={novoUsuario.senha}
                onChange={e => setNovoUsuario(p => ({ ...p, senha: e.target.value }))}
                className={INPUT} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Empresa *</label>
              <select value={novoUsuario.empresa_id}
                onChange={e => setNovoUsuario(p => ({ ...p, empresa_id: e.target.value }))}
                className={`${INPUT} bg-white`}>
                <option value="">Selecionar empresa</option>
                {empresas.filter(e => e.ativa).map(e => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>

            {erroUsuario && <p className="text-red-500 text-sm">{erroUsuario}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalUsuario(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={salvarUsuario} disabled={salvandoUsuario}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#1a2744' }}>
                {salvandoUsuario ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
