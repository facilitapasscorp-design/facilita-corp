'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import s from './entrar.module.css'

export default function Entrar() {
  const router = useRouter()
  const [email, setEmail]           = useState('')
  const [senha, setSenha]           = useState('')
  const [erro, setErro]             = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    const supabase = createClient()
    const { error, data } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro('E-mail ou senha incorretos.')
      setCarregando(false)
      return
    }

    const destino = data.user?.email === 'corp@facilitapass.com.br' ? '/admin' : '/busca'
    router.push(destino)
  }

  return (
    <main className={s.page}>
      <Link href="/">
        <Image
          className={s.logo}
          src="/logo-marca.png"
          alt="Facilita Pass"
          width={839}
          height={120}
          priority
        />
      </Link>

      <form className={s.cartao} onSubmit={entrar}>
        <h1>Acesse sua conta</h1>
        <p className={s.ajuda}>Entre com o e-mail e a senha da sua empresa.</p>

        <label className={s.campo}>
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="seu@empresa.com.br"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>

        <label className={s.campo}>
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
          />
        </label>

        {erro && <p className={s.erro}>{erro}</p>}

        <button className={s.botao} type="submit" disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>

        <Link className={s.esqueci} href="/recuperar-senha">Esqueceu sua senha?</Link>
      </form>

      <div className={s.rodape}>
        <Link href="/">Voltar para o site</Link>
        <span>&copy; {new Date().getFullYear()} Facilita Pass Corp</span>
      </div>
    </main>
  )
}
