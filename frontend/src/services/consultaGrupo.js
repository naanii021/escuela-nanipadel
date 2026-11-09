// Lógica del formulario "Encuentra tu grupo": opciones, validación y mensaje de WhatsApp.
// Los valores (yo, hijo, nunca...) son los que acepta POST /api/contacto/grupo.

export const FRANJAS = [
  { valor: "manana", etiqueta: "Mañanas" },
  { valor: "tarde", etiqueta: "Tardes" },
  { valor: "noche", etiqueta: "Noches" },
];

export const DIAS = [
  { valor: "L", corto: "Lun", largo: "Lunes" },
  { valor: "M", corto: "Mar", largo: "Martes" },
  { valor: "X", corto: "Mié", largo: "Miércoles" },
  { valor: "J", corto: "Jue", largo: "Jueves" },
  { valor: "V", corto: "Vie", largo: "Viernes" },
  { valor: "S", corto: "Sáb", largo: "Sábado" },
  { valor: "D", corto: "Dom", largo: "Domingo" },
];

export const PARA_QUIEN = [
  { valor: "yo", etiqueta: "Para mí" },
  { valor: "hijo", etiqueta: "Para mi hijo o hija" },
];

// Las frases cambian de persona según para quién sea la clase.
export function opcionesNivel(paraQuien) {
  const yo = paraQuien === "yo";
  return {
    pregunta: yo ? "¿Qué nivel tienes?" : "¿Qué nivel tiene?",
    opciones: [
      { valor: "nunca", etiqueta: yo ? "Nunca he jugado" : "Nunca ha jugado" },
      { valor: "alguna_vez", etiqueta: yo ? "He jugado alguna vez" : "Ha jugado alguna vez" },
      { valor: "regular", etiqueta: yo ? "Juego con regularidad" : "Juega con regularidad" },
    ],
  };
}

export const FORM_VACIO = {
  paraQuien: "",
  edad: "",
  nivel: "",
  franjas: [],
  dias: [],
  nombre: "",
  telefono: "",
  email: "",
  mensaje: "",
  web: "", // honeypot: debe quedarse vacío
};

// Devuelve { campo: mensaje } solo con los campos que fallan (en el orden del formulario).
export function validarFormulario(f) {
  const e = {};
  if (!f.paraQuien) e.paraQuien = "Elige para quién es la clase.";
  if (f.paraQuien === "hijo") {
    const edad = Number(f.edad);
    if (!String(f.edad).trim()) e.edad = "Escribe la edad de tu hijo o hija.";
    else if (!Number.isInteger(edad) || edad < 3 || edad > 99) e.edad = "Escribe una edad entre 3 y 99 años.";
  }
  if (!f.nivel) e.nivel = "Elige un nivel. Si dudas, marca el que más se parezca.";
  if (!f.franjas.length) e.franjas = "Marca al menos un momento del día.";
  if (f.nombre.trim().length < 2) e.nombre = "Escribe tu nombre.";
  const cifras = f.telefono.replace(/\D/g, "");
  if (!f.telefono.trim()) e.telefono = "Escribe tu teléfono para que podamos llamarte.";
  else if (!/^[+\d\s().-]+$/.test(f.telefono.trim()) || cifras.length < 9 || cifras.length > 15) {
    e.telefono = "Revisa el teléfono: tiene que tener 9 cifras, por ejemplo 656 85 07 29.";
  }
  const email = f.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "Este correo no parece correcto. Revísalo o déjalo en blanco.";
  return e;
}

// Orden de los campos para llevar el foco al primer error.
export const ORDEN_CAMPOS = ["paraQuien", "edad", "nivel", "franjas", "nombre", "telefono", "email"];

// Cuerpo que espera el backend.
export function cuerpoConsulta(f) {
  return {
    paraQuien: f.paraQuien,
    edad: f.paraQuien === "hijo" && String(f.edad).trim() ? Number(f.edad) : null,
    nivel: f.nivel,
    franjas: f.franjas,
    dias: f.dias,
    nombre: f.nombre.trim(),
    telefono: f.telefono.trim(),
    email: f.email.trim(),
    mensaje: f.mensaje.trim(),
    web: f.web,
  };
}

// Mensaje de WhatsApp con TODAS las respuestas. No exige nada: lo que falte se omite.
export function construirMensajeWhatsapp(f) {
  const lineas = ["Hola, quiero información sobre las clases de pádel."];

  if (f.paraQuien) {
    const edad = f.paraQuien === "hijo" && String(f.edad).trim() ? `, ${String(f.edad).trim()} años` : "";
    lineas.push(`- Para quién: ${f.paraQuien === "hijo" ? "mi hijo o hija" : "para mí"}${edad}`);
  }
  if (f.nivel) {
    const nivel = opcionesNivel(f.paraQuien).opciones.find((o) => o.valor === f.nivel);
    if (nivel) lineas.push(`- Nivel: ${nivel.etiqueta.toLowerCase()}`);
  }
  if (f.franjas.length) {
    const franjas = FRANJAS.filter((x) => f.franjas.includes(x.valor)).map((x) => x.etiqueta.toLowerCase());
    lineas.push(`- Horarios: ${franjas.join(", ")}`);
  }
  if (f.dias.length || f.franjas.length) {
    lineas.push(`- Días: ${f.dias.length ? DIAS.filter((d) => f.dias.includes(d.valor)).map((d) => d.largo.toLowerCase()).join(", ") : "cualquier día"}`);
  }
  if (f.nombre.trim()) lineas.push(`- Me llamo ${f.nombre.trim()}`);
  if (f.telefono.trim()) lineas.push(`- Mi teléfono: ${f.telefono.trim()}`);
  if (f.email.trim()) lineas.push(`- Mi correo: ${f.email.trim()}`);
  if (f.mensaje.trim()) lineas.push(`- Algo más: ${f.mensaje.trim()}`);
  return lineas.join("\n");
}
