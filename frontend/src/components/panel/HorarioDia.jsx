import { useMemo, useState } from "react";
import { DIAS_SEMANA, diaHoy, diasDelGrupo, formatFecha, formatHorario, grupoActivo, minutosDe, nivelClass, nivelLabel, nombreCompleto, nombreGrupo, nombrePista, plural, ultimaFechaDelDia } from "./panelUtils";

const DIAS_CON_CLASE = DIAS_SEMANA.filter((item) => item.key !== "D");

function alumnosDelDia(grupo, dia) {
  return (grupo?.alumnos || []).filter((alumno) => (
    (grupo.dia1 === dia && Number(alumno.asiste_dia1 ?? 1) === 1) ||
    (grupo.dia2 === dia && Number(alumno.asiste_dia2 ?? 1) === 1)
  ));
}

// Horario por días: se abre en el día de hoy y enseña las clases ordenadas por hora.
export default function HorarioDia({ grupos, onPasarLista, onVerGrupo }) {
  const hoy = diaHoy();
  const [dia, setDia] = useState(DIAS_CON_CLASE.some((item) => item.key === hoy) ? hoy : "L");

  const porDia = useMemo(() => {
    const mapa = Object.fromEntries(DIAS_CON_CLASE.map((item) => [item.key, []]));
    grupos.filter(grupoActivo).forEach((grupo) => {
      diasDelGrupo(grupo).forEach((code) => { if (mapa[code]) mapa[code].push(grupo); });
    });
    Object.values(mapa).forEach((lista) => lista.sort((a, b) => (minutosDe(a.hora_inicio) ?? 0) - (minutosDe(b.hora_inicio) ?? 0)));
    return mapa;
  }, [grupos]);

  const clases = porDia[dia] || [];
  const fechaLista = ultimaFechaDelDia(dia);

  return (
    <section className="ppSection" aria-labelledby="pp-horario-title">
      <div className="ppSectionHead">
        <h2 id="pp-horario-title">Horario</h2>
        <p>Elige un día para ver sus clases por orden de hora.</p>
      </div>

      <div className="ppDayPicker" role="group" aria-label="Día de la semana">
        {DIAS_CON_CLASE.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={dia === item.key}
            aria-label={`${item.label}${item.key === hoy ? " (hoy)" : ""}: ${plural(porDia[item.key].length, "clase")}`}
            onClick={() => setDia(item.key)}
          >
            <span>{item.corto}</span>
            <small>{item.key === hoy ? "Hoy" : porDia[item.key].length || "–"}</small>
          </button>
        ))}
      </div>

      {clases.length === 0 ? (
        <p className="ppEmpty">El {DIAS_SEMANA.find((item) => item.key === dia)?.label.toLowerCase()} no hay clases.</p>
      ) : (
        <ul className="ppScheduleList">
          {clases.map((grupo) => {
            const alumnos = alumnosDelDia(grupo, dia);
            return (
              <li className="ppScheduleItem" key={grupo.id}>
                <div className="ppScheduleTime">{formatHorario(grupo.hora_inicio, grupo.duracion_min)}</div>
                <div className="ppScheduleBody">
                  <strong>{nombreGrupo(grupo)}</strong>
                  <span className="ppMetaLine">
                    {grupo.nivel && <span className={nivelClass(grupo.nivel)}>{nivelLabel(grupo.nivel)}</span>}
                    <span>{nombrePista(grupo.pista_habitual)}</span>
                    <span>{grupo.profesor || "Sin profesor"}</span>
                  </span>
                  <span className="ppScheduleStudents">
                    {alumnos.length ? `${plural(alumnos.length, "alumno")}: ${alumnos.map((alumno) => nombreCompleto(alumno).split(" ")[0]).join(", ")}` : "Sin alumnos este día"}
                  </span>
                </div>
                <div className="ppScheduleActions">
                  <button type="button" className="ppBtn ppBtnPrimary" onClick={() => onPasarLista(grupo, fechaLista)}>
                    Pasar lista{dia === hoy ? "" : ` del ${formatFecha(fechaLista)}`}
                  </button>
                  <button type="button" className="ppBtn" onClick={() => onVerGrupo(grupo)}>Ver grupo</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
