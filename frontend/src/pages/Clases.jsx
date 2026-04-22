import "./clases.css";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../services/api";
import { isLogged, getToken } from "../services/auth";

const API_BASE = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, "")
  : "";

function formatDias(d1, d2) {
  const map = {
    L: "Lunes", M: "Martes", X: "Miércoles",
    J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo",
  };
  if (!d2) return map[d1] || d1;
  return `${map[d1] || d1} y ${map[d2] || d2}`;
}

function formatHora(horaInicio, duracionMin) {
  if (!horaInicio) return "—";
  const [hh, mm] = String(horaInicio).split(":");
  const start = new Date();
  start.setHours(Number(hh), Number(mm), 0, 0);
  const end = new Date(start.getTime() + Number(duracionMin || 60) * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

function nivelLabel(nivel) {
  const map = {
    ninos: "Niños", iniciacion: "Iniciación", avanzado: "Avanzado",
    competicion: "Competición", avanzado_plus: "Avanzado +",
  };
  return map[nivel] || nivel || "—";
}

function nivelBadgeClass(nivel) {
  const map = {
    ninos: "badgeKids", iniciacion: "badgeInit", avanzado: "badgeAdv",
    competicion: "badgeComp", avanzado_plus: "badgePlus",
  };
  return map[nivel] || "badgeDefault";
}

export default function Clases() {
  const [grupos, setGrupos] = useState([]);
  const [misClases, setMisClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [nivel, setNivel] = useState("");
  const [dia, setDia] = useState("");
  const [profesor, setProfesor] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr("");

        const data = await apiGet("/api/grupos");
        if (!data.ok) throw new Error(data.message || "No se pudieron cargar las clases");
        setGrupos(data.grupos || []);

        // Si está logueado, cargar sus clases
        if (isLogged()) {
          try {
            const res = await fetch(`${API_BASE}/api/clases/mis-clases`, {
              headers: { Authorization: `Bearer ${getToken()}` },
            });
            const misData = await res.json();
            if (misData.ok) setMisClases(misData.clases || []);
          } catch {
            // Si falla, no pasa nada, simplemente no muestra "mis clases"
          }
        }
      } catch (e) {
        setErr(e.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const profesores = useMemo(() => {
    const map = new Map();
    grupos.forEach((g) => map.set(String(g.profesor_id), g.profesor));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [grupos]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return grupos.filter((g) => {
      const matchText = !text ||
        `${g.nombre} ${g.codigo} ${g.profesor} ${g.pista_habitual || ""}`.toLowerCase().includes(text);
      const matchNivel = !nivel || g.nivel === nivel;
      const matchDia = !dia || g.dia1 === dia || g.dia2 === dia;
      const matchProfesor = !profesor || String(g.profesor_id) === String(profesor);
      return matchText && matchNivel && matchDia && matchProfesor;
    });
  }, [grupos, q, nivel, dia, profesor]);

  return (
    <section className="clases">
      <div className="clasesHeader">
        <div>
          <h2>Clases</h2>
          <p className="intro">
            {isLogged()
              ? "Consulta tus clases y explora todos los grupos disponibles."
              : "Descubre los grupos y horarios de nuestra escuela de pádel."}
          </p>
        </div>

        <div className="clasesStats">
          <div className="statPill">
            <strong>{filtered.length}</strong>
            <span>grupos</span>
          </div>
          <div className="statPill">
            <strong>{grupos.length}</strong>
            <span>totales</span>
          </div>
        </div>
      </div>

      {/* Mis clases (solo si logueado y tiene clases) */}
      {isLogged() && misClases.length > 0 && (
        <div className="misClasesSection">
          <h3 className="misClasesTitle">Mis clases</h3>
          <div className="misClasesGrid">
            {misClases.map((c) => (
              <div className="miClaseCard" key={c.id}>
                <div className="miClaseTop">
                  <span className={`badge ${nivelBadgeClass(c.nivel)}`}>
                    {nivelLabel(c.nivel)}
                  </span>
                  <span className="codeTag">{c.codigo}</span>
                </div>
                <h4 className="miClaseNombre">{c.nombre}</h4>
                <div className="miClaseInfo">
                  <span>{formatDias(c.dia1, c.dia2)}</span>
                  <span>{formatHora(c.hora_inicio, c.duracion_min)}</span>
                </div>
                <div className="miClaseInfo">
                  <span>Pista: {c.pista_habitual || "—"}</span>
                  <span>Profe: {c.profesor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLogged() && misClases.length === 0 && !loading && (
        <div className="misClasesEmpty">
          No tienes clases asignadas todavía. Contacta con la escuela para apuntarte a un grupo.
        </div>
      )}

      {/* Separador */}
      <h3 className="seccionTitulo">Todos los grupos</h3>

      {/* Filtros */}
      <div className="filtersBar">
        <input
          className="searchInput"
          type="text"
          placeholder="Buscar (grupo, profe, pista, código...)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className="select" value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="">Nivel (todos)</option>
          <option value="ninos">Niños</option>
          <option value="iniciacion">Iniciación</option>
          <option value="avanzado">Avanzado</option>
          <option value="avanzado_plus">Avanzado +</option>
          <option value="competicion">Competición</option>
        </select>

        <select className="select" value={dia} onChange={(e) => setDia(e.target.value)}>
          <option value="">Día (todos)</option>
          <option value="L">Lunes</option>
          <option value="M">Martes</option>
          <option value="X">Miércoles</option>
          <option value="J">Jueves</option>
          <option value="V">Viernes</option>
          <option value="S">Sábado</option>
          <option value="D">Domingo</option>
        </select>

        <select className="select" value={profesor} onChange={(e) => setProfesor(e.target.value)}>
          <option value="">Profesor (todos)</option>
          {profesores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          className="btnClear"
          onClick={() => { setQ(""); setNivel(""); setDia(""); setProfesor(""); }}
        >
          Limpiar
        </button>
      </div>

      {/* Estados */}
      {loading && (
        <div className="skeletonGrid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeletonCard" key={i} />
          ))}
        </div>
      )}

      {!loading && err && <p className="errorBox">❌ {err}</p>}

      {!loading && !err && filtered.length === 0 && (
        <div className="emptyBox">
          <strong>No hay resultados</strong>
          <p>Prueba a quitar filtros o buscar por "pista 1", "Juanjo", "competición"…</p>
        </div>
      )}

      {!loading && !err && filtered.length > 0 && (
        <div className="listaClases">
          {filtered.map((g) => {
            const cupo = Number(g.cupo || 0);
            const alumnos = Number(g.alumnos || 0);
            const ocupacion = cupo ? Math.round((alumnos / cupo) * 100) : 0;
            const ocupacionClass = ocupacion >= 90 ? "occHigh" : ocupacion >= 60 ? "occMid" : "occLow";

            return (
              <article className="claseCard" key={g.id}>
                <div className="cardTop">
                  <span className={`badge ${nivelBadgeClass(g.nivel)}`}>
                    {nivelLabel(g.nivel)}
                  </span>
                  <span className="codeTag">{g.codigo}</span>
                </div>

                <h3 className="cardTitle">{g.nombre}</h3>

                <div className="metaGrid">
                  <div className="metaItem">
                    <span className="metaLabel">Días</span>
                    <span className="metaValue">{formatDias(g.dia1, g.dia2)}</span>
                  </div>
                  <div className="metaItem">
                    <span className="metaLabel">Hora</span>
                    <span className="metaValue">{formatHora(g.hora_inicio, g.duracion_min)}</span>
                  </div>
                  <div className="metaItem">
                    <span className="metaLabel">Pista</span>
                    <span className="metaValue">{g.pista_habitual || "—"}</span>
                  </div>
                  <div className="metaItem">
                    <span className="metaLabel">Profesor</span>
                    <span className="metaValue">{g.profesor || "—"}</span>
                  </div>
                </div>

                <div className="cardBottom">
                  <div className="occupancy">
                    <div className="occRow">
                      <span>Alumnos</span>
                      <strong>{alumnos}/{cupo || "—"}</strong>
                    </div>
                    <div className={`occBar ${ocupacionClass}`}>
                      <span style={{ width: `${Math.min(100, ocupacion)}%` }} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}