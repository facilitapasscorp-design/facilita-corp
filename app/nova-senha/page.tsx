'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function NovaSenha() {
  const router = useRouter()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const [sessaoOk, setSessaoOk] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessaoOk(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessaoOk(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function salvarSenha() {
    if (!novaSenha) { setErro('Digite a nova senha.'); return }
    if (novaSenha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem.'); return }

    setSalvando(true)
    setErro('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) {
      setErro('Erro ao salvar senha. O link pode ter expirado.')
    } else {
      setSucesso(true)
      setTimeout(() => router.push('/'), 3000)
    }
    setSalvando(false)
  }

  return (
    <div className="flex min-h-screen">
      {/* Lado esquerdo – azul escuro */}
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
      </div>

      {/* Lado direito – branco */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center px-8 sm:px-12 lg:px-16">
          <div className="w-full max-w-sm">
            {sucesso ? (
              <div className="text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Senha atualizada!</h1>
                <p className="text-gray-500 text-sm mb-2">
                  Sua senha foi redefinida com sucesso.
                </p>
                <p className="text-gray-400 text-xs">Redirecionando para o login...</p>
              </div>
            ) : !sessaoOk ? (
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Link inválido</h1>
                <p className="text-gray-500 text-sm mb-6">
                  Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.
                </p>
                <Link
                  href="/recuperar-senha"
                  className="text-sm font-medium"
                  style={{ color: '#1a2744' }}
                >
                  Solicitar novo link
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Criar nova senha</h1>
                <p className="text-gray-500 text-sm mb-8">
                  Escolha uma senha segura para sua conta.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">
                      Nova senha
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmar}
                      onChange={e => setConfirmar(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && salvarSenha()}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>

                  {erro && (
                    <p className="text-red-500 text-sm">{erro}</p>
                  )}

                  <button
                    onClick={salvarSenha}
                    disabled={salvando}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: '#1a2744' }}
                  >
                    {salvando ? 'Salvando...' : 'Salvar nova senha'}
                  </button>
                </div>

                <div className="mt-6 text-center">
                  <Link
                    href="/"
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Voltar ao login
                  </Link>
                </div>
              </>
            )}
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
