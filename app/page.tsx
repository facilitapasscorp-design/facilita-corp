'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import s from './login.module.css'

type GastoMensal = '' | 'ate-5k' | '5k-20k' | '20k-50k' | 'acima-50k'

export default function Home() {
  const router = useRouter()

  // Login
  const [email, setEmail]               = useState('')
  const [senha, setSenha]               = useState('')
  const [erroLogin, setErroLogin]       = useState('')
  const [carregandoLogin, setCarregandoLogin] = useState(false)

  // Lead / modal
  const [modalAberto, setModalAberto]   = useState(false)
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [empresa, setEmpresa]           = useState('')
  const [emailLead, setEmailLead]       = useState('')
  const [telefone, setTelefone]         = useState('')
  const [gastoMensal, setGastoMensal]   = useState<GastoMensal>('')
  const [enviandoLead, setEnviandoLead] = useState(false)
  const [sucessoLead, setSucessoLead]   = useState(false)
  const [erroLead, setErroLead]         = useState('')

  function abrirModal() {
    setSucessoLead(false); setErroLead(''); setModalAberto(true)
  }
  function fecharModal() {
    setModalAberto(false); setNomeCompleto(''); setEmpresa('')
    setEmailLead(''); setTelefone(''); setGastoMensal('')
    setErroLead(''); setSucessoLead(false)
  }

  async function entrar() {
    setCarregandoLogin(true); setErroLogin('')
    const supabase = createClient()
    const { error, data } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErroLogin('E-mail ou senha incorretos.')
    } else {
      const destino = data.user?.email === 'corp@facilitapass.com.br' ? '/admin' : '/busca'
      router.push(destino)
    }
    setCarregandoLogin(false)
  }

  async function solicitarAcesso() {
    if (!nomeCompleto || !empresa || !emailLead || !telefone || !gastoMensal) {
      setErroLead('Preencha todos os campos.'); return
    }
    setEnviandoLead(true); setErroLead('')
    const supabase = createClient()
    const { error: insertError } = await supabase.from('leads').insert({
      nome_completo: nomeCompleto, empresa, email: emailLead, telefone, gasto_mensal: gastoMensal,
    })
    if (insertError) {
      setErroLead('Erro ao enviar solicitação. Tente novamente.')
      setEnviandoLead(false); return
    }
    await supabase.functions.invoke('send-lead-email', {
      body: { para: 'corp@facilitapass.com.br', nome: nomeCompleto, empresa, email: emailLead, telefone, gastoMensal },
    })
    setSucessoLead(true); setEnviandoLead(false)
  }

  const inputLeadStyle: React.CSSProperties = {
    width: '100%', height: '40px', border: '1px solid rgba(255,255,255,.25)',
    background: 'rgba(255,255,255,.10)', borderRadius: '10px', color: '#fff',
    padding: '0 13px', outline: 'none', marginBottom: '12px', fontSize: '13px',
    fontFamily: 'inherit',
  }

  return (
    <main className={s.page}>

      {/* ── Login side ──────────────────────────────────────────── */}
      <section className={s.loginSide}>
        <div className={s.logo} aria-label="Facilita Pass Soluções em Viagens Corporativas">
          <Image src="/logo.png" alt="Facilita Pass" width={200} height={60} style={{ objectFit: 'contain', objectPosition: 'left' }} />
        </div>

        <div className={s.loginCard}>
          <h1>Acesse sua conta</h1>
          <div className={s.helper}>Entre com suas credenciais para continuar.</div>

          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && entrar()}
          />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && entrar()}
          />

          {erroLogin && <p className={s.erroLogin}>{erroLogin}</p>}

          <button className={s.loginButton} onClick={entrar} disabled={carregandoLogin}>
            {carregandoLogin ? 'Entrando...' : 'Entrar'}
          </button>

          <a className={s.forgot} href="/recuperar-senha">Esqueceu sua senha?</a>
        </div>

        <div className={s.footer}>© {new Date().getFullYear()} Facilita Pass. Todos os direitos reservados.</div>
      </section>

      {/* ── Story side ──────────────────────────────────────────── */}
      <section className={s.storySide}>
        <div className={s.copyWrap}>
          <div className={s.badge}>
            <span className={s.badgeDot}></span> Sem adesão · Sem mensalidade
          </div>

          <h2>Viagens corporativas com autonomia, controle e suporte humano.</h2>

          <p className={s.lead}>
            Uma plataforma para sua empresa{' '}
            <strong>cotar, aprovar, emitir e acompanhar passagens aéreas</strong>{' '}
            com política de viagem, relatórios e atendimento da Facilita Pass quando precisar.
          </p>

          <div className={s.ctaRow}>
            <button className={s.primaryCta} onClick={abrirModal}>
              Cadastrar minha empresa
            </button>
            <div className={s.secondaryNote}>
              Solicite o cadastro para conectar sua empresa à Facilita Pass Corp.
            </div>
          </div>

          <div className={s.metrics}>
            <div className={s.metricCard}>
              <div className={s.number}>Aéreo</div>
              <div className={s.metricTitle}>Busca e emissão online</div>
              <div className={s.metricText}>Cotações, aprovações, emissões e histórico de passagens em um único fluxo.</div>
            </div>
            <div className={s.metricCard}>
              <div className={s.number}>30%</div>
              <div className={s.metricTitle}>Potencial de economia</div>
              <div className={s.metricText}>Comparação de tarifas, política de compra e antecedência para melhorar o saving.</div>
            </div>
            <div className={s.metricCard}>
              <div className={s.number}>24h</div>
              <div className={s.metricTitle}>Atendimento humano</div>
              <div className={s.metricText}>Suporte para urgências, alterações, cancelamentos e imprevistos de viagem.</div>
            </div>
          </div>

          <div className={s.features}>
            <div className={s.feature}>
              <div className={s.check}>✓</div>
              <div><strong>Política de viagem</strong><span>Regras de compra, aprovação e conformidade aplicadas ao fluxo aéreo.</span></div>
            </div>
            <div className={s.feature}>
              <div className={s.check}>✓</div>
              <div><strong>Relatórios gerenciais</strong><span>Gastos por rota, colaborador, período e centro de custo.</span></div>
            </div>
            <div className={s.feature}>
              <div className={s.check}>✓</div>
              <div><strong>Saving mensurável</strong><span>Economia acompanhada por tarifa, antecedência e comportamento de compra.</span></div>
            </div>
            <div className={s.feature}>
              <div className={s.check}>✓</div>
              <div><strong>Pós-venda assistido</strong><span>Apoio em remarcações, cancelamentos, créditos e alterações.</span></div>
            </div>
          </div>
        </div>

        {/* ── Visual wrap ─────────────────────────────────────── */}
        <div className={s.visualWrap}>
          <div className={s.personCard} aria-label="Funcionária corporativa usando celular no saguão do aeroporto" />

          <div className={s.flightCard}>
            <div className={s.flightTop}>
              <strong>Viagem corporativa</strong>
              <span className={s.policy}>Dentro da política</span>
            </div>
            <div className={s.route}>
              <div className={s.airport}><span>Origem</span><b>MGF</b></div>
              <div className={s.line}></div>
              <div className={s.airport}><span>Destino</span><b>CGH</b></div>
            </div>
          </div>

          <div className={s.approvalCard}>
            <strong>Aprovação em tempo real</strong>
            <div className={s.approvalLine}><span>Centro de custo</span><b>Comercial</b></div>
            <div className={s.approvalLine}><span>Política</span><b>Conforme</b></div>
            <div className={s.approvalLine}><span>Economia estimada</span><b>Até 30%</b></div>
          </div>
        </div>
      </section>

      {/* ── Modal de solicitação de acesso ──────────────────────── */}
      {modalAberto && (
        <div
          onClick={e => { if (e.target === e.currentTarget) fecharModal() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{
            width: '100%', maxWidth: '420px', borderRadius: '20px', padding: '32px',
            backgroundColor: '#132134', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', position: 'relative',
          }}>
            <button
              onClick={fecharModal}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#B79D7D' }}
              aria-label="Fechar"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {sucessoLead ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>Solicitação enviada!</p>
                <p style={{ color: '#93a3b8', fontSize: '13px', marginBottom: '24px' }}>Nossa equipe entrará em contato em breve.</p>
                <button onClick={fecharModal} style={{ padding: '10px 24px', borderRadius: '10px', background: '#B79D7D', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>Solicitar acesso</p>
                <p style={{ color: '#93a3b8', fontSize: '12.5px', marginBottom: '20px' }}>Preencha os dados e nossa equipe entra em contato.</p>

                <input type="text" placeholder="Nome completo" value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} style={{ ...inputLeadStyle }} />
                <input type="text" placeholder="Empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} style={{ ...inputLeadStyle }} />
                <input type="email" placeholder="E-mail corporativo" value={emailLead} onChange={e => setEmailLead(e.target.value)} style={{ ...inputLeadStyle }} />
                <input type="tel" placeholder="Telefone / WhatsApp" value={telefone} onChange={e => setTelefone(e.target.value)} style={{ ...inputLeadStyle }} />
                <select
                  value={gastoMensal}
                  onChange={e => setGastoMensal(e.target.value as GastoMensal)}
                  style={{ ...inputLeadStyle, color: gastoMensal === '' ? '#9aa2b1' : '#fff' }}
                >
                  <option value="" disabled style={{ color: '#374151' }}>Gasto médio mensal com viagens</option>
                  <option value="ate-5k" style={{ color: '#374151' }}>Até R$ 5 mil</option>
                  <option value="5k-20k" style={{ color: '#374151' }}>R$ 5 mil a R$ 20 mil</option>
                  <option value="20k-50k" style={{ color: '#374151' }}>R$ 20 mil a R$ 50 mil</option>
                  <option value="acima-50k" style={{ color: '#374151' }}>Acima de R$ 50 mil</option>
                </select>

                {erroLead && <p style={{ color: '#fca5a5', fontSize: '12px', marginBottom: '8px' }}>{erroLead}</p>}

                <button
                  onClick={solicitarAcesso}
                  disabled={enviandoLead}
                  style={{ width: '100%', height: '42px', border: 'none', borderRadius: '10px', background: '#B79D7D', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '13.5px', opacity: enviandoLead ? 0.6 : 1, marginTop: '4px' }}
                >
                  {enviandoLead ? 'Enviando...' : 'Solicitar acesso'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
