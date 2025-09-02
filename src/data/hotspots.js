// Hotspots (puntos de toma) y rutas
export const routes = [
  "Carretera a El Salvador",
  "Ruta Interamericana",
  "Carretera a Puerto Quetzal",
];

export const hotspots = [
  { id: "hs1", name: "Las Luces", route: "Carretera a El Salvador", lat: 14.568, lng: -90.476, popular: true },
  { id: "hs2", name: "Mirador KM 25", route: "Carretera a El Salvador", lat: 14.541, lng: -90.436, popular: false },
  { id: "hs3", name: "Cumbre de Alaska", route: "Ruta Interamericana", lat: 14.832, lng: -91.473, popular: true },
  { id: "hs4", name: "Curva del Puerto", route: "Carretera a Puerto Quetzal", lat: 13.929, lng: -90.796, popular: false },
];

export function hotspotById(id) {
  return hotspots.find((h) => h.id === id);
}
