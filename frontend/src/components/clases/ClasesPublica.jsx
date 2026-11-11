import "./clasesPagina.css";
import { Link } from "react-router-dom";
import { buildClubWhatsappUrl } from "../../services/whatsappLinks";
import EncuentraGrupoForm from "../EncuentraGrupoForm";
import { IcArrow, IcBall, IcCalendar, IcCheck, IcClock, IcRepeat, IcSpark, IcTarget, IcCourt } from "./clasesComun";

const CONTACT_HREF = buildClubWhatsappUrl("Hola, quiero información sobre clases de pádel");

// "paso" es la posición en la escala de menos a más (0 = sin escala).
const NIVELES = [
  { clave: "ninos", titulo: "Niños", tag: "Para los peques", text: "Aprender jugando: juegos, técnica básica y hábitos de pista.", paso: 0 },
  { clave: "iniciacion", titulo: "Iniciación", text: "Empiezas desde cero o quieres ganar confianza con los golpes básicos.", paso: 1 },
  { clave: "medio", titulo: "Medio", text: "Ya pelotea y busca colocar mejor y decidir con más acierto.", paso: 2 },
  { clave: "avanzado", titulo: "Avanzado", text: "Ritmo alto, patrones tácticos y trabajo específico.", paso: 3 },
  { clave: "competicion", titulo: "Competición", text: "Entrenamientos exigentes para preparar partidos y torneos.", paso: 4 },
];

const FORMATOS = [
  { title: "Grupos 1 día/semana", text: "Para mantener el ritmo y mejorar poco a poco.", icon: <IcCalendar size={22} /> },
  { title: "Grupos 2 días/semana", text: "La opción más completa para progresar.", icon: <IcRepeat /> },
  { title: "Clases particulares", text: "Entrenamiento a medida para objetivos concretos.", icon: <IcTarget /> },
  { title: "Tecnificación", text: "Golpes, táctica y situaciones reales de partido.", icon: <IcCourt size={22} /> },
  { title: "Intensivos", text: "Sesiones puntuales para avanzar en una época concreta.", icon: <IcSpark /> },
];

const METODO = [
  "Grupos organizados por nivel, con alumnos de ritmo parecido.",
  "Seguimiento del progreso: sabrás qué trabajas y qué reforzar.",
  "Avisos y comunicación con el profesor desde tu zona de alumno.",
  "Entrenamientos adaptados a cada grupo: técnica, táctica y partido.",
];

const PRECIOS = [
  ["Clases en grupo", "Consultar cuota según días y grupo"],
  ["Clases particulares", "Consultar disponibilidad"],
  ["Intensivos", "Según temporada"],
  ["Tecnificación", "Consultar plazas"],
];

const HORARIOS = [
  "La mayoría de grupos son de tarde, entre semana.",
  "Grupos por nivel para niños y adultos.",
  "Puede haber intensivos en épocas concretas.",
];

const PASOS = [
  "Cuéntanos quién juega y su nivel.",
  "Dinos qué días y horas os vienen mejor.",
  "Te llamamos con los grupos que encajan.",
];

function Escala({ paso }) {
  if (!paso) return <span className="clNivelTag">Para los peques</span>;
  return (
    <span className="clEscala" role="img" aria-label={`Nivel ${paso} de 4`}>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= paso ? "on" : ""} />)}
    </span>
  );
}

function Plegable({ titulo, resumen, children }) {
  return (
    <details className="clPlegable">
      <summary>
        <span>
          <strong>{titulo}</strong>
          <small>{resumen}</small>
        </span>
        <i className="clMas" aria-hidden="true" />
      </summary>
      <div className="clPlegableCuerpo">{children}</div>
    </details>
  );
}

