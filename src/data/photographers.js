// Mock data de fotógrafos para el front-end
import Avatar from "../assets/profile/default-avatar.png";
import G1 from "../assets/profile/gallery-1.png";
import G2 from "../assets/profile/gallery-2.png";
import G3 from "../assets/profile/gallery-3.png";

export const photographers = [
  {
    id: "ph1",
    estudio: "Luz y Motor Studio",
    username: "@luzymotor",
    avatar: Avatar,
    portada: G1,
    ubicacion: "Guatemala Ciudad",
    rating: 4.8,
    estilos: ["Acción", "Panning", "Urbano"],
    precios: [
      { nombre: "1 Foto", precio: 50 },
      { nombre: "2 Fotos", precio: 90 },
      { nombre: "5 Fotos", precio: 200 },
    ],
    telefono: "+502 4444-4444",
    correo: "studio@example.com",
    facebook: "https://facebook.com/estudio_foto",
    instagram: "https://instagram.com/estudio_foto",
    website: "",
    portafolio: [G1, G2, G3],
    descripcion:
      "Capturamos la velocidad y la emoción de la ruta. Sesiones en pista, urbano y montaña.",
    hotspots: [
      { lat: 14.622, lng: -90.518, label: "Carretera a El Salvador" },
      { lat: 14.636, lng: -90.571, label: "Boulevard Los Próceres" },
    ],
  },
  {
    id: "ph2",
    estudio: "Ráfaga Pro Shots",
    username: "@rafagapro",
    avatar: Avatar,
    portada: G2,
    ubicacion: "Antigua Guatemala",
    rating: 4.6,
    estilos: ["Retrato", "Vintage", "Nocturno"],
    precios: [
      { nombre: "1 Foto", precio: 60 },
      { nombre: "2 Fotos", precio: 100 },
      { nombre: "5 Fotos", precio: 220 },
    ],
    telefono: "+502 3333-3333",
    correo: "contacto@rafaga.com",
    facebook: "",
    instagram: "https://instagram.com/rafaga",
    website: "https://rafaga.com",
    portafolio: [G2, G3, G1],
    descripcion:
      "Estilo cinematográfico con foco en retratos rider + moto. Sessions atardecer/noche.",
    hotspots: [{ lat: 14.557, lng: -90.733, label: "Cerro de la Cruz" }],
  },
  {
    id: "ph3",
    estudio: "Asfalto & Flash",
    username: "@asfaltoflash",
    avatar: Avatar,
    portada: G3,
    ubicacion: "Quetzaltenango",
    rating: 4.9,
    estilos: ["Acción", "Deporte", "Rally"],
    precios: [
      { nombre: "1 Foto", precio: 55 },
      { nombre: "2 Fotos", precio: 95 },
      { nombre: "5 Fotos", precio: 210 },
    ],
    telefono: "+502 2222-2222",
    correo: "hola@asfaltoflash.com",
    facebook: "https://facebook.com/asfaltoflash",
    instagram: "",
    website: "",
    portafolio: [G3, G1, G2],
    descripcion:
      "Cobertura de eventos y rallies. Congelamos el momento exacto de tu mejor pasada.",
    hotspots: [],
  },
];

export function getPhotographerById(id) {
  return photographers.find((p) => p.id === id);
}
