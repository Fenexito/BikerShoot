/** Formatos RAW de cámara — Canon, Nikon, Sony, Fujifilm, Olympus/Panasonic,
 * Pentax/Samsung, y el DNG genérico de Adobe. El navegador NO los puede
 * decodificar directo (`<img>`/`createImageBitmap` no los soportan, a
 * diferencia de jpg/png/webp/heic) — por eso `accept="image/*"` en el input
 * de archivos los deja fuera del picker del sistema operativo, y por lo
 * que se seleccionen igual, `file.type` normalmente viene vacío para estos
 * (el SO no tiene un MIME registrado). Ver photoUpload.ts para cómo se
 * genera igual una vista previa a partir de la miniatura incrustada. */
const RAW_EXTENSIONS = [
  'cr2', 'cr3', // Canon
  'nef', 'nrw', // Nikon
  'arw', 'srf', 'sr2', // Sony
  'raf', // Fujifilm
  'orf', // Olympus
  'rw2', // Panasonic
  'pef', // Pentax
  'srw', // Samsung
  'dng', // Adobe DNG / genérico
  'raw',
]

/** Valor listo para el atributo `accept` de un `<input type="file">` —
 * combina el filtro nativo `image/*` con las extensiones RAW, que ese
 * filtro por sí solo no reconoce. */
export const IMAGE_INPUT_ACCEPT = ['image/*', ...RAW_EXTENSIONS.map((ext) => `.${ext}`)].join(',')

export function isRawFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return !!ext && RAW_EXTENSIONS.includes(ext)
}

/** Un archivo "es una foto" para la app si el navegador lo reconoce como
 * imagen (`file.type`) O si su extensión es un RAW conocido — `file.type`
 * casi siempre viene vacío en RAW, así que sin este segundo chequeo se
 * descartaban en silencio, sin ningún error, antes de llegar a la cola. */
export function isAcceptedImageFile(file: File): boolean {
  return file.type.startsWith('image/') || isRawFile(file)
}

/** `file.type` viene vacío para casi todo RAW (el SO no tiene un MIME
 * registrado) — pero el backend (r2-upload-url) exige un content-type no
 * vacío y lo usa para firmar la URL de subida del respaldo, así que el
 * MISMO valor debe viajar en la firma y en el PUT real. `application/
 * octet-stream` es el genérico estándar para "binario sin tipo conocido",
 * válido para R2/S3 igual que cualquier otro. */
export function resolveContentType(file: File): string {
  return file.type || 'application/octet-stream'
}
