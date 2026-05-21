'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'

export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function enviarLink() {
    if (!email) { setErro('Digite seu e-mail.'); return }
    setEnviando(true)
    setErro('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    if (error) {
      setErro('Erro ao enviar e-mail. Verifique o endereço e tente novamente.')
    } else {
      setEnviado(true)
    }
    setEnviando(false)
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
            {enviado ? (
              <div className="text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">E-mail enviado!</h1>
                <p className="text-gray-500 text-sm mb-8">
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                </p>
                <Link
                  href="/"
                  className="text-sm font-medium"
                  style={{ color: '#1a2744' }}
                >
                  ← Voltar ao login
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Recuperar senha</h1>
                <p className="text-gray-500 text-sm mb-8">
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
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
                      onKeyDown={e => e.key === 'Enter' && enviarLink()}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                  </div>

                  {erro && (
                    <p className="text-red-500 text-sm">{erro}</p>
                  )}

                  <button
                    onClick={enviarLink}
                    disabled={enviando}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: '#1a2744' }}
                  >
                    {enviando ? 'Enviando...' : 'Enviar link'}
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
