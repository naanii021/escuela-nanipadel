// Datos públicos del club que salen en el pie de página y en las páginas legales.
// Es el ÚNICO sitio que hay que tocar para rellenarlos. Si un dato se deja vacío ("" o []),
// la web muestra "Próximamente" o lo oculta; nunca sale un enlace roto.
// El teléfono y el WhatsApp están en services/whatsappLinks.js (variables REACT_APP_CLUB_*).

// Interruptor de la tienda: mientras sea false no hay enlace en el menú y /tienda redirige a la portada.
// Pon true cuando haya material real (la página pages/Tienda.jsx sigue intacta).
export const TIENDA_VISIBLE = false;

const CLUB = {
  nombre: "Escuela NaniPadel",

  // Dirección de las pistas, tal y como se quiere ver. Ej.: "Calle Ejemplo 1, 10001 Cáceres"
  direccion: "",
  // Enlace a Google Maps de esa dirección (opcional). Ej.: "https://maps.app.goo.gl/..."
  mapa: "",

  // Horario de atención por teléfono/WhatsApp. Ej.: "Lunes a viernes, de 10:00 a 14:00 y de 17:00 a 21:00"
  horario: "",

  // Correo de contacto (también se usa en las páginas legales). Ej.: "info@nanipadel.es"
  email: "",

  // Redes sociales: pon la dirección completa del perfil o déjala vacía.
  redes: {
    instagram: "",
    facebook: "",
    tiktok: "",
    youtube: "",
  },

  // Patrocinadores: { nombre, logo, url }. El logo va en frontend/public/patrocinadores/
  // y se escribe con su ruta, p. ej. { nombre: "Deportes Pérez", logo: "/patrocinadores/perez.png", url: "https://..." }.
  // Mientras haya menos de 4, los huecos libres salen como "Tu marca aquí".
  patrocinadores: [],

  // Datos del responsable para el aviso legal y la privacidad.
  titular: {
    nombre: "", // Nombre y apellidos o razón social
    nif: "",
    domicilio: "",
  },
};

export default CLUB;
