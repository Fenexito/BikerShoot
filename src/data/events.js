// Mock sencillo de eventos próximos (solo front)
import G1 from "../assets/profile/gallery-1.png";
import G2 from "../assets/profile/gallery-2.png";
import G3 from "../assets/profile/gallery-3.png";

export const events = [
  {
    id: "ev1",
    titulo: "Track Day Autódromo",
    fecha: "2025-08-23T10:00:00",
    ubicacion: "Autódromo Pedro Cofiño",
    tipo: "Track Day",
    cover: G1,
  },
  {
    id: "ev2",
    titulo: "Rodada a Antigua",
    fecha: "2025-08-24T07:30:00",
    ubicacion: "Antigua Guatemala",
    tipo: "Rodada",
    cover: G2,
  },
  {
    id: "ev3",
    titulo: "Rally de Montaña",
    fecha: "2025-08-30T08:00:00",
    ubicacion: "Tecpán",
    tipo: "Rally",
    cover: G3,
  },
  {
    id: "ev4",
    titulo: "Ruta Nocturna",
    fecha: "2025-09-01T19:00:00",
    ubicacion: "Ciudad de Guatemala",
    tipo: "Urbano",
    cover: G2,
  },
];
