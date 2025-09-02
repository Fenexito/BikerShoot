// Fotos mock para el BUSCADOR (sin backend).
// Colocá 15 imágenes de prueba en: src/assets/mock/photos/p1.jpg ... p15.jpg
// También reusamos 3 imágenes que ya tenés del perfil (G1, G2, G3) por variedad visual.

import G1 from "../assets/profile/gallery-1.png";
import G2 from "../assets/profile/gallery-2.png";
import G3 from "../assets/profile/gallery-3.png";

import P1  from "../assets/mock/photos/p1.jpg";
import P2  from "../assets/mock/photos/p2.jpg";
import P3  from "../assets/mock/photos/p3.jpg";
import P4  from "../assets/mock/photos/p4.jpg";
import P5  from "../assets/mock/photos/p5.jpg";
import P6  from "../assets/mock/photos/p6.jpg";
import P7  from "../assets/mock/photos/p7.jpg";
import P8  from "../assets/mock/photos/p8.jpg";
import P9  from "../assets/mock/photos/p9.jpg";
import P10 from "../assets/mock/photos/p10.jpg";
import P11 from "../assets/mock/photos/p11.jpg";
import P12 from "../assets/mock/photos/p12.jpg";
import P13 from "../assets/mock/photos/p13.jpg";
import P14 from "../assets/mock/photos/p14.jpg";
import P15 from "../assets/mock/photos/p15.jpg";

