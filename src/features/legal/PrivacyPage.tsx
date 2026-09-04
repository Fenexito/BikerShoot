import { LegalPage } from './LegalPage'

export function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="30 de agosto de 2026">
      <p>
        En MotoShots recopilamos únicamente la información necesaria para operar la plataforma: tu
        correo, nombre, y — si eres fotógrafo — los datos de contacto que decidas mostrar en tu
        perfil público (ciudad, WhatsApp, redes sociales).
      </p>
      <h2>Qué hacemos con tus fotos</h2>
      <p>
        Las fotos que compras quedan asociadas a tu cuenta de forma permanente. Los fotógrafos
        controlan qué fotos suben y destacan; nosotros no compartimos tus datos de compra con
        terceros.
      </p>
      <h2>Pagos</h2>
      <p>
        No almacenamos datos de tarjetas. El procesamiento de pagos lo maneja un proveedor externo
        certificado.
      </p>
      <h2>Contacto</h2>
      <p>
        Si quieres que eliminemos tu cuenta o tienes dudas sobre tus datos, escríbenos desde el
        botón "Reportar un problema" en cualquier página.
      </p>
    </LegalPage>
  )
}
