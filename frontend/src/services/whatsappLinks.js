export const CLUB_WHATSAPP = process.env.REACT_APP_CLUB_WHATSAPP || "34656850729";
// Teléfono para llamar: por defecto el mismo número del WhatsApp del club.
export const CLUB_TELEFONO = process.env.REACT_APP_CLUB_TELEFONO || CLUB_WHATSAPP;

export function buildClubWhatsappUrl(message = "Hola, quiero información sobre clases de pádel") {
  return `https://wa.me/${CLUB_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function buildClubPhoneUrl() {
  return `tel:+${CLUB_TELEFONO.replace(/\D/g, "")}`;
}

// "656 85 07 29" para mostrar en pantalla.
export function clubPhoneLabel() {
  const digits = CLUB_TELEFONO.replace(/\D/g, "").replace(/^34(?=\d{9}$)/, "");
  return digits.length === 9 ? digits.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4") : digits;
}
