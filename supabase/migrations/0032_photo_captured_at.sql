-- Hora de captura leída del EXIF de la foto (DateTimeOriginal), extraída en
-- el navegador antes de subir el archivo. Permite clasificar automáticamente
-- las fotos de un punto en segmentos de tiempo (15/30 min) sin que el
-- fotógrafo tenga que dividirlas manualmente en mini-álbumes como hoy hace
-- en Pixieset. Null cuando el archivo no trae EXIF (capturas de pantalla,
-- reenvíos por WhatsApp, algunas apps de cámara) — esas fotos caen en un
-- grupo "sin hora registrada" en vez de bloquear la subida.
alter table public.photos add column if not exists captured_at timestamptz;
