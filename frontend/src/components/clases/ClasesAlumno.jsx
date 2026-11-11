import "./clasesPagina.css";
import { buildClubWhatsappUrl } from "../../services/whatsappLinks";
import { fechaCorta, fechaLarga, fechaRelativa } from "../../services/fechas";
import ContactoClub from "../ContactoClub";
import {
  IcBell, IcCalendar, IcCheck, IcClock, IcCourt, IcCross, IcRefresh, IcUser, IcWarn,
  estadoTexto, fechaClase, formatDias, formatHora, horaClase, motivoTexto, nivelClave, nivelLabel, proximaDia,
} from "./clasesComun";

const PEDIR_FECHA = buildClubWhatsappUrl("Hola, tengo una recuperación pendiente de clase de pádel. ¿Cuándo puedo recuperarla?");
const CONTACT_HREF = buildClubWhatsappUrl("Hola, quiero información sobre clases de pádel");

// "jue 12 nov" -> { dia: "12", mes: "nov", sem: "jue" }
function bloqueFecha(valor) {
  const [sem = "", dia = "", mes = ""] = fechaCorta(valor).split(" ");
  return { sem, dia, mes };
}

function SesionFila({ sesion, grupo }) {
  const { sem, dia, mes } = bloqueFecha(sesion.fecha);
  const cancelada = sesion.estado === "cancelada" || sesion.estado === "suspendida";
  return (
    <li className={`clFila${cancelada ? " isCancelada" : ""}`}>
      <span className="clFecha" aria-hidden="true"><small>{sem}</small><b>{dia}</b><small>{mes}</small></span>
      <div className="clFilaTexto">
        <strong>{fechaClase(sesion.fecha)}</strong>
        <span>De {horaClase(sesion.hora_inicio, sesion.duracion_min || grupo?.duracion_min || 60)} · {sesion.pista_habitual || grupo?.pista_habitual || "Pista por confirmar"}</span>
        {cancelada && (
          <em className={`clPildora clPildoraRoja`}>
            {estadoTexto(sesion.estado)}{sesion.estado === "cancelada" && sesion.cancelacion?.etiqueta ? ` · ${sesion.cancelacion.etiqueta}` : ""}
          </em>
        )}
      </div>
    </li>
  );
}

function GrupoTarjeta({ grupo }) {
  const proxima = proximaDia(grupo.dia1, grupo.dia2);
  return (
    <article className="clGrupo" data-nivel={nivelClave(grupo.nivel)}>
      <div className="clGrupoTop">
        <span className="clNivelPildora">{nivelLabel(grupo.nivel)}</span>
        {proxima && <span className={`clPildora${proxima === "Hoy" ? " clPildoraLima" : ""}`}><IcClock /> {proxima}</span>}
      </div>
      <h3>{grupo.nombre || "Grupo de clases"}</h3>
      <dl className="clDatos">
        <div><dt><IcCalendar /> Días</dt><dd>{formatDias(grupo.dia1, grupo.dia2)}</dd></div>
        <div><dt><IcClock /> Hora</dt><dd>{formatHora(grupo.hora_inicio, grupo.duracion_min)}</dd></div>
        <div><dt><IcCourt /> Pista</dt><dd>{grupo.pista_habitual || "Pendiente"}</dd></div>
        <div><dt><IcUser /> Profesor</dt><dd>{grupo.profesor || "Pendiente"}</dd></div>
      </dl>
    </article>
  );
}

