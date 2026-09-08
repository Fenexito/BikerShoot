// Ancho de página único para todo Studio — debe calzar EXACTO con el ancho
// del header (`max-w-screen-xl` en HeaderStudio.tsx) para que el contenido
// de cada pantalla quede alineado con los bordes del header flotante. Antes
// había dos anchos (2xl para casi todo, 6xl solo para Home) y NINGUNO de
// los dos coincidía con el del header — se unificaron los tres.
export const STUDIO_PAGE_WIDE = 'mx-auto max-w-screen-xl px-6 py-12 text-foreground md:px-16'
