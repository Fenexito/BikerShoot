import { LegalPage } from './LegalPage'

export function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="10 de septiembre de 2026">
      <p>
        Estos términos rigen el uso de MotoShots, la plataforma donde fotógrafos publican fotografías
        de eventos de motociclismo y bikers las encuentran y compran. Al crear una cuenta o usar la
        app aceptas estas condiciones junto con nuestra{' '}
        <a href="/privacidad" className="font-semibold text-primary">
          política de privacidad
        </a>{' '}
        y nuestros{' '}
        <a href="/derechos-de-autor" className="font-semibold text-primary">
          derechos de autor
        </a>
        .
      </p>

      <h2>1. Quién puede usar MotoShots</h2>
      <p>
        Debes tener al menos 13 años para crear una cuenta. Si eres fotógrafo, tu cuenta pasa por una
        revisión antes de aprobarse — nos reservamos el derecho de aprobar, rechazar o suspender
        cuentas de fotógrafo a nuestro criterio.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Eres responsable de mantener tu contraseña segura y de toda actividad bajo tu cuenta.</li>
        <li>Debes darnos información veraz al registrarte.</li>
        <li>Puedes cerrar tu cuenta cuando quieras desde Configuración → Cuenta.</li>
        <li>Podemos suspender o cerrar cuentas que incumplan estos términos.</li>
      </ul>

      <h2>3. Para bikers</h2>
      <ul>
        <li>
          Las fotos que compras son para <strong>uso personal</strong>: puedes descargarlas, imprimirlas
          y compartirlas en tus redes con crédito al fotógrafo, pero no revenderlas ni usarlas con
          fines comerciales sin autorización del fotógrafo.
        </li>
        <li>Los precios se muestran en quetzales (Q) e incluyen los impuestos aplicables.</li>
        <li>
          Una vez que descargas el archivo final en alta calidad, la compra no es reembolsable, salvo
          error atribuible al fotógrafo (foto equivocada, archivo dañado o ilegible).
        </li>
        <li>
          Las fotos compradas quedan asociadas a tu cuenta de forma permanente — puedes volver a
          descargarlas desde "Mis compras" cuando quieras, mientras tu cuenta exista.
        </li>
        <li>
          Puedes guardar fotos como favoritas y compartir un resultado de búsqueda con otra persona;
          eso no reemplaza la compra — la persona que reciba el enlace ve la misma vista previa con
          marca de agua que cualquier otro biker, y debe comprar la foto para obtener el archivo final.
        </li>
      </ul>

      <h2>4. Para fotógrafos</h2>
      <ul>
        <li>
          Eres el único responsable del contenido que subes: debe ser tuyo (tomado por ti), de eventos
          reales, y no puede infringir derechos de autor, de imagen o de propiedad intelectual de
          terceros.
        </li>
        <li>
          Conservas todos los derechos de autor sobre tus fotografías (ver{' '}
          <a href="/derechos-de-autor" className="font-semibold text-primary">
            Derechos de autor
          </a>
          ) — MotoShots solo es el canal de venta.
        </li>
        <li>
          MotoShots <strong>no cobra comisión</strong> sobre tus ventas. En su lugar, pagas un plan de
          almacenamiento mensual según el volumen de fotos que mantengas publicadas.
        </li>
        <li>
          Nos reservamos el derecho de retirar contenido que viole estos términos, infrinja derechos
          de terceros, o sea reportado como fraudulento o inapropiado.
        </li>
        <li>
          Las fotos ya entregadas a un comprador no se eliminan de su cuenta aunque tú borres el
          evento o cierres tu cuenta de fotógrafo — esto protege compras ya completadas.
        </li>
        <li>
          Eres responsable de contar con el consentimiento necesario de las personas fotografiadas
          según lo exija la legislación aplicable a tu actividad.
        </li>
      </ul>

      <h2>5. Pagos y facturación</h2>
      <p>
        Los pagos de bikers se procesan mediante un proveedor externo certificado en el momento de la
        compra. Los planes de almacenamiento de fotógrafos se cobran de forma recurrente según el
        ciclo que elijas; puedes cambiar o cancelar tu plan desde tu panel de Studio en cualquier
        momento, con efecto a partir del siguiente ciclo de cobro.
      </p>

      <h2>6. Conducta prohibida</h2>
      <p>Al usar MotoShots te comprometes a NO:</p>
      <ul>
        <li>Subir contenido que no te pertenece o que infringe derechos de terceros.</li>
        <li>Intentar descargar, redistribuir o revender vistas previas con marca de agua.</li>
        <li>Intentar acceder a cuentas, fotos o pedidos que no son tuyos.</li>
        <li>Usar la plataforma para acosar, difamar o dañar a otros usuarios.</li>
        <li>Interferir con el funcionamiento normal de la app (scraping masivo, ataques, bots).</li>
      </ul>

      <h2>7. Propiedad de la plataforma</h2>
      <p>
        El nombre "MotoShots", su logotipo, diseño y código son propiedad de MotoShots. Estos términos
        no te otorgan ningún derecho sobre la marca o la plataforma en sí, más allá de tu propio uso
        como usuario.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        MotoShots conecta a fotógrafos y bikers, pero no participa en la toma de las fotografías ni
        controla la calidad, exactitud o legalidad del contenido subido por cada fotógrafo. En la
        medida permitida por la ley, MotoShots no es responsable por daños indirectos derivados del
        uso de la plataforma o del contenido de terceros publicado en ella.
      </p>

      <h2>9. Cambios a estos términos</h2>
      <p>
        Podemos actualizar estos términos ocasionalmente. Los cambios significativos se anunciarán
        dentro de la app antes de entrar en vigor. Seguir usando MotoShots después de un cambio
        implica que lo aceptas.
      </p>

      <h2>10. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Guatemala. Cualquier disputa se
        resolverá ante los tribunales competentes de Guatemala, salvo que la ley aplicable disponga
        otra cosa.
      </p>

      <h2>11. Contacto</h2>
      <p>Para dudas sobre estos términos, escríbenos desde el botón "Reportar un problema" en cualquier página.</p>
    </LegalPage>
  )
}
