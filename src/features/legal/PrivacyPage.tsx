import { LegalPage } from './LegalPage'

export function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="10 de septiembre de 2026">
      <p>
        Esta política explica qué información recopila MotoShots, para qué la usamos, con quién la
        compartimos y qué control tienes sobre ella. Aplica tanto a bikers como a fotógrafos que usan
        la plataforma.
      </p>

      <h2>1. Información que recopilamos</h2>
      <p>Dependiendo de cómo uses MotoShots, podemos recopilar:</p>
      <ul>
        <li>
          <strong>Datos de cuenta:</strong> correo electrónico, nombre, contraseña (almacenada
          cifrada, nunca en texto plano) y foto de perfil.
        </li>
        <li>
          <strong>Datos de biker:</strong> ciudad, marca y modelo de moto (opcionales) — nos ayudan a
          mostrarte fotos más relevantes en tus búsquedas.
        </li>
        <li>
          <strong>Datos de fotógrafo:</strong> nombre de tu marca/estudio, ciudad, redes sociales,
          datos de contacto que decidas mostrar en tu perfil público, y la información de tus eventos
          y puntos de ruta.
        </li>
        <li>
          <strong>Contenido que subes:</strong> fotografías, portadas de evento, logotipos y avatares.
        </li>
        <li>
          <strong>Actividad en la plataforma:</strong> tus compras, tus fotos favoritas, el historial
          de pedidos, y los reportes de errores que envíes desde el botón "Reportar un problema".
        </li>
        <li>
          <strong>Datos técnicos:</strong> preferencias guardadas en tu propio navegador (tema
          claro/oscuro, tamaño preferido de las miniaturas de fotos, contenido del carrito antes de
          iniciar sesión) — esto vive en tu dispositivo, no en nuestros servidores, salvo que tengas
          sesión iniciada, en cuyo caso el carrito también se sincroniza para que lo veas igual en
          cualquier dispositivo.
        </li>
      </ul>

      <h2>2. Para qué usamos tu información</h2>
      <ul>
        <li>Operar la búsqueda, compra, entrega y descarga de fotos.</li>
        <li>Mostrar tu perfil público (si eres fotógrafo) a quienes buscan sus fotos.</li>
        <li>Enviarte notificaciones sobre tus pedidos (foto entregada, pedido cancelado, etc.).</li>
        <li>Detectar y resolver errores técnicos reportados.</li>
        <li>Prevenir fraude y uso indebido de la plataforma.</li>
      </ul>
      <p>No usamos tus datos para publicidad de terceros ni los vendemos a nadie, bajo ninguna circunstancia.</p>

      <h2>3. Con quién compartimos información</h2>
      <p>
        No compartimos tus datos personales con terceros para fines comerciales. Sí trabajamos con
        proveedores de infraestructura que procesan datos en nuestro nombre, bajo sus propios
        acuerdos de confidencialidad:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — base de datos, autenticación y funciones del servidor.
        </li>
        <li>
          <strong>Cloudflare R2</strong> — almacenamiento de las fotografías (originales, vistas
          previas y entregas finales).
        </li>
        <li>
          <strong>Un proveedor de pagos externo certificado</strong> — procesa el cobro de tus
          compras; MotoShots nunca ve ni almacena el número completo de tu tarjeta.
        </li>
      </ul>
      <p>
        Un fotógrafo nunca ve tu correo ni tus datos de pago — solo el nombre que muestras en tu
        perfil, si tu compra genera un pedido que debe surtir.
      </p>

      <h2>4. Función de compartir fotos</h2>
      <p>
        Si usas la función de compartir una foto encontrada en tu búsqueda con otra persona (por
        ejemplo un amigo biker), generamos un enlace que reproduce esos mismos filtros de búsqueda y
        resalta esa foto — el enlace no expone tu cuenta ni tus datos personales, solo el resultado de
        búsqueda público que cualquiera podría reproducir manualmente.
      </p>

      <h2>5. Cuánto tiempo guardamos tu información</h2>
      <p>
        Mantenemos tu cuenta y tu historial de compras mientras la cuenta exista. Si eliminas tu
        cuenta, tus datos personales se eliminan, salvo la información de pedidos ya entregados a
        terceros (para no invalidar compras completadas de otros usuarios) y lo que la ley nos exija
        conservar con fines contables o fiscales.
      </p>

      <h2>6. Tus derechos</h2>
      <p>Puedes en cualquier momento:</p>
      <ul>
        <li>Ver y editar tus datos de perfil desde Configuración.</li>
        <li>Descargar o solicitar una copia de tu información.</li>
        <li>Pedir que corrijamos datos inexactos.</li>
        <li>Eliminar tu cuenta de forma permanente desde Configuración → Cuenta.</li>
        <li>Cerrar sesión en todos tus dispositivos desde el mismo lugar.</li>
      </ul>

      <h2>7. Seguridad</h2>
      <p>
        Tu contraseña se almacena cifrada. Las conexiones a MotoShots viajan siempre por HTTPS. Los
        enlaces de descarga de fotos originales son temporales y firmados, para que no puedan
        compartirse ni reutilizarse fuera de tu sesión.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        MotoShots no está dirigido a menores de 13 años. Si eres padre o tutor y crees que un menor
        nos proporcionó datos personales sin tu consentimiento, contáctanos para eliminarlos.
      </p>

      <h2>9. Cambios a esta política</h2>
      <p>
        Si actualizamos esta política de forma significativa, te avisaremos dentro de la app antes de
        que el cambio entre en vigor. La fecha de "Última actualización" arriba siempre refleja la
        versión vigente.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Si tienes dudas sobre tus datos o quieres ejercer alguno de tus derechos, escríbenos desde el
        botón "Reportar un problema" disponible en cualquier página de la app.
      </p>
    </LegalPage>
  )
}
