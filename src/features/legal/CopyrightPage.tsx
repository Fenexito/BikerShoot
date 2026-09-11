import { LegalPage } from './LegalPage'

export function CopyrightPage() {
  return (
    <LegalPage title="Derechos de autor" updated="10 de septiembre de 2026">
      <p>
        Esta página explica cómo funcionan los derechos de autor sobre las fotografías publicadas en
        MotoShots, qué licencia obtienes al comprar una foto, y cómo reportar una posible infracción.
      </p>

      <h2>1. El fotógrafo conserva la propiedad</h2>
      <p>
        Cada fotógrafo conserva todos los derechos de autor sobre las fotografías que sube a
        MotoShots. Publicarlas en la plataforma no transfiere la propiedad a MotoShots ni a los
        compradores.
      </p>

      <h2>2. Qué obtienes al comprar una foto</h2>
      <p>
        Comprar una foto te otorga una <strong>licencia de uso personal, no exclusiva e
        intransferible</strong> sobre ese archivo específico. Puedes:
      </p>
      <ul>
        <li>Descargarla en alta calidad, sin marca de agua.</li>
        <li>Imprimirla para uso propio.</li>
        <li>Compartirla en tus redes sociales personales, idealmente con crédito al fotógrafo.</li>
      </ul>
      <p>La licencia NO te permite:</p>
      <ul>
        <li>Revenderla, licenciarla o cederla a terceros.</li>
        <li>Usarla con fines comerciales o publicitarios sin autorización expresa del fotógrafo.</li>
        <li>Reclamar autoría sobre la fotografía.</li>
      </ul>

      <h2>3. Vistas previas y marca de agua</h2>
      <p>
        Todas las vistas previas que ves durante la búsqueda llevan una marca de agua automática,
        pensada precisamente para proteger el trabajo del fotógrafo antes de la compra. Descargar,
        capturar, editar para quitar la marca de agua, o redistribuir una vista previa sin haberla
        comprado está estrictamente prohibido y puede resultar en la suspensión de tu cuenta.
      </p>

      <h2>4. Función de compartir</h2>
      <p>
        Puedes compartir con otra persona un resultado de búsqueda (por ejemplo, para ayudar a un
        amigo a encontrar una foto suya). Eso comparte únicamente la vista previa con marca de agua,
        igual que vería cualquier otro biker navegando la búsqueda pública — no otorga ningún derecho
        adicional sobre el archivo final.
      </p>

      <h2>5. Marca MotoShots</h2>
      <p>
        El nombre "MotoShots", su logotipo y su identidad visual son propiedad de MotoShots y no
        pueden usarse sin autorización, independientemente de los derechos de autor de cada fotógrafo
        sobre su propio contenido.
      </p>

      <h2>6. Reportar una infracción</h2>
      <p>Si crees que una foto subida a MotoShots infringe tus derechos de autor u otros derechos, contáctanos con:</p>
      <ul>
        <li>El enlace directo a la foto o al evento en cuestión.</li>
        <li>Una descripción de por qué crees que infringe tus derechos.</li>
        <li>Tus datos de contacto para darle seguimiento al reporte.</li>
      </ul>
      <p>
        Envíanoslo desde el botón "Reportar un problema" disponible en cualquier página. Revisamos
        cada reporte y, si procede, retiramos el contenido mientras se resuelve.
      </p>

      <h2>7. Infractores reincidentes</h2>
      <p>
        Las cuentas de fotógrafo con infracciones de derechos de autor confirmadas de forma repetida
        serán suspendidas de forma permanente.
      </p>
    </LegalPage>
  )
}
