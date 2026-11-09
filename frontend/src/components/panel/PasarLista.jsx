import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../services/api";
import CancelarClaseHoja from "./CancelarClaseHoja";
import { IcAviso, IcCheck, IcNota, IcX } from "./Iconos";
import { claseMasProxima, diaDeFecha, diasDelGrupo, formatDias, formatFecha, formatHorario, hora, hoyISO, iniciales, minutosDe, momentoClase, motivoCorto, nivelLabel, nombreCompleto, nombreGrupo, nombrePista, plural } from "./panelUtils";

const ASISTENCIA = [
  { key: "presente", label: "Vino", Icon: IcCheck },
  { key: "falta", label: "Faltó", Icon: IcX },
  { key: "justificada", label: "Justificada", Icon: IcNota },
];

function mensajeCarga(error) {
  const texto = String(error?.message || "");
  if (/vinculad/i.test(texto)) {
    return "Tu usuario todavía no está unido a tu ficha de profesor. Pide a la administración que lo vincule para poder pasar lista.";
  }
  return texto || "No hemos podido cargar las clases. Comprueba la conexión y vuelve a intentarlo.";
}

function capitalizar(texto) {
  return texto ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}` : texto;
}

function resumenAsistencia(cuenta) {
  const partes = [`${cuenta.presente} ${cuenta.presente === 1 ? "vino" : "vinieron"}`];
  if (cuenta.falta) partes.push(`${cuenta.falta} ${cuenta.falta === 1 ? "faltó" : "faltaron"}`);
  if (cuenta.justificada) partes.push(`${cuenta.justificada} ${cuenta.justificada === 1 ? "justificada" : "justificadas"}`);
  return partes.join(" · ");
}

export default function PasarLista({ isAdmin, profesores, peticion, listasHoy = {}, cancelacionesHoy = {}, onAviso, onGuardada }) {
  const [grupos, setGrupos] = useState([]);
  const [gruposCargando, setGruposCargando] = useState(true);
  const [gruposError, setGruposError] = useState("");
  const [profesorActualId, setProfesorActualId] = useState(null);
  const [grupoId, setGrupoId] = useState("");
  const [fecha, setFecha] = useState(hoyISO);
  const [recargar, setRecargar] = useState(0);

  const [sesion, setSesion] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [borrador, setBorrador] = useState({});
  const [estadoClase, setEstadoClase] = useState("dada");
  const [profesorSel, setProfesorSel] = useState("");
  const [notas, setNotas] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargaError, setCargaError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardarError, setGuardarError] = useState("");
  const [recienGuardada, setRecienGuardada] = useState(false);
  const [cambiarAbierto, setCambiarAbierto] = useState(false);
  const [hayAsistencia, setHayAsistencia] = useState(false);
  const [cancelarAbierto, setCancelarAbierto] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelarError, setCancelarError] = useState("");
  const [reabriendo, setReabriendo] = useState(false);
  const [reabrirError, setReabrirError] = useState("");
  const flashTimer = useRef(null);
  const peticionAplicada = useRef(null);
  const tiraRef = useRef(null);

  // Grupos que se pueden pasar lista (todos los del curso; el profesor también ve los ajenos para sustituciones).
  useEffect(() => {
    let cancelado = false;
    setGruposCargando(true);
    setGruposError("");
    apiGet("/api/gestion/control/grupos")
      .then((data) => {
        if (cancelado) return;
        setGrupos(data.grupos || []);
        setProfesorActualId(data.profesor_actual_id ?? null);
      })
      .catch((e) => { if (!cancelado) setGruposError(mensajeCarga(e)); })
      .finally(() => { if (!cancelado) setGruposCargando(false); });
    return () => { cancelado = true; };
  }, [recargar]);

  // Grupo inicial: el que se pide (atajo de la portada u otra sección) o la clase de hoy más próxima a esta hora.
  useEffect(() => {
    if (!grupos.length) return;
    if (peticion && peticionAplicada.current !== peticion.n) {
      peticionAplicada.current = peticion.n;
      if (peticion.grupoId && grupos.some((item) => String(item.id) === String(peticion.grupoId))) {
        setGrupoId(String(peticion.grupoId));
        setFecha(peticion.fecha || hoyISO());
        setCambiarAbierto(false);
        return;
      }
    }
    setGrupoId((actual) => {
      if (actual && grupos.some((item) => String(item.id) === String(actual))) return actual;
      const proxima = claseMasProxima(grupos, { profesorId: isAdmin ? null : profesorActualId, hechas: listasHoy });
      if (!proxima) setCambiarAbierto(true);
      return String((proxima || grupos[0]).id);
    });
  }, [grupos, peticion, profesorActualId, isAdmin, listasHoy]);

  const grupo = useMemo(() => grupos.find((item) => String(item.id) === String(grupoId)) || null, [grupos, grupoId]);
  const dia = diaDeFecha(fecha);
  const hayClase = Boolean(grupo && dia && diasDelGrupo(grupo).includes(dia));
  const hoy = hoyISO();
  const esFutura = fecha > hoy;

  const clasesDeHoy = useMemo(() => {
    const code = diaDeFecha(hoy);
    return grupos
      .filter((item) => diasDelGrupo(item).includes(code))
      .sort((a, b) => (minutosDe(a.hora_inicio) ?? 0) - (minutosDe(b.hora_inicio) ?? 0));
  }, [grupos, hoy]);

  const gruposOrdenados = useMemo(
    () => [...grupos].sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")),
    [grupos]
  );

  useEffect(() => {
    if (!grupo?.id || !hayClase) {
      setSesion(null);
      setHayAsistencia(false);
      setAlumnos([]);
      setBorrador({});
      setCargaError("");
      return undefined;
    }
    let cancelado = false;
    setCargando(true);
    setCargaError("");
    setGuardarError("");
    setRecienGuardada(false);
    apiGet(`/api/gestion/control/grupos/${grupo.id}/sesiones?fecha=${encodeURIComponent(fecha)}`)
      .then((data) => {
        if (cancelado) return;
        const actual = data.sesiones?.[0] || null;
        setSesion(actual);
        setHayAsistencia(Boolean(data.asistencias?.length));
        setReabrirError("");
        setAlumnos(data.alumnos || []);
        setBorrador(Object.fromEntries((data.asistencias || []).map((item) => [item.alumno_id, item.estado])));
        // Hoy o antes: la clase se da por dada salvo que se cambie. Así la falta justificada crea su recuperación.
        setEstadoClase(fecha <= hoyISO() ? "dada" : actual?.estado || "programada");
        const porDefecto = isAdmin ? grupo.profesor_id : data.profesor_actual_id;
        setProfesorSel(String(actual?.profesor_id ?? porDefecto ?? ""));
        setNotas(actual?.observaciones || "");
      })
      .catch((e) => { if (!cancelado) setCargaError(mensajeCarga(e)); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [grupo, fecha, hayClase, isAdmin, recargar]);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // La clase elegida queda a la vista dentro de la tira de clases de hoy.
  useEffect(() => {
    const tira = tiraRef.current;
    const activa = tira?.querySelector('[aria-pressed="true"]');
    if (!tira || !activa) return;
    const izquierda = activa.offsetLeft - tira.offsetLeft - 12;
    if (izquierda < tira.scrollLeft || izquierda + activa.offsetWidth > tira.scrollLeft + tira.clientWidth) tira.scrollTo({ left: Math.max(0, izquierda) });
  }, [grupoId, fecha, clasesDeHoy.length]);

  const cuenta = useMemo(() => {
    const total = { presente: 0, falta: 0, justificada: 0 };
    alumnos.forEach((alumno) => { total[borrador[alumno.id] || "presente"] += 1; });
    return total;
  }, [alumnos, borrador]);

  const marcar = (alumnoId, estado) => {
    setBorrador((actual) => ({ ...actual, [alumnoId]: estado }));
    setRecienGuardada(false);
  };

  const todosVinieron = () => {
    setBorrador(Object.fromEntries(alumnos.map((alumno) => [alumno.id, "presente"])));
    setRecienGuardada(false);
  };

  const nombreProfesor = (id) => profesores.find((item) => String(item.id) === String(id))?.name || "";
  const profesorTexto = nombreProfesor(profesorSel) || grupo?.profesor || "sin profesor";

  const guardar = async () => {
    if (!grupo || !hayClase || cargando || guardando) return;
    const body = {
      fecha,
      estado: estadoClase,
      observaciones: notas,
      asistencias: alumnos.map((alumno) => ({ alumno_id: alumno.id, estado: borrador[alumno.id] || "presente" })),
    };
    if (profesorSel) body.profesor_id = Number(profesorSel);
    else if (isAdmin && sesion?.profesor_id) body.profesor_id = null;

    try {
      setGuardando(true);
      setGuardarError("");
      const ruta = `/api/gestion/control/grupos/${grupo.id}/sesiones`;
      const data = sesion ? await apiPut(`${ruta}/${sesion.id}/asistencia`, body) : await apiPost(ruta, body);
      setSesion(data.sesion || null);
      setHayAsistencia(true);
      if (data.alumnos) setAlumnos(data.alumnos);
      if (data.asistencias) setBorrador(Object.fromEntries(data.asistencias.map((item) => [item.alumno_id, item.estado])));
      if (data.sesion?.profesor_id != null) setProfesorSel(String(data.sesion.profesor_id));
      setRecienGuardada(true);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setRecienGuardada(false), 2500);
      const extra = estadoClase === "dada" && cuenta.justificada
        ? ` ${plural(cuenta.justificada, "falta justificada", "faltas justificadas")} ${cuenta.justificada === 1 ? "queda" : "quedan"} para recuperar.`
        : "";
      onAviso?.(`Lista guardada: ${resumenAsistencia(cuenta)}.${extra}`);
      onGuardada?.();
    } catch (e) {
      setGuardarError(`${e.message || "No se ha podido guardar."} Tus marcas siguen aquí: pulsa otra vez para reintentar.`);
    } finally {
      setGuardando(false);
    }
  };

  const cancelada = sesion?.estado === "cancelada";
  const cancelacion = cancelada ? sesion.cancelacion || { motivo: "otro", texto: "" } : null;

  const cancelarClase = async ({ motivo, texto, recuperable }) => {
    if (!grupo || cancelando) return;
    try {
      setCancelando(true);
      setCancelarError("");
      const data = await apiPost(`/api/gestion/control/grupos/${grupo.id}/sesiones/cancelar`, { fecha, motivo, texto, recuperable });
      setSesion(data.sesion || null);
      setCancelarAbierto(false);
      const creadas = Number(data.recuperaciones_creadas || 0);
      onAviso?.(creadas
        ? `Clase cancelada. ${plural(creadas, "alumno puede", "alumnos pueden")} recuperarla.`
        : "Clase cancelada.");
      onGuardada?.();
    } catch (e) {
      setCancelarError(`${e.message || "No se ha podido cancelar la clase."} No se ha cancelado nada: puedes volver a intentarlo.`);
    } finally {
      setCancelando(false);
    }
  };

  const reabrirClase = async () => {
    if (!grupo || reabriendo) return;
    try {
      setReabriendo(true);
      setReabrirError("");
      const data = await apiPost(`/api/gestion/control/grupos/${grupo.id}/sesiones/reabrir`, { fecha });
      setSesion(data.sesion || null);
      setEstadoClase(fecha <= hoyISO() ? "dada" : "programada");
      setNotas("");
      onAviso?.("Clase reabierta. Ya puedes pasar lista.");
      onGuardada?.();
    } catch (e) {
      setReabrirError(`${e.message || "No se ha podido reabrir la clase."} Puedes volver a intentarlo.`);
    } finally {
      setReabriendo(false);
    }
  };

  const fechaTexto = capitalizar(formatFecha(fecha));
  const muestraLista = hayClase && !cargando && !cargaError;
  const puedeCancelar = muestraLista && !cancelada;

  return (
    <section className="ppSection ppRollSection" id="panel-control" aria-labelledby="pp-control-title">
      <div className="ppSectionHead">
        <h2 id="pp-control-title">Pasar lista</h2>
      </div>

      {gruposCargando && <p className="ppEmpty">Cargando clases...</p>}
      {gruposError && (
        <div className="ppInlineError" role="alert">
          <span>{gruposError}</span>
          <button type="button" className="ppBtn" onClick={() => setRecargar((n) => n + 1)}>Reintentar</button>
        </div>
      )}

      {!gruposCargando && !gruposError && grupos.length === 0 && (
        <p className="ppEmpty">No hay grupos activos en este curso.</p>
      )}

      {grupo && (
        <>
          {clasesDeHoy.length > 0 && (
            <div className="ppTodayStrip" ref={tiraRef} role="group" aria-label={`Clases de hoy, ${formatFecha(hoy)}`}>
              {clasesDeHoy.map((item) => {
                const activa = String(item.id) === String(grupo.id) && fecha === hoy;
                const canceladaHoy = activa ? cancelada : Boolean(cancelacionesHoy[item.id]);
                const motivoHoy = activa ? motivoCorto(cancelacion) : cancelacionesHoy[item.id];
                const hecha = !canceladaHoy && (listasHoy[item.id] === "guardada" || (activa && hayAsistencia));
                const momento = momentoClase(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="ppTodayCard"
                    data-momento={momento}
                    data-hecha={hecha ? "true" : "false"}
                    data-cancelada={canceladaHoy ? "true" : "false"}
                    aria-pressed={activa}
                    onClick={() => { setGrupoId(String(item.id)); setFecha(hoy); setCambiarAbierto(false); }}
                  >
                    <span className="ppTodayCardTime">{hora(item.hora_inicio)}</span>
                    <span className="ppTodayCardName">{nombreGrupo(item)}</span>
                    <span className="ppTodayCardState">
                      {canceladaHoy ? <span className="ppBadgeCancel">Cancelada · {motivoHoy}</span> : hecha ? <><IcCheck /> Lista pasada</> : momento === "ahora" ? "Ahora" : momento === "pasada" ? "Sin lista" : "Más tarde"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="ppClassBar">
            <div className="ppClassBarText">
              <strong>{nombreGrupo(grupo)}</strong>
              <span>{fechaTexto} · {formatHorario(grupo.hora_inicio, grupo.duracion_min)} · {nombrePista(grupo.pista_habitual)}</span>
              <span>Da la clase: {profesorTexto}</span>
            </div>
            <div className="ppClassBarActions">
              <button type="button" className="ppBtn ppBtnSmall" aria-expanded={cambiarAbierto} aria-controls="pp-cambiar-clase" onClick={() => setCambiarAbierto((v) => !v)}>
                {cambiarAbierto ? "Listo" : "Cambiar"}
              </button>
              {puedeCancelar && (
                <button type="button" className="ppBtn ppBtnSmall ppBtnDangerQuiet" onClick={() => { setCancelarError(""); setCancelarAbierto(true); }}>
                  Cancelar la clase
                </button>
              )}
            </div>
          </div>

          {cambiarAbierto && (
            <div className="ppChangeClass" id="pp-cambiar-clase">
              <label className="ppField">
                <span>Grupo</span>
                <select value={grupo.id} onChange={(e) => setGrupoId(e.target.value)}>
                  {gruposOrdenados.map((item) => (
                    <option key={item.id} value={item.id}>{nombreGrupo(item)} ({formatDias(item.dia1, item.dia2)}, {hora(item.hora_inicio)})</option>
                  ))}
                </select>
              </label>
              <label className="ppField">
                <span>Día de la clase</span>
                <input type="date" value={fecha} max="2099-12-31" onChange={(e) => setFecha(e.target.value || hoy)} />
              </label>
              {fecha !== hoy && <button type="button" className="ppBtn" onClick={() => setFecha(hoy)}>Volver a hoy</button>}
            </div>
          )}

          {!hayClase && (
            <p className="ppEmpty">
              {nombreGrupo(grupo)} no tiene clase el {formatFecha(fecha)}. Tiene clase los {formatDias(grupo.dia1, grupo.dia2).toLowerCase()}.
              {clasesDeHoy.length === 0 && fecha === hoy ? " Hoy no hay ninguna clase." : ""}
            </p>
          )}
          {hayClase && cargando && <p className="ppEmpty">Cargando la lista...</p>}
          {hayClase && cargaError && (
            <div className="ppInlineError" role="alert">
              <span>{cargaError}</span>
              <button type="button" className="ppBtn" onClick={() => setRecargar((n) => n + 1)}>Reintentar</button>
            </div>
          )}

          {muestraLista && cancelada && (
            <div className="ppCancelBanner" role="status">
              <span className="ppBadgeCancel ppBadgeCancelBig"><IcAviso /> Cancelada · {motivoCorto(cancelacion)}</span>
              <p>
                Esta clase está cancelada, así que no hay lista que pasar. Si fue un error, puedes reabrirla.
                {" "}Al reabrir se retiran las recuperaciones que aún no tengan fecha.
              </p>
              {reabrirError && <p className="ppInlineError" role="alert">{reabrirError}</p>}
              <button type="button" className="ppBtn ppBtnPrimary" onClick={reabrirClase} disabled={reabriendo}>
                {reabriendo ? "Reabriendo..." : "Reabrir la clase"}
              </button>
            </div>
          )}

          {muestraLista && !cancelada && alumnos.length === 0 && <p className="ppEmpty">Este día no hay alumnos apuntados en el grupo.</p>}

          {muestraLista && !cancelada && alumnos.length > 0 && (
            <>
              <p className="ppHint">
                {hayAsistencia
                  ? "Lista ya guardada: puedes corregirla."
                  : "Todos aparecen como que vinieron. Toca solo a quien faltó."}
                {" "}
                {esFutura
                  ? "Este día aún no ha llegado."
                  : estadoClase === "dada"
                    ? "Las faltas justificadas quedan para recuperar."
                    : "La clase no se da por dada: no se apuntan recuperaciones."}
              </p>

              <ul className="ppRoll">
                {alumnos.map((alumno) => {
                  const actual = borrador[alumno.id] || "presente";
                  const nombre = nombreCompleto(alumno);
                  return (
                    <li className="ppRollRow" data-estado={actual} key={alumno.id}>
                      <div className="ppPerson">
                        <span className="ppAvatar" aria-hidden="true">{iniciales(alumno)}</span>
                        <span className="ppPersonText">
                          <strong>{nombre}</strong>
                          {alumno.nivel && <small>{nivelLabel(alumno.nivel)}</small>}
                        </span>
                      </div>
                      <div className="ppSegmented" role="group" aria-label={`Asistencia de ${nombre}`}>
                        {ASISTENCIA.map(({ key, label, Icon }) => (
                          <button
                            key={key}
                            type="button"
                            className="ppSegment"
                            data-tone={key}
                            aria-pressed={actual === key}
                            onClick={() => marcar(alumno.id, key)}
                          >
                            <Icon />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {(cuenta.falta > 0 || cuenta.justificada > 0) && (
                <button type="button" className="ppBtn ppBtnGhost" onClick={todosVinieron}>Marcar que vinieron todos</button>
              )}

              <details className="ppMore" open={Boolean(sesion?.observaciones) || undefined}>
                <summary>Más opciones: quién da la clase, notas y si se dio</summary>
                <div className="ppMoreBody">
                  <label className="ppField">
                    <span>Da la clase</span>
                    <select value={profesorSel} onChange={(e) => setProfesorSel(e.target.value)}>
                      <option value="">{isAdmin ? "Sin profesor" : "Yo"}</option>
                      {profesores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="ppField">
                    <span>Notas de la clase (opcional)</span>
                    <textarea value={notas} rows={3} onChange={(e) => setNotas(e.target.value)} placeholder="Por ejemplo: trabajamos la volea" />
                  </label>
                  <fieldset className="ppRadioGroup">
                    <legend>¿Se dio la clase?</legend>
                    <label>
                      <input type="radio" name="pp-estado-clase" checked={estadoClase === "dada"} onChange={() => setEstadoClase("dada")} />
                      <span>Sí, se dio</span>
                    </label>
                    <label>
                      <input type="radio" name="pp-estado-clase" checked={estadoClase === "programada"} onChange={() => setEstadoClase("programada")} />
                      <span>No, todavía no (no se apuntan recuperaciones)</span>
                    </label>
                  </fieldset>
                </div>
              </details>

              <div className="ppSaveBar">
                <p className="ppSaveSummary">
                  <strong>{resumenAsistencia(cuenta)}</strong>
                  {estadoClase === "dada" && cuenta.justificada > 0 && (
                    <span>{plural(cuenta.justificada, "clase", "clases")} para recuperar</span>
                  )}
                </p>
                {guardarError && <p className="ppInlineError ppSaveError" role="alert">{guardarError}</p>}
                <button type="button" className="ppBtn ppBtnPrimary ppSaveBtn" data-done={recienGuardada ? "true" : "false"} onClick={guardar} disabled={guardando}>
                  {guardando ? "Guardando..." : recienGuardada ? <><IcCheck /> Lista guardada</> : guardarError ? "Reintentar" : hayAsistencia ? "Guardar cambios" : "Guardar lista"}
                </button>
              </div>
            </>
          )}
        </>
      )}
      <CancelarClaseHoja
        abierto={cancelarAbierto}
        grupoNombre={grupo ? nombreGrupo(grupo) : ""}
        fechaTexto={formatFecha(fecha)}
        ocupado={cancelando}
        error={cancelarError}
        onConfirmar={cancelarClase}
        onCancelar={() => setCancelarAbierto(false)}
      />
    </section>
  );
}