export default function ClasesPublica({ notice }) {
  return (
    <section className="clases clPag clPublica">
      <header className="clHero">
        <div className="clHeroTexto">
          <span className="clEyebrow">Escuela NaniPadel</span>
          <h1>Clases de pádel para todos los niveles</h1>
          <p>Grupos reducidos para niños y adultos. Dinos cómo juegas y te buscamos el horario que mejor encaje.</p>
          <div className="clHeroAcciones">
            <a href="#encuentra-grupo" className="clBtnLima">Encontrar mi grupo <IcArrow size={18} /></a>
            <Link to="/login" className="clBtnClaro">Ya soy alumno: entrar</Link>
          </div>
        </div>
        <svg className="clHeroPista" viewBox="0 0 200 260" aria-hidden="true">
          <rect x="10" y="10" width="180" height="240" rx="10" />
          <line x1="10" y1="130" x2="190" y2="130" />
          <line x1="100" y1="130" x2="100" y2="250" />
          <line x1="10" y1="62" x2="190" y2="62" />
          <line x1="10" y1="198" x2="190" y2="198" />
          <circle cx="146" cy="96" r="9" className="clHeroBola" />
        </svg>
      </header>

      {notice && (
        <div className="clAviso" role="status">
          <strong>Tu cuenta aún no está vinculada como alumno de la escuela.</strong>
          <p>{notice}</p>
          <a href={CONTACT_HREF} className="clBtnLima" target="_blank" rel="noopener noreferrer">Hablar con el club</a>
        </div>
      )}

      <div className="clEncuentra" id="encuentra-grupo">
        <aside className="clEncuentraLado">
          <span className="clEyebrow clEyebrowOscuro">Primer paso</span>
          <h2 id="encuentra-grupo-titulo">Encuentra tu grupo</h2>
          <ol>
            {PASOS.map((p, i) => <li key={p}><b>{i + 1}</b>{p}</li>)}
          </ol>
          <p className="clEncuentraNota"><IcClock size={16} /> Son 4 preguntas y casi todo se contesta con un toque.</p>
        </aside>
        <div className="clEncuentraForm encuentraGrupo" role="region" aria-labelledby="encuentra-grupo-titulo">
          <EncuentraGrupoForm />
        </div>
      </div>

      <section className="clSeccion" id="niveles" aria-labelledby="niveles-titulo">
        <div className="clSeccionCab">
          <h2 id="niveles-titulo">Entrenas con gente de tu nivel</h2>
          <p>Si no sabes dónde encajas, cuéntanoslo en el formulario y te orientamos.</p>
        </div>
        <ul className="clNiveles">
          {NIVELES.map((n, i) => (
            <li className="clNivel" data-nivel={n.clave} key={n.clave} style={{ "--i": i }}>
              <span className="clNivelIcono"><IcBall size={22} /></span>
              <div className="clNivelCuerpo">
                <div className="clNivelTop">
                  <h3>{n.titulo}</h3>
                  <Escala paso={n.paso} />
                </div>
                <p>{n.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="clSeccion" aria-labelledby="mas-titulo">
        <div className="clSeccionCab">
          <h2 id="mas-titulo">Más información</h2>
        </div>
        <div className="clPlegables">
          <Plegable titulo="Tipos de clase" resumen="Grupos, particulares, tecnificación e intensivos">
            <ul className="clFormatos">
              {FORMATOS.map((f) => (
                <li key={f.title}>
                  <span className="clFormatoIcono">{f.icon}</span>
                  <div><strong>{f.title}</strong><p>{f.text}</p></div>
                </li>
              ))}
            </ul>
          </Plegable>
          <Plegable titulo="Cómo trabajamos" resumen="Grupos por nivel, seguimiento y avisos">
            <ul className="clChecks">
              {METODO.map((m) => <li key={m}><IcCheck size={18} />{m}</li>)}
            </ul>
          </Plegable>
          <Plegable titulo="Precios y horarios" resumen="Te lo decimos según tu grupo">
            <dl className="clPrecios">
              {PRECIOS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
            </dl>
            <ul className="clChecks">
              {HORARIOS.map((h) => <li key={h}><IcClock size={18} />{h}</li>)}
            </ul>
            <p className="clNota">No publicamos precios cerrados: dependen de los días, el grupo y la disponibilidad de pista.</p>
          </Plegable>
        </div>
      </section>

      <section className="clAlumno">
        <div>
          <h2>¿Ya eres alumno?</h2>
          <p>Mira tu próxima clase, tus avisos y tus recuperaciones.</p>
        </div>
        <Link to="/login" className="clBtnOscuro">Entrar a mi zona <IcArrow size={18} /></Link>
      </section>
    </section>
  );
}
