import { LegalPage } from './LegalPage'

export function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="30 de agosto de 2026">
      <p>
        Al usar MotoShots aceptas estas condiciones. Léelas junto con nuestra{' '}
        <a href="/privacidad" className="font-semibold text-primary">
          política de privacidad
        </a>
        .
      </p>
      <h2>Para bikers</h2>
      <p>
        Las fotos compradas son de uso personal. Una vez entregado el archivo final, la compra no
        es reembolsable salvo error del fotógrafo (foto equivocada, archivo dañado).
      </p>
      <h2>Para fotógrafos</h2>
      <p>
        Eres responsable del contenido que subes — solo fotos que tomaste tú, de eventos reales, sin
        infringir derechos de terceros. MotoShots no cobra comisión por venta; solo el plan de
        almacenamiento mensual que elijas.
      </p>
      <h2>Cuentas</h2>
      <p>
        Puedes cerrar tu cuenta cuando quieras. Las fotos ya entregadas a compradores no se eliminan,
        para no afectar compras ya completadas.
      </p>
    </LegalPage>
  )
}
