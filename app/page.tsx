'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

type GastoMensal = '' | 'ate-5k' | '5k-20k' | '20k-50k' | 'acima-50k'

export default function Home() {
  const router = useRouter()

  // Login
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erroLogin, setErroLogin] = useState('')
  const [carregandoLogin, setCarregandoLogin] = useState(false)

  // Lead form
  const [modalAberto, setModalAberto] = useState(false)
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [emailLead, setEmailLead] = useState('')
  const [telefone, setTelefone] = useState('')
  const [gastoMensal, setGastoMensal] = useState<GastoMensal>('')
  const [enviandoLead, setEnviandoLead] = useState(false)
  const [sucessoLead, setSucessoLead] = useState(false)
  const [erroLead, setErroLead] = useState('')

  function abrirModal() {
    setSucessoLead(false)
    setErroLead('')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setNomeCompleto('')
    setEmpresa('')
    setEmailLead('')
    setTelefone('')
    setGastoMensal('')
    setErroLead('')
    setSucessoLead(false)
  }

  async function entrar() {
    setCarregandoLogin(true)
    setErroLogin('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErroLogin('E-mail ou senha incorretos.')
    } else {
      router.push('/busca')
    }
    setCarregandoLogin(false)
  }

  async function solicitarAcesso() {
    if (!nomeCompleto || !empresa || !emailLead || !telefone || !gastoMensal) {
      setErroLead('Preencha todos os campos.')
      return
    }
    setEnviandoLead(true)
    setErroLead('')

    const supabase = createClient()

    const { error: insertError } = await supabase.from('leads').insert({
      nome_completo: nomeCompleto,
      empresa,
      email: emailLead,
      telefone,
      gasto_mensal: gastoMensal,
    })

    if (insertError) {
      setErroLead('Erro ao enviar solicitação. Tente novamente.')
      setEnviandoLead(false)
      return
    }

    await supabase.functions.invoke('send-lead-email', {
      body: {
        para: 'corp@facilitapass.com.br',
        nome: nomeCompleto,
        empresa,
        email: emailLead,
        telefone,
        gastoMensal,
      },
    })

    setSucessoLead(true)
    setEnviandoLead(false)
  }

  const inputLeadClass =
    'w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-blue-300 focus:outline-none focus:border-blue-300 focus:bg-white/15 transition-colors'

  return (
    <div className="flex min-h-screen">
      {/* ── Lado esquerdo – azul escuro ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col"
        style={{ backgroundColor: '#1a2744' }}
      >
        <div className="p-10">
          <Image
            src="/logo.png"
            alt="Facilita Pass"
            width={160}
            height={48}
            style={{ objectFit: 'contain', objectPosition: 'left' }}
          />
        </div>

        <div className="flex-1 flex flex-col justify-center px-12 pb-10">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white leading-snug mb-4">
              Soluções em viagens corporativas com controle, economia e previsibilidade
            </h2>
            <p className="text-blue-200 text-sm leading-relaxed max-w-sm">
              A Facilita Pass traz soluções inteligentes em viagens para a sua empresa,
              garantindo economia comprovada.
            </p>
          </div>

          <button
            onClick={abrirModal}
            className="self-start px-7 py-3 rounded-xl text-sm font-semibold text-white border border-white/30 transition-all"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.12)' }}
          >
            Tenho interesse
          </button>
        </div>
      </div>

      {/* ── Modal de solicitação ── */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) fecharModal() }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-8 relative"
            style={{ backgroundColor: '#1a2744', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
          >
            <button
              onClick={fecharModal}
              className="absolute top-4 right-4 text-blue-300 hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {sucessoLead ? (
              <div className="text-center py-8">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-semibold text-lg">Solicitação enviada!</p>
                <p className="text-blue-200 text-sm mt-2 mb-6">Nossa equipe entrará em contato em breve.</p>
                <button
                  onClick={fecharModal}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-white font-semibold text-lg mb-1">Solicitar acesso</h3>
                <p className="text-blue-200 text-sm mb-6">Preencha os dados e nossa equipe entra em contato.</p>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={nomeCompleto}
                    onChange={e => setNomeCompleto(e.target.value)}
                    className={inputLeadClass}
                  />
                  <input
                    type="text"
                    placeholder="Empresa"
                    value={empresa}
                    onChange={e => setEmpresa(e.target.value)}
                    className={inputLeadClass}
                  />
                  <input
                    type="email"
                    placeholder="E-mail corporativo"
                    value={emailLead}
                    onChange={e => setEmailLead(e.target.value)}
                    className={inputLeadClass}
                  />
                  <input
                    type="tel"
                    placeholder="Telefone / WhatsApp"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    className={inputLeadClass}
                  />
                  <select
                    value={gastoMensal}
                    onChange={e => setGastoMensal(e.target.value as GastoMensal)}
                    className={`${inputLeadClass} ${gastoMensal === '' ? 'text-blue-300' : 'text-white'}`}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="" disabled style={{ color: '#374151' }}>
                      Gasto médio mensal com viagens
                    </option>
                    <option value="ate-5k" style={{ color: '#374151' }}>Até R$ 5 mil</option>
                    <option value="5k-20k" style={{ color: '#374151' }}>R$ 5 mil a R$ 20 mil</option>
                    <option value="20k-50k" style={{ color: '#374151' }}>R$ 20 mil a R$ 50 mil</option>
                    <option value="acima-50k" style={{ color: '#374151' }}>Acima de R$ 50 mil</option>
                  </select>

                  {erroLead && (
                    <p className="text-red-300 text-xs">{erroLead}</p>
                  )}

                  <button
                    onClick={solicitarAcesso}
                    disabled={enviandoLead}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 mt-1"
                    style={{ backgroundColor: '#3b82f6' }}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.backgroundColor = '#2563eb' }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.backgroundColor = '#3b82f6' }}
                  >
                    {enviandoLead ? 'Enviando...' : 'Solicitar acesso'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Lado direito – branco ── */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center px-8 sm:px-12 lg:px-16">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Acesse sua conta</h1>
            <p className="text-gray-500 text-sm mb-8">
              Entre com suas credenciais para continuar.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && entrar()}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && entrar()}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>

              {erroLogin && (
                <p className="text-red-500 text-sm">{erroLogin}</p>
              )}

              <button
                onClick={entrar}
                disabled={carregandoLogin}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#1a2744' }}
              >
                {carregandoLogin ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="text-center">
                <a
                  href="/recuperar-senha"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Esqueceu sua senha?
                </a>
              </div>
            </div>

            <p className="mt-8 text-xs text-gray-400 text-center lg:hidden">
              Não tem acesso?{' '}
              <a href="mailto:corp@facilitapass.com.br" className="text-blue-600 underline">
                Fale conosco
              </a>
            </p>
          </div>
        </div>

        <div className="p-8 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Facilita Pass. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
