# MotoShots React + Tailwind (Vite)
Estructura separada por rutas públicas, portal de usuario (**/app**) y portal de fotógrafo (**/studio**).

## Scripts
```bash
npm i
npm run dev
```

## Rutas
- Públicas: `/`, `/login`, `/signup`, `/login-fotografo`, `/signup-fotografo`, `/eres-fotografo`, `/fotografos`, `/eventos`, `/precios`
- Biker: `/app`, `/app/historial`, `/app/buscar`, `/app/fotografos`, `/app/perfil`, `/app/checkout`
- Fotógrafo: `/studio`, `/studio/eventos`, `/studio/pedidos`, `/studio/estadisticas`, `/studio/perfil`, `/studio/carga-rapida`

## Notas
- Header/Footer ocultos en páginas de auth y en ambos portales.
- Tema oscuro para todo `/studio`.
- Carrito y Drawer disponibles en portal **/app**.
