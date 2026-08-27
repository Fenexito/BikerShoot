# MotoShots v2

Reconstrucción desde cero de MotoShots, pensada para escalar de cientos a 5,000–10,000+ usuarios.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS (design tokens en `tailwind.config.js`)
- React Router (portales público / `/app` biker / `/studio` fotógrafo / `/admin`)
- TanStack Query (fetching + cache, sin recargas)
- Zustand (estado ligero: toasts, luego carrito/sesión)
- React Hook Form + Zod (formularios y validación)
- Supabase (Auth + Postgres) — `.env` copiado del proyecto anterior
- Storage de fotos: Cloudflare R2 (pendiente de conectar, ver `lib/storage.ts` cuando se implemente)

## Estructura

```
src/
  app/            bootstrap y layout raíz (PortalLayout)
  ui/
    primitives/   Button, Input, Card, Badge
    overlays/     Modal, Toaster (store con Zustand)
    layout/       HeaderPublic, HeaderUser, HeaderStudio, Footer
  lib/            supabase.ts, queryClient.ts, cn.ts
  features/
    auth/
    biker/
    photographer/
    search/
    admin/
    bug-reports/  Widget flotante "Reportar bug" (ya funcional, ver abajo)
    changelog/    Página /changelog que lee la tabla `releases`
```

## Ya implementado (Fase 0)

- Design system base (Button, Input, Card, Badge, Modal, Toaster) con tokens de color/espaciado unificados.
- 3 headers por portal + layout que cambia tema/chrome según la ruta.
- Widget de **reporte de bugs**: botón flotante en toda la app, detecta la página automáticamente, guarda en `bug_reports`.
- Página de **changelog** (`/changelog`) que lee la tabla `releases`.
- Migración SQL en `supabase/migrations/0001_bug_reports_and_releases.sql` — **hay que correrla en el SQL editor de Supabase** para que estas dos features funcionen contra datos reales.

## Pendiente (siguientes fases)

1. Auth real (login/signup biker y fotógrafo) + RLS por rol.
2. Perfiles + carga de fotos a R2 con variantes (thumbnail/preview/original).
3. Búsqueda con filtros + mapa de puntos.
4. Carrito + checkout + pagos (tarjeta vía pasarela centroamericana + transferencia manual con comprobante).
5. Admin: aprobación de fotógrafos, planes de storage pagados, vista de bug reports, publicar releases.
6. Hardening: infinite scroll en galerías, Core Web Vitals, pruebas en móvil/tablet.

## Correr en local

```bash
npm install
npm run dev
```
