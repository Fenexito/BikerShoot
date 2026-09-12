/** Link de WhatsApp con un mensaje precargado — reutilizado en ambos
 * portales para que contactar sobre un pedido no empiece con una
 * conversación en blanco (el destinatario ya sabe de qué pedido se trata
 * y tiene un link directo a su propia vista de ese pedido). */
export function buildWhatsAppLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
}
