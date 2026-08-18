/**
 * Traduz o erro técnico da WOOBA (ou da companhia aérea, repassado por ela)
 * para uma frase que um comprador leigo entenda — e, quando possível, consiga
 * agir em cima.
 *
 * O texto técnico NUNCA se perde: quem chama continua logando o original no
 * servidor. O que muda é apenas o que aparece na tela.
 *
 * Motivação concreta: uma reserva que falhava mostrava ao cliente
 *
 *   "Não foi possível criar a reserva:Bad Request <?xml version="1.0" ...
 *    <DescText>CPF wrong format</DescText></Error></IATA_OrderViewRS>"
 *
 * Quem compra passagem numa empresa não lê isso. Fecha o sistema e liga pro
 * concorrente. A informação útil — "o CPF está errado" — estava lá dentro,
 * enterrada em XML.
 */

const GENERICA =
  'Não conseguimos concluir agora. Tente de novo em alguns minutos — se continuar, fale com a gente pelo botão de Suporte.'

type Regra = { padrao: RegExp; mensagem: string }

// A ordem importa: a primeira regra que casar vence. As mais específicas
// (campo do passageiro, cartão) vêm antes das mais genéricas.
const REGRAS: Regra[] = [
  { padrao: /\bcpf\b/i,
    mensagem: 'O CPF de algum passageiro não foi aceito pela companhia. Confira os números e tente de novo.' },
  { padrao: /passport|passaporte/i,
    mensagem: 'O passaporte informado não foi aceito pela companhia. Confira os dados e tente de novo.' },
  { padrao: /birth|nascimento/i,
    mensagem: 'A data de nascimento de algum passageiro não foi aceita. Confira e tente de novo.' },
  { padrao: /e-?mail/i,
    mensagem: 'O e-mail informado não foi aceito pela companhia. Confira e tente de novo.' },
  { padrao: /phone|telefone/i,
    mensagem: 'O telefone informado não foi aceito. Confira o DDD e o número.' },
  { padrao: /surname|sobrenome|passenger name|nome do passageiro/i,
    mensagem: 'O nome de algum passageiro não foi aceito. Use exatamente como está no documento, sem acentos.' },
  { padrao: /credit card|cart[ãa]o de cr[ée]dito|card number/i,
    mensagem: 'Os dados do cartão não foram aceitos. Confira número, validade e código de segurança.' },
  { padrao: /sess[ãa]o expirad|session expired|sessaoexpirada/i,
    mensagem: 'Esta busca expirou. Faça a busca de novo para ver os preços atualizados.' },
  { padrao: /sold ?out|indispon|unavailable|no ?seats|esgotad|sem disponibilidade/i,
    mensagem: 'Este voo acabou de ficar indisponível. Escolha outro horário ou faça a busca de novo.' },
  { padrao: /fare.*chang|pre[çc]o.*alterad|tarifa.*alterad/i,
    mensagem: 'O preço deste voo mudou desde a busca. Faça a busca de novo para ver o valor atual.' },
  { padrao: /ndclatam|segmentos ndc/i,
    mensagem: 'Esta combinação de voos não pode ser reservada junta. Escolha outro voo para um dos trechos.' },
  { padrao: /localizador|not ?found|n[ãa]o encontrad/i,
    mensagem: 'Não encontramos essa reserva. Confira o localizador ou fale com o Suporte.' },
]

/**
 * Recebe a mensagem crua e devolve a versão para a tela.
 * Sempre devolve algo apresentável — nunca XML, nunca string vazia.
 */
export function mensagemAmigavel(tecnica: unknown): string {
  const texto = typeof tecnica === 'string' ? tecnica : ''
  if (!texto.trim()) return GENERICA

  // A explicação útil da NDC costuma vir dentro de <DescText>; puxamos ela
  // pra frente para as regras casarem com o motivo, não com o envelope XML.
  const desc = texto.match(/<DescText>([^<]+)<\/DescText>/i)?.[1] ?? ''
  const limpo = `${desc} ${texto.replace(/<[^>]*>/g, ' ')}`.replace(/\s+/g, ' ').trim()

  for (const { padrao, mensagem } of REGRAS) {
    if (padrao.test(limpo)) return mensagem
  }
  return GENERICA
}
