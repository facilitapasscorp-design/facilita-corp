import Image from 'next/image'
import Link from 'next/link'
import s from '../legal.module.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso | Facilita Pass Corp',
  description: 'As regras de uso da plataforma de viagens corporativas da Facilita Pass Corp.',
}

export default function Termos() {
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
        <h1>Termos de Uso</h1>
        <p className={s.data}>Atualizados em agosto de 2026.</p>

        <p>
          Estes termos valem para as empresas que usam a plataforma da Facilita Pass Corp para
          pesquisar, reservar e emitir passagens aéreas, e para as pessoas que acessam a
          plataforma em nome dessas empresas. Ao usar o sistema, a empresa concorda com o que
          está escrito aqui.
        </p>

        <h2>O que a Facilita Pass faz</h2>

        <p>
          Somos uma agência de viagens corporativas. Intermediamos a compra de passagens junto
          às companhias aéreas e oferecemos uma plataforma para a sua empresa organizar essas
          compras, aplicar a própria política de viagem e acompanhar os gastos.
        </p>

        <p className={s.destaque}>
          Quem transporta o passageiro é a companhia aérea. O contrato de transporte é entre o
          passageiro e ela, e as regras de bagagem, remarcação, cancelamento, atraso e
          reembolso são as da tarifa comprada.
        </p>

        <h2>Quanto custa usar</h2>

        <p>
          A plataforma não tem mensalidade, taxa de adesão nem fidelidade. A sua empresa paga o
          valor da passagem, e a Facilita Pass é remunerada pelas companhias aéreas e pela
          consolidadora. Se algum dia isso mudar, a empresa será avisada antes.
        </p>

        <h2>Acesso e senha</h2>

        <p>
          Cada pessoa recebe um acesso individual. A empresa é responsável por quem cria, por
          manter a lista atualizada e por avisar quando alguém sai. A senha é pessoal e não
          deve ser compartilhada: tudo que for feito com um acesso é considerado feito por
          aquela pessoa.
        </p>

        <p>
          Podemos suspender um acesso que esteja sendo usado de forma indevida, ou a pedido do
          administrador da própria empresa.
        </p>

        <h2>Dados dos passageiros</h2>

        <p>
          Para emitir uma passagem é preciso informar nome completo, CPF, data de nascimento e,
          em viagens internacionais, os dados do passaporte. A empresa se responsabiliza por
          informar dados corretos e por ter autorização das pessoas que ela cadastra.
        </p>

        <p>
          <strong>Dado errado no bilhete costuma custar caro.</strong> Companhias aéreas cobram
          taxa para corrigir nome e, em alguns casos, exigem a emissão de um bilhete novo. Esse
          custo é da empresa.
        </p>

        <h2>Reserva, pagamento e emissão</h2>

        <ul>
          <li>Uma reserva não é uma passagem. Ela apenas segura o lugar e a tarifa até o prazo
          informado na tela.</li>
          <li>Se o pagamento não for concluído dentro do prazo, a reserva é cancelada
          automaticamente pela companhia e a tarifa pode não existir mais.</li>
          <li>O preço só está garantido depois da emissão. Até lá, a companhia pode alterar a
          tarifa ou esgotar a classe.</li>
          <li>Em viagens de ida e volta com companhias diferentes, são duas reservas e dois
          pagamentos, cada um com o seu prazo. Isso fica indicado na tela antes da compra.</li>
        </ul>

        <h2>Política de viagem da empresa</h2>

        <p>
          A empresa pode definir limite de valor, antecedência mínima e tipos de tarifa
          permitidos. Quando uma compra fica fora dessas regras, o sistema pede uma
          justificativa e registra quem comprou, o que comprou e por quê. A Facilita Pass não
          bloqueia a compra: quem decide o que fazer com a exceção é a empresa.
        </p>

        <h2>Alterações e cancelamentos</h2>

        <p>
          Alterações e cancelamentos seguem as regras da tarifa comprada e as multas da
          companhia aérea. Solicitações feitas pela plataforma entram na nossa fila de
          atendimento; para casos urgentes, use o WhatsApp indicado no sistema.
        </p>

        <p>
          Reembolsos dependem do prazo da companhia aérea, que costuma ser bem mais longo do
          que a compra. Acompanhamos o processo, mas o prazo não é nosso.
        </p>

        <h2>Do que não somos responsáveis</h2>

        <ul>
          <li>Atraso, cancelamento, mudança de horário, overbooking e extravio de bagagem, que
          são responsabilidade da companhia aérea.</li>
          <li>Consequências de dados informados incorretamente pela empresa.</li>
          <li>Exigências de documentação, visto e vacina do destino, que são responsabilidade
          do passageiro.</li>
          <li>Interrupções causadas por falhas de sistemas de terceiros, como as próprias
          companhias aéreas e os sistemas de reserva.</li>
        </ul>

        <p>
          Fazemos o que está ao nosso alcance para resolver qualquer um desses casos junto à
          companhia, e é justamente por isso que existe um atendimento humano do outro lado.
        </p>

        <h2>Disponibilidade da plataforma</h2>

        <p>
          Trabalhamos para manter o sistema disponível, mas ele pode sair do ar para manutenção
          ou por falha de fornecedores. Quando isso acontecer, o atendimento continua
          funcionando pelo WhatsApp e por e-mail.
        </p>

        <h2>Encerramento</h2>

        <p>
          A empresa pode parar de usar a plataforma quando quiser, sem multa. As passagens já
          emitidas continuam válidas e seguem as regras da companhia aérea.
        </p>

        <h2>Mudanças nestes termos</h2>

        <p>
          Se mudarmos algo relevante, atualizamos a data no topo desta página e avisamos os
          clientes ativos.
        </p>

        <h2>Quem é a Facilita Pass</h2>

        <p>
          <strong>Facilita Pass Corp</strong>, soluções em viagens corporativas.<br />
          CNPJ 31.071.738/0001-73<br />
          Av. Pres. Juscelino K. de Oliveira, 665, Loja 10, Zona 2, Maringá, PR, 87010-440<br />
          E-mail: <a href="mailto:corp@facilitapass.com.br">corp@facilitapass.com.br</a>
        </p>

        <h2>Lei aplicável</h2>

        <p>
          Estes termos são regidos pelas leis brasileiras. Antes de qualquer medida judicial,
          nos comprometemos a tentar resolver diretamente pelo{' '}
          <a href="mailto:corp@facilitapass.com.br">corp@facilitapass.com.br</a>. Fica eleito
          o foro da comarca de Maringá, no Paraná.
        </p>

        <div className={s.rodape}>
          <Link href="/">Início</Link>
          <Link href="/privacidade">Política de privacidade</Link>
          <Link href="/entrar">Área do cliente</Link>
        </div>
      </div>
    </main>
  )
}