// Domingo de ejemplo (alineado a lo que ya usamos)
const baseDate = "2025-08-17";
const t = (hh, mm, ss = 0) =>
  `${baseDate}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

// Helper para crear entradas
const mk = (
  id, url, photographerId, hh, mm, ss, hotspotId, route, aiConfidence, qualityScore,
  areas, clusterId, riders = 1
) => ({
  id,
  url,
  photographerId,
  timestamp: t(hh, mm, ss),
  hotspotId,
  route,
  aiConfidence,
  qualityScore,
  areas, // { moto:[], casco:[], chaqueta:[] }
  clusterId,
  riders,
});

/**
 * Hotspots / Rutas (ya existen en src/data/hotspots.js):
 * hs1: Las Luces — Carretera a El Salvador
 * hs2: Mirador KM 25 — Carretera a El Salvador
 * hs3: Cumbre de Alaska — Ruta Interamericana
 * hs4: Curva del Puerto — Carretera a Puerto Quetzal
 *
 * Fotógrafos (ids de src/data/photographers.js): ph1, ph2, ph3
 */

export const searchPhotos = [
  // ===== Cluster C1 — hs1 — ph1 — Moto AZUL, casco NEGRO =====
  mk("c1-01", P1, "ph1", 7, 10, 12, "hs1", "Carretera a El Salvador", 0.92, 0.86, { moto:["azul","negro"], casco:["negro"], chaqueta:["negro"] }, "c1", 1),
  mk("c1-02", P2, "ph1", 7, 10, 13, "hs1", "Carretera a El Salvador", 0.90, 0.84, { moto:["azul"],          casco:["negro"], chaqueta:["gris"]  }, "c1", 1),
  mk("c1-03", P3, "ph1", 7, 10, 14, "hs1", "Carretera a El Salvador", 0.88, 0.80, { moto:["azul","blanco"], casco:["negro"], chaqueta:["negro"] }, "c1", 1),
  mk("c1-04", G1, "ph1", 7, 10, 16, "hs1", "Carretera a El Salvador", 0.89, 0.82, { moto:["azul"],          casco:["negro"], chaqueta:["negro"] }, "c1", 1),

  // ===== Cluster C2 — hs1 — ph2 — Moto ROJA =====
  mk("c2-01", P4, "ph2", 7, 22,  4, "hs1", "Carretera a El Salvador", 0.78, 0.72, { moto:["rojo","negro"], casco:["blanco"], chaqueta:["negro"] }, "c2", 1),
  mk("c2-02", P5, "ph2", 7, 22,  6, "hs1", "Carretera a El Salvador", 0.75, 0.70, { moto:["rojo"],         casco:["negro"],  chaqueta:["negro"] }, "c2", 2),
  mk("c2-03", G2, "ph2", 7, 22,  8, "hs1", "Carretera a El Salvador", 0.77, 0.71, { moto:["rojo"],         casco:["negro"],  chaqueta:["gris"]  }, "c2", 1),

  // ===== Cluster C3 — hs2 — ph1 — Moto NEGRA =====
  mk("c3-01", P6, "ph1", 7, 45, 20, "hs2", "Carretera a El Salvador", 0.81, 0.78, { moto:["negro"],        casco:["negro"],  chaqueta:["negro"] }, "c3", 1),
  mk("c3-02", P7, "ph1", 7, 45, 21, "hs2", "Carretera a El Salvador", 0.83, 0.80, { moto:["negro","blanco"], casco:["negro"], chaqueta:["gris"] }, "c3", 1),
  mk("c3-03", G3, "ph1", 7, 45, 23, "hs2", "Carretera a El Salvador", 0.79, 0.76, { moto:["negro"],        casco:["blanco"], chaqueta:["negro"] }, "c3", 1),

  // ===== Cluster C4 — hs3 — ph3 — Moto AZUL (Interamericana) =====
  mk("c4-01", P8,  "ph3", 8,  5, 10, "hs3", "Ruta Interamericana",     0.86, 0.82, { moto:["azul"],        casco:["negro"],  chaqueta:["negro"] }, "c4", 1),
  mk("c4-02", P9,  "ph3", 8,  5, 11, "hs3", "Ruta Interamericana",     0.84, 0.78, { moto:["azul","negro"], casco:["negro"], chaqueta:["negro"] }, "c4", 1),
  mk("c4-03", G1,  "ph3", 8,  5, 13, "hs3", "Ruta Interamericana",     0.88, 0.80, { moto:["azul"],        casco:["blanco"], chaqueta:["gris"]  }, "c4", 2),

  // ===== Cluster C5 — hs4 — ph2 — Moto VERDE (Puerto) =====
  mk("c5-01", P10, "ph2", 9, 15,  2, "hs4", "Carretera a Puerto Quetzal", 0.70, 0.65, { moto:["verde"], casco:["negro"],  chaqueta:["negro"] }, "c5", 1),
  mk("c5-02", P11, "ph2", 9, 15,  4, "hs4", "Carretera a Puerto Quetzal", 0.72, 0.66, { moto:["verde","negro"], casco:["negro"], chaqueta:["negro"] }, "c5", 1),

  // ===== Sueltos (para mosaico) =====
  mk("s1",  P12, "ph1", 10,  5,  1, "hs2", "Carretera a El Salvador", 0.76, 0.70, { moto:["blanco"], casco:["negro"],  chaqueta:["negro"] }, "c6", 1),
  mk("s2",  P13, "ph3", 10,  7,  5, "hs3", "Ruta Interamericana",     0.82, 0.77, { moto:["negro"],  casco:["negro"],  chaqueta:["negro"] }, "c6", 1),
  mk("s3",  P14, "ph2", 10,  9,  9, "hs1", "Carretera a El Salvador", 0.80, 0.73, { moto:["rojo"],   casco:["negro"],  chaqueta:["negro"] }, "c2", 1),
  mk("s4",  G2,  "ph1", 10, 30,  0, "hs1", "Carretera a El Salvador", 0.90, 0.86, { moto:["azul"],   casco:["negro"],  chaqueta:["negro"] }, "c1", 1),
  mk("s5",  P15, "ph3", 11, 15, 30, "hs3", "Ruta Interamericana",     0.68, 0.60, { moto:["negro"],  casco:["blanco"], chaqueta:["negro"] }, "c4", 2),
  mk("s6",  G3,  "ph2", 11, 35, 45, "hs4", "Carretera a Puerto Quetzal", 0.74, 0.65, { moto:["verde"], casco:["negro"], chaqueta:["negro"] }, "c5", 1),
];
