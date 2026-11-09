import { useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "../services/api";
import { buildClubPhoneUrl, buildClubWhatsappUrl, clubPhoneLabel } from "../services/whatsappLinks";
import {
  DIAS,
  FORM_VACIO,
  FRANJAS,
  ORDEN_CAMPOS,
  PARA_QUIEN,
  construirMensajeWhatsapp,
  cuerpoConsulta,
  opcionesNivel,
  validarFormulario,
} from "../services/consultaGrupo";
import { IconoTelefono, IconoWhatsapp } from "./ContactoClub";
import "./contactoClub.css";
import "./encuentraGrupoForm.css";

// Opción de selección rápida: radio o casilla con aspecto de botón grande.
function Opcion({ tipo, nombre, valor, marcado, onChange, children, ariaLabel, corto = false }) {
  return (
    <label className={`egOpcion${corto ? " isCorto" : ""}`}>
      <input type={tipo} name={nombre} value={valor} checked={marcado} onChange={onChange} aria-label={ariaLabel} />
      <span>{children}</span>
    </label>
  );
}

function Pregunta({ numero, titulo, ayuda, error, id, children }) {
  return (
    <fieldset className="egPregunta" aria-describedby={error ? `${id}-error` : undefined} id={id} tabIndex={-1}>
      <legend><span className="egNumero" aria-hidden="true">{numero}</span>{titulo}</legend>
      {ayuda && <p className="egAyuda">{ayuda}</p>}
      {children}
      {error && <p className="egError" id={`${id}-error`}>{error}</p>}
    </fieldset>
  );
}

function Campo({ id, etiqueta, opcional, error, ayuda, children }) {
  return (
    <div className="egCampo">
      <label htmlFor={id}>{etiqueta}{opcional && <small> (opcional)</small>}</label>
      {children}
      {ayuda && !error && <p className="egAyuda" id={`${id}-ayuda`}>{ayuda}</p>}
      {error && <p className="egError" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

// Formulario de 4 preguntas: se envía al club por correo o se abre WhatsApp con el mensaje escrito.
export default function EncuentraGrupoForm() {
  const [f, setF] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [intento, setIntento] = useState(false);
  const [estado, setEstado] = useState("idle"); // idle | enviando | ok | error | sinCorreo
  const [mensajeError, setMensajeError] = useState("");
  const exitoRef = useRef(null);
  const avisoRef = useRef(null);
  const formRef = useRef(null);

  const set = (campo, valor) => {
    setF((prev) => ({ ...prev, [campo]: valor }));
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };
  const alternar = (campo, valor) => {
    setF((prev) => ({ ...prev, [campo]: prev[campo].includes(valor) ? prev[campo].filter((x) => x !== valor) : [...prev[campo], valor] }));
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const whatsappUrl = useMemo(() => buildClubWhatsappUrl(construirMensajeWhatsapp(f)), [f]);
  const nivel = opcionesNivel(f.paraQuien);
  const sinCorreo = estado === "sinCorreo";

  useEffect(() => {
    if (estado === "ok") exitoRef.current?.focus();
    if (estado === "error" || estado === "sinCorreo") avisoRef.current?.focus();
  }, [estado]);

  function irAlPrimerError(errs) {
    const campo = ORDEN_CAMPOS.find((c) => errs[c]);
    if (!campo) return;
    const el = formRef.current?.querySelector(`#eg-${campo}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    (el.matches("input,textarea") ? el : el.querySelector("input"))?.focus({ preventScroll: true });
  }

  async function enviar(event) {
    event.preventDefault();
    if (estado === "enviando") return;
    const errs = validarFormulario(f);
    setIntento(true);
    setErrores(errs);
    if (Object.keys(errs).length) {
      irAlPrimerError(errs);
      return;
    }
    setEstado("enviando");
    setMensajeError("");
    try {
      await apiPost("/api/contacto/grupo", cuerpoConsulta(f));
      setEstado("ok");
    } catch (error) {
      if (error?.status === 503) {
        setEstado("sinCorreo");
      } else {
        setMensajeError(error?.status === 429
          ? "Has enviado varias consultas seguidas. Espera un rato o escríbenos por WhatsApp."
          : "No hemos podido enviar tu consulta ahora mismo.");
        setEstado("error");
      }
    }
  }

  function otraConsulta() {
    setF(FORM_VACIO);
    setErrores({});
    setIntento(false);
    setEstado("idle");
  }

  const botonWhatsapp = (principal) => (
    <a className={`contactoBtn isWhatsapp egBoton${principal ? " isPrincipal" : ""}`} href={whatsappUrl} target="_blank" rel="noopener noreferrer">
      <IconoWhatsapp />
      <span>Escribir por WhatsApp</span>
    </a>
  );

  if (estado === "ok") {
    return (
      <div className="egExito" role="status" tabIndex={-1} ref={exitoRef}>
        <h3>¡Recibido!</h3>
        <p>El club te llamará al <strong>{f.telefono.trim()}</strong> en cuanto pueda para decirte qué grupos encajan.</p>
        <p className="egAyuda">Si tienes prisa, también puedes escribirnos por WhatsApp.</p>
        <div className="egAcciones">
          {botonWhatsapp(false)}
          <button type="button" className="egBoton egSecundario" onClick={otraConsulta}>Hacer otra consulta</button>
        </div>
      </div>
    );
  }

  const faltan = intento ? Object.values(errores).filter(Boolean).length : 0;
  const horarios = f.paraQuien === "yo" ? "¿Qué horarios te vienen mejor?" : "¿Qué horarios le vienen mejor?";

  return (
    <form className="egForm" ref={formRef} onSubmit={enviar} noValidate aria-label="Cuéntanos qué buscas">
      {faltan > 0 && (
        <p className="egResumen" role="alert">
          {faltan === 1 ? "Falta 1 dato. Lo hemos marcado más abajo." : `Faltan ${faltan} datos. Los hemos marcado más abajo.`}
        </p>
      )}

      <Pregunta numero="1" titulo="¿Para quién es la clase?" error={errores.paraQuien} id="eg-paraQuien">
        <div className="egOpciones">
          {PARA_QUIEN.map((o) => (
            <Opcion key={o.valor} tipo="radio" nombre="paraQuien" valor={o.valor} marcado={f.paraQuien === o.valor} onChange={() => set("paraQuien", o.valor)}>
              {o.etiqueta}
            </Opcion>
          ))}
        </div>
        {f.paraQuien === "hijo" && (
          <Campo id="eg-edad" etiqueta="¿Qué edad tiene?" error={errores.edad}>
            <input
              id="eg-edad"
              className="egInput egEdad"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              autoComplete="off"
              placeholder="Años"
              value={f.edad}
              onChange={(e) => set("edad", e.target.value.replace(/\D/g, ""))}
              aria-invalid={errores.edad ? "true" : undefined}
              aria-describedby={errores.edad ? "eg-edad-error" : undefined}
            />
          </Campo>
        )}
      </Pregunta>

      <Pregunta numero="2" titulo={nivel.pregunta} error={errores.nivel} id="eg-nivel">
        <div className="egOpciones isColumna">
          {nivel.opciones.map((o) => (
            <Opcion key={o.valor} tipo="radio" nombre="nivel" valor={o.valor} marcado={f.nivel === o.valor} onChange={() => set("nivel", o.valor)}>
              {o.etiqueta}
            </Opcion>
          ))}
        </div>
      </Pregunta>

      <Pregunta numero="3" titulo={horarios} ayuda="Puedes marcar varios." error={errores.franjas} id="eg-franjas">
        <div className="egOpciones">
          {FRANJAS.map((o) => (
            <Opcion key={o.valor} tipo="checkbox" nombre="franjas" valor={o.valor} marcado={f.franjas.includes(o.valor)} onChange={() => alternar("franjas", o.valor)}>
              {o.etiqueta}
            </Opcion>
          ))}
        </div>
        <p className="egSubtitulo" id="eg-dias-titulo">¿Qué días? <small>Si no marcas ninguno, nos vale cualquier día.</small></p>
        <div className="egOpciones" role="group" aria-labelledby="eg-dias-titulo">
          {DIAS.map((d) => (
            <Opcion key={d.valor} tipo="checkbox" nombre="dias" valor={d.valor} corto ariaLabel={d.largo} marcado={f.dias.includes(d.valor)} onChange={() => alternar("dias", d.valor)}>
              {d.corto}
            </Opcion>
          ))}
        </div>
      </Pregunta>

      <fieldset className="egPregunta">
        <legend><span className="egNumero" aria-hidden="true">4</span>¿Cómo te localizamos?</legend>
        <Campo id="eg-nombre" etiqueta="Tu nombre" error={errores.nombre}>
          <input id="eg-nombre" className="egInput" type="text" name="nombre" autoComplete="name" maxLength={80} value={f.nombre}
            onChange={(e) => set("nombre", e.target.value)} aria-invalid={errores.nombre ? "true" : undefined} aria-describedby={errores.nombre ? "eg-nombre-error" : undefined} />
        </Campo>
        <Campo id="eg-telefono" etiqueta="Tu teléfono" error={errores.telefono} ayuda="Te llamaremos a este número.">
          <input id="eg-telefono" className="egInput" type="tel" name="telefono" inputMode="tel" autoComplete="tel" maxLength={30} value={f.telefono}
            onChange={(e) => set("telefono", e.target.value)} aria-invalid={errores.telefono ? "true" : undefined}
            aria-describedby={errores.telefono ? "eg-telefono-error" : "eg-telefono-ayuda"} />
        </Campo>
        <Campo id="eg-email" etiqueta="Tu correo" opcional error={errores.email}>
          <input id="eg-email" className="egInput" type="email" name="email" inputMode="email" autoComplete="email" maxLength={120} value={f.email}
            onChange={(e) => set("email", e.target.value)} aria-invalid={errores.email ? "true" : undefined} aria-describedby={errores.email ? "eg-email-error" : undefined} />
        </Campo>
        <Campo id="eg-mensaje" etiqueta="¿Algo más que quieras contarnos?" opcional>
          <textarea id="eg-mensaje" className="egInput egTexto" name="mensaje" rows={3} maxLength={500} value={f.mensaje} onChange={(e) => set("mensaje", e.target.value)} />
        </Campo>
      </fieldset>

      {/* Trampa para bots: las personas no lo ven ni lo rellenan. */}
      <div className="egTrampa" aria-hidden="true">
        <label htmlFor="eg-web">Web</label>
        <input id="eg-web" type="text" name="web" tabIndex={-1} autoComplete="off" value={f.web} onChange={(e) => set("web", e.target.value)} />
      </div>

      {estado === "error" && (
        <div className="egAviso isError" role="alert" tabIndex={-1} ref={avisoRef}>
          <strong>{mensajeError}</strong>
          <span>No se ha perdido nada de lo que has escrito. Puedes volver a intentarlo o probar por WhatsApp, que ya lleva todo el mensaje escrito.</span>
        </div>
      )}
      {sinCorreo && (
        <div className="egAviso" role="status" tabIndex={-1} ref={avisoRef}>
          <strong>Por ahora, mejor por WhatsApp.</strong>
          <span>El envío desde la web no está disponible en este momento. Pulsa el botón verde: el mensaje ya lleva todas tus respuestas.</span>
        </div>
      )}

      <div className="egAcciones">
        {!sinCorreo && (
          <button type="submit" className="egBoton egEnviar" disabled={estado === "enviando"} aria-busy={estado === "enviando"}>
            {estado === "enviando" ? "Enviando…" : estado === "error" ? "Volver a intentarlo" : "Enviar al club"}
          </button>
        )}
        {botonWhatsapp(sinCorreo || estado === "error")}
      </div>
      <p className="egPie">
        <IconoTelefono /> ¿Prefieres hablar? <a href={buildClubPhoneUrl()}>Llama al {clubPhoneLabel()}</a>
      </p>
    </form>
  );
}
