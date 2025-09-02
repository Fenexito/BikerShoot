// Mock de pedidos del Biker (solo front)
import { photographers } from "./photographers";

const byId = Object.fromEntries(photographers.map(p => [p.id, p]));

export const ORDER_STATUS = {
  CANCELADO: "CANCELADO",
  PENDIENTE: "PENDIENTE",
  EN_PROCESO: "EN_PROCESO",
  PAGADO: "PAGADO",
  COMPLETADO: "COMPLETADO",
  REEMBOLSADO: "REEMBOLSADO",
};

export const PAYMENT_STATUS = {
  PENDIENTE: "PENDIENTE",
  PAGADO: "PAGADO",
  FALLIDO: "FALLIDO",
  REEMBOLSADO: "REEMBOLSADO",
};

export const orders = [
  {
    id: "ORD-2025-00018",
    fecha: "2025-08-15T16:22:00Z",
    estado: ORDER_STATUS.COMPLETADO,
    pagoEstado: PAYMENT_STATUS.PAGADO,
    pagoMetodo: "Tarjeta",
    items: [
      { photographerId: "ph1", fotos: 1, precio: 50 }, // Q50 c/u
      { photographerId: "ph2", fotos: 2, precio: 100 }, // paquete 2
    ],
    notas: "Entrega completa. ¡Gracias por su compra!",
  },
  {
    id: "ORD-2025-00017",
    fecha: "2025-08-12T10:10:00Z",
    estado: ORDER_STATUS.PAGADO,
    pagoEstado: PAYMENT_STATUS.PAGADO,
    pagoMetodo: "Transferencia",
    items: [{ photographerId: "ph3", fotos: 5, precio: 200 }],
    notas: "Listo para descarga cuando el estudio termine la edición.",
  },
  {
    id: "ORD-2025-00016",
    fecha: "2025-08-10T20:05:00Z",
    estado: ORDER_STATUS.EN_PROCESO,
    pagoEstado: PAYMENT_STATUS.PENDIENTE,
    pagoMetodo: "—",
    items: [{ photographerId: "ph1", fotos: 1, precio: 50 }],
    notas: "El fotógrafo está seleccionando fotos recomendadas.",
  },
  {
    id: "ORD-2025-00015",
    fecha: "2025-08-08T08:45:00Z",
    estado: ORDER_STATUS.PENDIENTE,
    pagoEstado: PAYMENT_STATUS.PENDIENTE,
    pagoMetodo: "—",
    items: [{ photographerId: "ph2", fotos: 3, precio: 220 }],
    notas: "Esperando confirmación de pago.",
  },
  {
    id: "ORD-2025-00014",
    fecha: "2025-08-05T14:30:00Z",
    estado: ORDER_STATUS.CANCELADO,
    pagoEstado: PAYMENT_STATUS.REEMBOLSADO,
    pagoMetodo: "Tarjeta",
    items: [{ photographerId: "ph2", fotos: 1, precio: 60 }],
    notas: "Pedido cancelado por el usuario.",
  },
];

export function getOrderById(id) {
  return orders.find((o) => o.id === id);
}

export function resolvePhotographerName(id) {
  return byId[id]?.estudio || "Estudio";
}

export function resolvePhotographerLink(id) {
  // Ajustado a tu app: /app/fotografos/:id
  return `/app/fotografos/${id}`;
}

export function orderTotals(order) {
  const totalFotos = order.items.reduce((acc, it) => acc + it.fotos, 0);
  const totalQ = order.items.reduce((acc, it) => acc + (it.precio || 0), 0);
  return { totalFotos, totalQ };
}
