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
            <Image className={s.logo} src="/logo-marca.png" alt="Facilita Pass"
              width={839} height={120} priority />
          </Link>
          <nav className={s.menu}>
            <a href="#como">Como funciona</a>
            <a href="#perfis">Perfis de acesso</a>
            <a href="#contato">Contato</a>
          </nav>
          <div className={s.navDir}>
            <Link href="/entrar" className={`${s.btn} ${s.btnLinha}`}>Área do cliente</Link>
            <a href="#contato" className={s.btn}>Cadastrar empresa</a>
          </div>
        </div>
      </header>

      {/* ── Herói ───────────────────────────────────────────── */}
      <div className={s.heroi}>
        <div className={s.wrap}>
          <div className={s.selo}>
            <i />
            <span className={s.soLargo}>Agência de viagens corporativas com plataforma própria</span>
            <span className={s.soEstreito}>Agência com plataforma própria</span>
          </div>
          <h1>A forma inteligente de cuidar das viagens da sua empresa.</h1>
          <p className={s.subHeroi}>
            Sua equipe pesquisa, reserva e emite em minutos. Você acompanha o gasto,
            a política e a antecedência de cada compra.
          </p>
          <div className={s.ctas}>
            <a href="#contato" className={`${s.btn} ${s.btnG}`}>Cadastrar minha empresa</a>
            <a href="#como" className={s.linkVideo}>Ver como funciona &rsaquo;</a>
          </div>
          <p className={s.nota}>
            Sem mensalidade. Sem taxa de adesão. <b>Sua empresa não paga nada a mais para usar.</b>
          </p>
        </div>

        {/* A vitrine: a tela de busca no navegador e as reservas no celular */}
        <div className={s.palco}>
          <div className={s.janela}>
            <div className={s.barraNav}>
              <i className={s.ponto} /><i className={s.ponto} /><i className={s.ponto} />
              <div className={s.url}>corp.facilitapass.com.br/busca</div>
            </div>

            <div className={s.appTopo}>
              <div className={s.marcaImg} />
              <div className={s.appAbas}>
                <b>Buscar voos</b><span>Minhas reservas</span><span>Relatório</span>
              </div>
            </div>

            <div className={s.buscaDemo}>
              <div className={s.campo}><span>Origem</span><div>MGF · Maringá</div></div>
              <div className={s.campo}><span>Destino</span><div>CGH · Congonhas</div></div>
              <div className={s.campo}><span>Ida</span><div>28 ago</div></div>
              <div className={s.campo}><span>Volta</span><div>30 ago</div></div>
              <div className={s.campo}><span>Passageiros</span><div>1 adulto</div></div>
              <div className={s.btnBusca}>Buscar</div>
            </div>

            <div className={s.filtros}>
              <div className={`${s.chip} ${s.chipOn}`}>Todas as companhias</div>
              <div className={s.chip}>GOL</div>
              <div className={s.chip}>LATAM</div>
              <div className={s.chip}>Azul</div>
              <div className={s.chip}>Direto</div>
              <div className={s.chipRes}>62 voos encontrados</div>
            </div>

            <div className={s.voo}>
              <div className={`${s.cia} ${s.gol}`}>GOL</div>
              <div>
                <div className={s.horas}>
                  <b>06:20</b>
                  <div className={s.rotaMeio}>1h35<div className={s.traco} />direto</div>
                  <b>07:55</b>
                </div>
                <div className={s.tags}>
                  <span className={s.tag}>MGF → CGH</span>
                  <span className={s.tag}>Light</span>
                  <span className={`${s.tag} ${s.tagOk}`}>Dentro da política</span>
                </div>
              </div>
              <div className={s.preco}><b>R$ 613,84</b><span>por passageiro</span></div>
              <div className={s.escolher}>Selecionar</div>
            </div>

            <div className={s.voo}>
              <div className={`${s.cia} ${s.lat}`}>LA</div>
              <div>
                <div className={s.horas}>
                  <b>09:05</b>
                  <div className={s.rotaMeio}>1h40<div className={s.traco} />direto</div>
                  <b>10:45</b>
                </div>
                <div className={s.tags}>
                  <span className={s.tag}>MGF → CGH</span>
                  <span className={s.tag}>Basic</span>
                  <span className={`${s.tag} ${s.tagOk}`}>Dentro da política</span>
                </div>
              </div>
              <div className={s.preco}><b>R$ 689,10</b><span>por passageiro</span></div>
              <div className={s.escolher}>Selecionar</div>
            </div>

            <div className={s.voo}>
              <div className={`${s.cia} ${s.azu}`}>AD</div>
              <div>
                <div className={s.horas}>
                  <b>14:10</b>
                  <div className={s.rotaMeio}>1h35<div className={s.traco} />direto</div>
                  <b>15:45</b>
                </div>
                <div className={s.tags}>
                  <span className={s.tag}>MGF → CGH</span>
                  <span className={s.tag}>Standard</span>
                  <span className={s.tag}>Bagagem 23kg</span>
                </div>
              </div>
              <div className={s.preco}><b>R$ 742,30</b><span>por passageiro</span></div>
              <div className={s.escolher}>Selecionar</div>
            </div>
          </div>

          <div className={s.fone}>
            <div className={s.foneTela}>
              <div className={s.foneStatus}>
                <span>9:41</span>
                <span className={s.sinal}>
                  <i style={{ height: 4 }} /><i style={{ height: 6 }} />
                  <i style={{ height: 8 }} /><i style={{ height: 10 }} />
                </span>
              </div>
              <div className={s.foneTopo}>
                <div className={s.marcaImg} />
                <em>Minhas reservas</em>
              </div>
              <div className={s.foneCorpo}>
                <h4>Próximas viagens</h4>

                <div className={s.res}>
                  <div className={s.resTopo}>
                    <div className={s.resCia}>
                      <span className={`${s.cia} ${s.gol}`}>GOL</span><b>Sex, 28 ago</b>
                    </div>
                    <span className={s.seloOk}>Emitida</span>
                  </div>
                  <div className={s.resRota}>
                    <b>MGF</b>
                    <div className={s.resMeio}>1h35<div />direto</div>
                    <b>CGH</b>
                  </div>
                  <div className={s.resPe}><span>Localizador</span><b>QAXFVR</b></div>
                </div>

                <div className={s.res}>
                  <div className={s.resTopo}>
                    <div className={s.resCia}>
                      <span className={`${s.cia} ${s.azu}`}>AD</span><b>Dom, 30 ago</b>
                    </div>
                    <span className={s.seloOk}>Emitida</span>
                  </div>
                  <div className={s.resRota}>
                    <b>CGH</b>
                    <div className={s.resMeio}>1h40<div />direto</div>
                    <b>MGF</b>
                  </div>
                  <div className={s.resPe}><span>Localizador</span><b>HKPRWM</b></div>
                </div>

                <div className={s.foneWpp}>
                  <i />
                  <p>Precisou remarcar? Chame no WhatsApp que uma pessoa resolve.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={s.apoio}>
        <div className={`${s.wrap} ${s.apoioGrid}`}>
          <div><b>Emissão em minutos</b><p>Sua equipe pesquisa, reserva e emite sem passar por ninguém.</p></div>
          <div><b>Regra aplicada na compra</b><p>A política da empresa vale na hora, não depois da fatura.</p></div>
          <div><b>Atendimento por WhatsApp</b><p>Uma pessoa resolve remarcação e cancelamento.</p></div>
        </div>
      </div>

      {/* ── Como funciona ───────────────────────────────────── */}
      <section className={s.secao} id="como">
        <div className={s.wrap}>
          <div className={s.rotulo}>Como funciona</div>
          <h2>Controle na hora da compra, não na hora da fatura.</h2>
          <p className={s.sub2}>
            As duas telas que mudam a rotina de quem compra e de quem paga a conta.
          </p>

          <div className={s.duo}>
            <div className={s.cartao}>
              <h3>Cada compra dentro da regra</h3>
              <p>
                Limite por trecho, antecedência mínima e tipos de tarifa. Quem sair da regra
                justifica antes de seguir.
              </p>
              <div className={s.pilulas}>
                <span className={s.pilula}>Limite por trecho</span>
                <span className={s.pilula}>Antecedência</span>
                <span className={s.pilula}>Justificativa</span>
              </div>
              <div className={s.tela}>
                <div className={s.aviso}>
                  <div className={s.avisoT}>Fora da política: 4 dias de antecedência (mínimo 14)</div>
                  <div className={`${s.opcao} ${s.opcaoOn}`}><i className={s.radio} />Reunião marcada em cima da hora</div>
                  <div className={s.opcao}><i className={s.radio} />Urgência ou emergência</div>
                  <div className={s.opcao}><i className={s.radio} />Não havia opção dentro da política</div>
                </div>
              </div>
            </div>

            <div className={s.cartao}>
              <h3>Previsibilidade em tempo real</h3>
              <p>
                Acompanhe os custos no exato momento em que acontecem, sem surpresas no
                fechamento da fatura. Gasto no período, ticket médio e histórico por viajante,
                com relatório em PDF.
              </p>
              <div className={s.pilulas}>
                <span className={s.pilula}>Por viajante</span>
                <span className={s.pilula}>Por rota</span>
                <span className={s.pilula}>PDF</span>
              </div>
              <div className={s.tela}>
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
        </div>
      </section>

      {/* ── Perfis de acesso ────────────────────────────────── */}
      <section className={`${s.secao} ${s.secaoCinza}`} id="perfis">
        <div className={s.wrap}>
          <div className={s.rotulo}>Perfis de acesso</div>
          <h2>Uma única plataforma, feita para toda a jornada.</h2>
          <p className={s.sub2}>
            Perfis de acesso sob medida para a realidade da sua empresa, separando
            quem emite, quem viaja e quem gerencia.
          </p>

          <div className={s.quem}>
            <div className={s.cartao}>
              <div className={s.num}>01 &nbsp;·&nbsp; OPERACIONAL</div>
              <h3>Para quem organiza</h3>
              <p>
                Secretária, RH ou o próprio viajante: pesquisa e emite rapidamente, porque a
                regra da empresa já está configurada no sistema. Fim da troca infinita de
                e-mails pedindo aprovação.
              </p>
            </div>
            <div className={s.cartao}>
              <div className={s.num}>02 &nbsp;·&nbsp; O VIAJANTE</div>
              <h3>Para quem viaja</h3>
              <p>
                Recebe o bilhete na hora, acompanha pelo celular e, se o voo atrasar, chama
                nosso atendimento humano por WhatsApp. Sem abrir chamados, sem burocracia no
                aeroporto.
              </p>
            </div>
            <div className={s.cartao}>
              <div className={s.num}>03 &nbsp;·&nbsp; FINANCEIRO</div>
              <h3>Para quem faz a gestão</h3>
              <p>
                Acompanha o relatório mensal: quem viajou, qual o ticket médio e quais compras
                exigiram justificativa de exceção. Controle total sem precisar microgerenciar
                ninguém.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contato ─────────────────────────────────────────── */}
      <section className={s.contato} id="contato">
        <div className={s.wrap}>
          <div className={s.rotulo}>Fale com a gente</div>
          <h2>Vamos ver quanto sua empresa gasta hoje?</h2>
          <p className={s.sub2}>
            Conte como vocês compram passagem hoje. Respondemos com uma proposta
            de política de viagem para o seu caso, sem compromisso e sem custo.
          </p>
          <FormLead />
        </div>
      </section>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.rodape}`}>
          <span>
            © {new Date().getFullYear()} Facilita Pass Corp · CNPJ 31.071.738/0001-73 ·
            Av. Pres. Juscelino K. de Oliveira, 665, Loja 10, Maringá, PR
          </span>
          <span className={s.rodapeLinks}>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos</Link>
            <Link href="/entrar">Área do cliente</Link>
          </span>
        </div>
      </footer>

    </main>
  )
}
