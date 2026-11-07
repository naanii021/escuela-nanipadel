// Iconos SVG del panel (trazo único de 2 px, heredan el color del texto).
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
};

export const IcCheck = (props) => <svg {...base} {...props}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IcX = (props) => <svg {...base} {...props}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IcNota = (props) => <svg {...base} {...props}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></svg>;
export const IcBuscar = (props) => <svg {...base} {...props}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const IcTelefono = (props) => <svg {...base} {...props}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
export const IcMensaje = (props) => <svg {...base} {...props}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /></svg>;
export const IcAtras = (props) => <svg {...base} {...props}><path d="M15 5l-7 7 7 7" /></svg>;
export const IcAdelante = (props) => <svg {...base} {...props}><path d="M9 5l7 7-7 7" /></svg>;
export const IcAviso = (props) => <svg {...base} {...props}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></svg>;
export const IcMas = (props) => <svg {...base} {...props}><path d="M12 5v14M5 12h14" /></svg>;
export const IcLista = (props) => <svg {...base} {...props}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>;