export default function ClasesAlumno({ classData, loading }) {
  const alumno = classData?.alumno || {};
  const grupo = classData?.grupo || null;
  const misClases = classData?.clases || [];
  const avisos = classData?.avisos || [];
  const recuperaciones = classData?.recuperaciones || [];
  const proximasSesiones = classData?.proximasSesiones || classData?.proximas_clases || [];
  const asistenciaReciente = classData?.asistenciaReciente || classData?.asistencia || [];

  const esCancelada = (s) => s.estado === "cancelada" || s.estado === "suspendida";
  const proxima = proximasSesiones.find((s) => !esCancelada(s)) || null;
  const canceladaAntes = proximasSesiones.find((s, i) => esCancelada(s) && (!proxima || i < proximasSesiones.indexOf(proxima))) || null;
  const grupoDe = (sesion) => (sesion ? misClases.find((g) => String(g.id) === String(sesion.grupo_id)) || grupo : grupo);
  const grupoProxima = grupoDe(proxima);
  const resto = proximasSesiones.filter((s) => s !== proxima);
  const nombre = alumno.nombre || "";
  const nivel = alumno.nivel_juego || alumno.nivel || grupo?.nivel;
  const sinFecha = recuperaciones.filter((r) => !r.fecha_recuperacion).length;
  const relativa = proxima ? fechaRelativa(proxima.fecha) : "";
  const esHoy = relativa === "Hoy" || relativa === "Mañana";

  return (
    <section className="clases clPag clAlumnoPag">
      <header className="clHero clHeroAlumno">
        <div className="clHeroTexto">
          <span className="clEyebrow">Mis clases</span>
          <h1>{nombre ? `Hola, ${nombre}` : "Hola"}</h1>
          <p>
            {nivel && <span className="clHeroNivel" data-nivel={nivelClave(nivel)}>{nivelLabel(nivel)}</span>}
            {loading ? "Cargando tus clases…" : misClases.length ? `${misClases.length} grupo${misClases.length === 1 ? "" : "s"} · aquí tienes lo que viene.` : "Aquí verás tus clases, avisos y recuperaciones."}
          </p>
        </div>
      </header>

      {canceladaAntes && (
        <div className="clAlerta" role="status">
          <IcWarn size={26} />
          <div>
            <strong>Clase cancelada: {fechaLarga(canceladaAntes.fecha, { capital: false })}</strong>
            <span>{canceladaAntes.cancelacion?.etiqueta ? `Motivo: ${canceladaAntes.cancelacion.etiqueta}. ` : ""}No hace falta que vengas a esa clase.</span>
          </div>
        </div>
      )}

      <div className="clColumnas">
        <div className="clPrincipal">
          <section className="clProxima" aria-labelledby="cl-proxima">
            <span className="clEyebrow clEyebrowLima" id="cl-proxima">Tu próxima clase</span>
            {proxima ? (
              <>
                <h2 className={esHoy ? "isHoy" : ""}>{relativa}{esHoy && <small> · {fechaLarga(proxima.fecha, { capital: false })}</small>}</h2>
                <p className="clProximaHora"><IcClock size={22} /> De {horaClase(proxima.hora_inicio, proxima.duracion_min || grupoProxima?.duracion_min || 60)}</p>
                <ul className="clProximaChips">
                  <li><IcCourt size={16} /> {proxima.pista_habitual || grupoProxima?.pista_habitual || "Pista por confirmar"}</li>
                  <li><IcUser size={16} /> {grupoProxima?.profesor || classData?.profesor?.nombre || "Profesor por confirmar"}</li>
                  {grupoProxima?.nombre && <li><IcCalendar size={16} /> {grupoProxima.nombre}</li>}
                </ul>
              </>
            ) : (
              <>
                <h2>Aún no hay clase a la vista</h2>
                <p className="clProximaVacio">Cuando el club programe tu próxima clase la verás aquí. Si crees que falta, escríbenos.</p>
                <a href={CONTACT_HREF} className="clBtnLima" target="_blank" rel="noopener noreferrer">Preguntar al club</a>
              </>
            )}
          </section>

          {resto.length > 0 && (
            <section className="clBloque" aria-labelledby="cl-sesiones">
              <h2 id="cl-sesiones">Después</h2>
              <ul className="clLista">
                {resto.map((s) => <SesionFila key={s.id} sesion={s} grupo={grupoDe(s)} />)}
              </ul>
            </section>
          )}

          <section className="clBloque" aria-labelledby="cl-grupos">
            <div className="clBloqueCab">
              <h2 id="cl-grupos">{misClases.length === 1 ? "Mi grupo" : "Mis grupos"}</h2>
            </div>
            {misClases.length ? (
              <div className="clGrupos">
                {misClases.map((g) => <GrupoTarjeta key={g.id} grupo={g} />)}
              </div>
            ) : (
              <div className="clVacio">
                <IcCourt size={30} />
                <strong>Todavía no tienes grupo asignado</strong>
                <p>No pasa nada: el club te lo asignará en cuanto haya plaza en tu nivel.</p>
              </div>
            )}
          </section>
        </div>

        <div className="clLateral">
          {avisos.length > 0 && (
            <section className="clBloque clBloqueAviso" aria-labelledby="cl-avisos">
              <h2 id="cl-avisos"><IcBell size={20} /> Avisos del profesor</h2>
              <ul className="clLista">
                {avisos.map((a) => (
                  <li className="clAvisoFila" key={a.id}><strong>{a.titulo}</strong><span>{a.mensaje}</span></li>
                ))}
              </ul>
            </section>
          )}

          <section className={`clBloque${recuperaciones.length ? " clBloqueRecup" : ""}`} aria-labelledby="cl-recup">
            <h2 id="cl-recup"><IcRefresh size={20} /> Recuperaciones</h2>
            {recuperaciones.length ? (
              <>
                <ul className="clLista">
                  {recuperaciones.map((r) => (
                    <li className="clRecup" key={r.id}>
                      <strong>{motivoTexto(r.motivo)}</strong>
                      <span>Clase del {fechaLarga(r.fecha_original, { capital: false }) || "día pendiente"}</span>
                      <em className={`clPildora ${r.fecha_recuperacion ? "clPildoraLima" : "clPildoraAmbar"}`}>
                        {r.fecha_recuperacion ? `Recuperas el ${fechaLarga(r.fecha_recuperacion, { capital: false })}` : estadoTexto(r.estado, "Pendiente")}
                      </em>
                    </li>
                  ))}
                </ul>
                {sinFecha > 0 && (
                  <a href={PEDIR_FECHA} className="clBtnOscuro clBtnAncho" target="_blank" rel="noopener noreferrer">Pedir fecha por WhatsApp</a>
                )}
              </>
            ) : (
              <p className="clPositivo"><IcCheck size={20} /> No tienes clases pendientes de recuperar.</p>
            )}
          </section>

          <section className="clBloque" aria-labelledby="cl-asis">
            <h2 id="cl-asis"><IcCheck size={20} /> Asistencia reciente</h2>
            {asistenciaReciente.length ? (
              <ul className="clLista">
                {asistenciaReciente.map((a) => {
                  const ok = a.estado === "presente";
                  const falta = a.estado === "falta";
                  return (
                    <li className="clAsis" key={a.id}>
                      <span className={`clAsisIcono${ok ? " ok" : falta ? " falta" : ""}`}>{ok ? <IcCheck size={18} /> : falta ? <IcCross size={18} /> : <IcClock size={18} />}</span>
                      <div>
                        <strong>{fechaClase(a.fecha)}</strong>
                        <span>{a.grupo || "Clase"}</span>
                      </div>
                      <em className={`clPildora ${ok ? "clPildoraLima" : falta ? "clPildoraRoja" : ""}`}>{estadoTexto(a.estado, "Sin pasar lista")}</em>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="clVacioLinea">Aún no hay clases con asistencia anotada.</p>
            )}
          </section>
        </div>
      </div>

      <section className="clAyuda">
        <div>
          <h2>¿Necesitas cambiar algo?</h2>
          <p>Para cambios de grupo, recuperaciones o dudas de horario, escríbenos o llámanos.</p>
        </div>
        <ContactoClub mensaje="Hola, tengo una duda sobre mis clases de pádel" />
      </section>
    </section>
  );
}
