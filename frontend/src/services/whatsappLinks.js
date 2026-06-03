export const CLUB_WHATSAPP = process.env.REACT_APP_CLUB_WHATSAPP || "34656850729";

export function buildClubWhatsappUrl(message = "Hola, quiero información sobre clases de pádel") {
  return `https://wa.me/${CLUB_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
