import Image from 'next/image'
import Link from 'next/link'
import s from '../legal.module.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Facilita Pass Corp',
  description: 'Como a Facilita Pass Corp trata os dados pessoais de clientes e passageiros.',
}

export default function Privacidade() {
  return (
    <main className={s.page}>
      <div className={s.topo}>
        <div className={s.topoDentro}>
          <Link href="/">
            <Image className={s.logo} src="/logo-marca.png" alt="Facilita Pass" width={839} height={120} />
          </Link>
          <Link href="/" className={s.voltar}>Voltar para o site</Link>
        </div>
      </div>

      <div className={s.corpo}>
        <h1>Política de Privacidade</h1>
        <p className={s.data}>Atualizada em agosto de 2026.</p>

        <p>
          A Facilita Pass Corp é uma agência de viagens corporativas. Para reservar e emitir
          passagens aéreas, precisamos tratar dados pessoais de quem contrata e de quem viaja.
          Esta página explica quais dados são esses, por que precisamos deles, com quem eles
          são compartilhados e o que você pode exigir de nós a qualquer momento.
        </p>

        <p className={s.destaque}>
          Não vendemos dados pessoais, não usamos os dados dos seus funcionários para
          publicidade e não repassamos nada para terceiros além do necessário para
          emitir e manter a sua passagem.
        </p>

        <h2>Quais dados tratamos</h2>

        <p><strong>De quem preenche o formulário do site:</strong> nome, empresa, e-mail,
        telefone e a faixa de gasto mensal com viagens que a pessoa indica.</p>

        <p><strong>De quem usa a plataforma:</strong> nome, e-mail corporativo, a empresa a
        que a pessoa pertence e a senha de acesso, que fica guardada de forma criptografada
        e não pode ser lida nem por nós.</p>

        <p><strong>De quem viaja:</strong> nome completo, CPF, data de nascimento, sexo,
        e-mail e telefone. Em viagens internacionais, também os dados do passaporte. Esses
        dados são exigidos pelas companhias aéreas para emitir o bilhete; sem eles a
        passagem não existe.</p>

        <p><strong>Dados de pagamento:</strong> o cartão de crédito corporativo informado na
        hora da emissão passa pelos nossos servidores apenas para concluir a compra e é
        transmitido ao sistema da nossa consolidadora, que fala com a companhia aérea.
        <strong> O número e o código de segurança do cartão não ficam armazenados no nosso
        banco de dados.</strong> Guardamos apenas a bandeira e o número de parcelas, para
        que a compra apareça no seu relatório.</p>

        <h2>Por que tratamos</h2>

        <ul>
          <li><strong>Para cumprir o que foi contratado:</strong> pesquisar, reservar, emitir,
          alterar e cancelar passagens.</li>
          <li><strong>Para cumprir obrigações legais e das companhias aéreas:</strong> os dados
          do passageiro são exigidos pela regulação do transporte aéreo e pelas próprias
          companhias.</li>
          <li><strong>Para atender e dar suporte:</strong> responder chamados, resolver
          remarcações e cancelamentos.</li>
          <li><strong>Para gerar os relatórios da sua empresa:</strong> quanto foi gasto, por
          quem, em qual rota e com quanta antecedência.</li>
          <li><strong>Para falar com quem pediu contato:</strong> quando alguém preenche o
          formulário do site pedindo uma proposta.</li>
        </ul>

        <h2>Com quem compartilhamos</h2>

        <ul>
          <li><strong>Consolidadora e companhias aéreas:</strong> os dados do passageiro são
          enviados para o sistema que faz a reserva e para a companhia que vai transportar a
          pessoa. É o que torna a emissão possível.</li>
          <li><strong>Fornecedores de tecnologia:</strong> usamos serviços de hospedagem e de
          banco de dados para manter a plataforma no ar. Eles guardam as informações em nosso
          nome e não podem usá-las para outra finalidade.</li>
          <li><strong>Autoridades:</strong> quando houver obrigação legal ou ordem judicial.</li>
        </ul>

        <h2>Por quanto tempo guardamos</h2>

        <p>
          Os dados das viagens ficam guardados enquanto durar a relação com a sua empresa e,
          depois disso, pelo prazo necessário para cumprir obrigações fiscais e responder a
          eventuais questionamentos sobre uma emissão. Os contatos deixados no site que não
          viram cliente são descartados quando deixam de ser úteis.
        </p>

        <h2>Segurança</h2>

        <p>
          O acesso à plataforma é individual, por e-mail e senha. Cada usuário só enxerga as
          viagens da própria empresa, e essa separação é aplicada no próprio banco de dados,
          não apenas na tela. As senhas são armazenadas de forma criptografada. O tráfego
          entre o seu navegador e a plataforma é criptografado.
        </p>

        <p>
          Nenhum sistema é imune a incidentes. Se acontecer algum que possa trazer risco
          relevante para os titulares, comunicaremos a empresa afetada e a autoridade
          competente, como manda a lei.
        </p>

        <h2>Cookies</h2>

        <p>
          Usamos apenas o cookie necessário para manter você conectado depois de fazer login.
          Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros no
          nosso site.
        </p>

        <h2>Seus direitos</h2>

        <p>
          A Lei Geral de Proteção de Dados garante que você saiba quais dados temos, peça
          correção de informação errada, peça uma cópia, revogue um consentimento dado e peça
          a exclusão do que não formos obrigados a guardar.
        </p>

        <p>
          Para exercer qualquer um desses direitos, escreva para{' '}
          <a href="mailto:corp@facilitapass.com.br">corp@facilitapass.com.br</a>. Respondemos
          em até 15 dias.
        </p>

        <p>
          Uma observação honesta sobre exclusão: dados de uma passagem já emitida também estão
          na companhia aérea e no sistema da consolidadora, e não temos como apagá-los de lá.
          Nesses casos, apagamos o que está conosco e orientamos para onde encaminhar o
          restante.
        </p>

        <h2>Quando esta política mudar</h2>

        <p>
          Se mudarmos algo relevante, atualizamos a data no topo desta página e avisamos os
          clientes ativos.
        </p>

        <h2>Como falar com a gente</h2>

        <p>
          Facilita Pass Corp, soluções em viagens corporativas.<br />
          E-mail: <a href="mailto:corp@facilitapass.com.br">corp@facilitapass.com.br</a>
        </p>

        <div className={s.rodape}>
          <Link href="/">Início</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/entrar">Área do cliente</Link>
        </div>
      </div>
    </main>
  )
}
