'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'
import s from './site.module.css'

type GastoMensal = '' | 'ate-5k' | '5k-20k' | '20k-50k' | 'acima-50k'

// Mesmo destino do formulário antigo: grava em `leads` e dispara o e-mail.
export default function FormLead() {
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [empresa, setEmpresa]           = useState('')
  const [email, setEmail]               = useState('')
  const [telefone, setTelefone]         = useState('')
  const [gastoMensal, setGastoMensal]   = useState<GastoMensal>('')
  const [enviando, setEnviando]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [sucesso, setSucesso]           = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nomeCompleto || !empresa || !email || !telefone || !gastoMensal) {
      setErro('Preencha todos os campos.')
      return
    }
    setEnviando(true)
    setErro('')

    const supabase = createClient()
    const { error } = await supabase.from('leads').insert({
      nome_completo: nomeCompleto, empresa, email, telefone, gasto_mensal: gastoMensal,
    })
    if (error) {
      setErro('Não conseguimos enviar agora. Tente de novo em instantes ou chame no WhatsApp.')
      setEnviando(false)
      return
    }

    // O e-mail é um extra: se falhar, o contato já está salvo.
    try {
      await supabase.functions.invoke('send-lead-email', {
        body: { para: 'corp@facilitapass.com.br', nome: nomeCompleto, empresa, email, telefone, gastoMensal },
      })
    } catch {
      // silencioso de propósito
    }

    setSucesso(true)
    setEnviando(false)
  }

  if (sucesso) {
    return (
      <div className={s.sucessoForm}>
        <b>Recebemos o seu contato.</b>
        <span>
          Falamos com você em breve, no e-mail ou no telefone que você deixou.
        </span>
      </div>
    )
  }

  return (
    <form className={s.form} onSubmit={enviar}>
      <input
        className={s.largo}
        type="text"
        placeholder="Nome completo"
        value={nomeCompleto}
        onChange={e => setNomeCompleto(e.target.value)}
      />
      <input
        className={s.largo}
        type="text"
        placeholder="Empresa"
        value={empresa}
        onChange={e => setEmpresa(e.target.value)}
      />
      <input
        type="email"
        placeholder="E-mail corporativo"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="tel"
        placeholder="Telefone ou WhatsApp"
        value={telefone}
        onChange={e => setTelefone(e.target.value)}
      />
      <select
        className={s.largo}
        value={gastoMensal}
        onChange={e => setGastoMensal(e.target.value as GastoMensal)}
        style={{ color: gastoMensal === '' ? 'rgba(255,255,255,.58)' : '#fff' }}
      >
        <option value="" disabled style={{ color: '#374151' }}>Gasto médio mensal com viagens</option>
        <option value="ate-5k" style={{ color: '#374151' }}>Até R$ 5 mil</option>
        <option value="5k-20k" style={{ color: '#374151' }}>R$ 5 mil a R$ 20 mil</option>
        <option value="20k-50k" style={{ color: '#374151' }}>R$ 20 mil a R$ 50 mil</option>
        <option value="acima-50k" style={{ color: '#374151' }}>Acima de R$ 50 mil</option>
      </select>

      {erro && <p className={s.erroForm}>{erro}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Enviando...' : 'Cadastrar minha empresa'}
      </button>
    </form>
  )
}
