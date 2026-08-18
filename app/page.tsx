import Image from 'next/image'
import Link from 'next/link'
import FormLead from './FormLead'
import s from './site.module.css'

// Site institucional. A área logada começa em /entrar.
export default function Site() {
  return (
    <main className={s.page}>

      <header className={s.header}>
        <div className={`${s.wrap} ${s.nav}`}>
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
          <nav className={s.navDir}>
            <Link href="/entrar" className={s.linkCliente}>Área do cliente</Link>
            <a href="#contato" className={s.btn}>Cadastrar empresa</a>
          </nav>
        </div>
      </header>

      {/* ── Herói ───────────────────────────────────────────── */}
      <div className={s.heroi}>
        <div className={s.heroiMidia}>
          <Image
            src="/pessoa-aeroporto.png"
            alt="Executiva no aeroporto olhando o pátio de aeronaves"
            fill
            sizes="(max-width: 820px) 100vw, 68vw"
            priority
          />
        </div>
        <div className={s.heroiVeu} />

        <div className={s.heroiConteudo}>
          <div className={s.wrap}>
            <h1>
              A <em>forma inteligente</em> de cuidar das viagens da sua empresa.
            </h1>
            <p className={s.subHeroi}>
              <strong>Economize tempo e dinheiro em cada viagem.</strong>
              Pesquise e reserve passagens com agilidade, tenha controle sobre o que a
              empresa gasta e conte com atendimento humano sempre que precisar.
            </p>
            <div className={s.ctaLinha}>
              <a href="#contato" className={`${s.btn} ${s.btnOuro} ${s.btnG}`}>Cadastrar minha empresa</a>
              <p className={s.notaPreco}>
                Você preenche, a gente configura a política da sua empresa e libera o acesso.
              </p>
            </div>
            <p className={s.preco}>
              Sem mensalidade. Sem taxa de adesão.
              <b>Sua empresa não paga nada a mais para usar.</b>
            </p>
          </div>
        </div>

        <div className={s.confianca}>
          <div className={`${s.wrap} ${s.confiancaGrid}`}>
            <div><b>Emissão em minutos</b>Sua equipe pesquisa, reserva e emite na hora.</div>
            <div><b>Regra aplicada na compra</b>A política da sua empresa vale na hora, não depois.</div>
            <div><b>Atendimento por WhatsApp</b>Uma pessoa resolve remarcação e cancelamento.</div>
          </div>
        </div>
      </div>

      {/* ── Como funciona hoje ──────────────────────────────── */}
      <section className={s.secao}>
        <div className={s.wrap}>
          <div className={s.rotulo}>Como funciona hoje</div>
          <h2 className={s.h2Larga}>Passagem de trabalho comprada como passagem de férias.</h2>
          <div className={s.hoje}>
            <p>Cada um compra no site da companhia, do jeito que preferir, na hora que lembrar.</p>
            <p>Não existe regra. E quando existe no papel, ninguém confere na hora da compra.</p>
            <p>O financeiro descobre quanto a empresa gastou quando a fatura do cartão chega.</p>
          </div>
        </div>
      </section>

      {/* ── O que muda ──────────────────────────────────────── */}
      <section className={s.secao}>
        <div className={s.wrap}>
          <div className={s.rotulo}>O que muda</div>
          <h2>Controle na hora da compra, não na hora da fatura.</h2>

          <div className={s.bloco} style={{ marginTop: 20 }}>
            <div className={s.texto}>
              <h3>Cada compra dentro da regra que você definiu</h3>
              <p>
                Você define o limite por trecho, a antecedência mínima e quais tipos de tarifa
                são permitidos. Quem comprar fora da regra precisa justificar antes de seguir.
              </p>
              <p className={s.detalhe}>
                A justificativa vai direto para o seu relatório. Você descobre{' '}
                <b>quantas exceções aconteceram e por quê</b>, sem precisar perguntar para ninguém.
              </p>
            </div>
            <div className={s.janela}>
              <div className={s.janelaTopo}>
                <i className={s.ponto} /><i className={s.ponto} /><i className={s.ponto} />
              </div>
              <div className={s.janelaCorpo}>
                <div className={s.aviso}>
                  <p>Fora da política: 4 dias de antecedência (mínimo 14)</p>
                  <div className={`${s.opcao} ${s.on}`}><i className={s.radio} />Reunião marcada em cima da hora</div>
                  <div className={s.opcao}><i className={s.radio} />Urgência ou emergência</div>
                  <div className={s.opcao}><i className={s.radio} />Não havia opção dentro da política</div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${s.bloco} ${s.inverso}`}>
            <div className={s.texto}>
              <h3>Você descobre o gasto antes da fatura</h3>
              <p>
                Quanto a empresa gastou, quem viajou, para onde, com quanta antecedência
                e quantas viagens saíram da política.
              </p>
              <p className={s.detalhe}>
                Exporta em PDF para mandar à diretoria. E mostra a conta que quase ninguém faz:{' '}
                <b>comprar em cima da hora custa mais que o dobro</b> de comprar com três semanas.
              </p>
            </div>
            <div className={s.janela}>
              <div className={s.janelaTopo}>
                <i className={s.ponto} /><i className={s.ponto} /><i className={s.ponto} />
              </div>
              <div className={s.janelaCorpo}>
                <div className={s.kpis}>
                  <div className={s.kpi}><span>Gasto no período</span><b>R$ 184.720</b></div>
                  <div className={s.kpi}><span>Ticket médio</span><b>R$ 1.885</b></div>
                  <div className={s.kpi}><span>Antecedência</span><b>6 dias</b></div>
                </div>
                <div className={s.barras}>
                  <div className={s.barra}><i>Marcos A.</i><span className={s.trilho}><u style={{ width: '78%' }} /></span><s>R$ 31.400</s></div>
                  <div className={s.barra}><i>Juliana P.</i><span className={s.trilho}><u style={{ width: '69%' }} /></span><s>R$ 27.800</s></div>
                  <div className={s.barra}><i>Renata L.</i><span className={s.trilho}><u style={{ width: '55%' }} /></span><s>R$ 22.150</s></div>
                  <div className={s.barra}><i>Paulo S.</i><span className={s.trilho}><u style={{ width: '46%' }} /></span><s>R$ 18.600</s></div>
                </div>
              </div>
            </div>
          </div>

          <div className={s.bloco}>
            <div className={s.texto}>
              <h3>Quando dá problema, você fala com gente</h3>
              <p>
                Voo cancelado, remarcação, passageiro no aeroporto com pressa.
                Você chama no WhatsApp e uma pessoa resolve.
              </p>
              <p className={s.detalhe}>
                Somos uma agência de viagens corporativas em operação.{' '}
                <b>O sistema é nosso e o atendimento também.</b> Não é suporte terceirizado
                nem formulário que responde em dois dias úteis.
              </p>
            </div>
            <div className={s.janela}>
              <div className={s.janelaTopo}>
                <i className={s.ponto} /><i className={s.ponto} /><i className={s.ponto} />
              </div>
              <div className={s.janelaCorpo}>
                <div className={`${s.kpis} ${s.kpisDois}`}>
                  <div className={s.kpi}><span>Ida &middot; GOL</span><b className={s.localizador}>QAXFVR</b></div>
                  <div className={s.kpi}><span>Volta &middot; LATAM</span><b className={s.localizador}>LA9573264</b></div>
                </div>
                <div className={`${s.aviso} ${s.avisoAzul}`}>
                  <p>
                    Combinamos companhias diferentes na ida e na volta quando sai mais barato,
                    e cuidamos das duas reservas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como começa ─────────────────────────────────────── */}
      <section className={s.secao}>
        <div className={s.wrap}>
          <div className={s.rotulo}>Como começa</div>
          <h2>Sem instalação, sem projeto de implantação.</h2>
          <div className={s.passos}>
            <div className={s.passo}>
              <b>01</b>
              <h4>Conversamos</h4>
              <p>Entendemos como sua empresa compra passagem hoje e o que precisa de controle.</p>
            </div>
            <div className={s.passo}>
              <b>02</b>
              <h4>Configuramos a política</h4>
              <p>Limite, antecedência e tipos de tarifa da sua empresa. Ajustável quando quiser.</p>
            </div>
            <div className={s.passo}>
              <b>03</b>
              <h4>Sua equipe compra</h4>
              <p>Cada pessoa com seu acesso. Você acompanha tudo pelo relatório.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contato ─────────────────────────────────────────── */}
      <section className={s.contato} id="contato">
        <div className={`${s.wrap} ${s.contatoGrid}`}>
          <div>
            <div className={s.rotulo}>Fale com a gente</div>
            <h2>Vamos ver quanto sua empresa gasta hoje?</h2>
            <p className={s.subContato}>
              Conte como vocês compram passagem hoje. Respondemos com uma proposta
              de política de viagem para o seu caso, sem compromisso e sem custo.
            </p>
          </div>
          <FormLead />
        </div>
      </section>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.rodape}`}>
          <div>
            <Image
              className={s.logoRodape}
              src="/logo-branco.png"
              alt="Facilita Pass, soluções em viagens corporativas"
              width={626}
              height={132}
            />
            <div>© {new Date().getFullYear()} Facilita Pass Corp. Todos os direitos reservados.</div>
          </div>
          <div><Link href="/entrar">Área do cliente</Link></div>
        </div>
      </footer>

    </main>
  )
}
