import { LegalPage } from './LegalPage'

export function CopyrightPage() {
  return (
    <LegalPage title="Derechos de autor" updated="30 de agosto de 2026">
      <p>
        Cada fotógrafo conserva todos los derechos de autor sobre las fotos que sube a MotoShots.
        Comprar una foto te da una licencia de uso personal sobre ese archivo — no transfiere la
        propiedad ni te permite revenderla.
      </p>
      <h2>Marca de agua</h2>
      <p>
        Las vistas previas llevan marca de agua automática precisamente para proteger el trabajo del
        fotógrafo antes de la compra. Descargar o redistribuir una vista previa sin comprarla está
        prohibido.
      </p>
      <h2>Reportar una infracción</h2>
      <p>
        Si crees que una foto subida a MotoShots infringe tus derechos de autor, contáctanos desde el
        botón "Reportar un problema" con el enlace a la foto en cuestión.
      </p>
    </LegalPage>
  )
}
