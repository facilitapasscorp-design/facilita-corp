// Um lugar só para o número do atendimento. Antes ele estava escrito à mão
// dentro da tela de busca; se mudar, muda aqui e vale para o sistema inteiro.
export const WHATSAPP_ATENDIMENTO = '5544991272314'

/** Monta o link do WhatsApp com a mensagem já escrita. */
export function linkWhatsApp(mensagem: string) {
  return `https://wa.me/${WHATSAPP_ATENDIMENTO}?text=${encodeURIComponent(mensagem)}`
}
