import { Link } from "react-router-dom";
import CLUB from "../config/club";
import "./legal.css";

// Textos legales base. Son un BORRADOR genérico: hay que revisarlos con un profesional
// antes de publicar la web de forma oficial. Los datos salen de src/config/club.js.

const pendiente = (valor, texto) => String(valor || "").trim() || `[${texto} pendiente]`;

function datosTitular() {
  return {
    nombre: pendiente(CLUB.titular?.nombre, "Nombre o razón social"),
    nif: pendiente(CLUB.titular?.nif, "NIF/CIF"),
    domicilio: pendiente(CLUB.titular?.domicilio || CLUB.direccion, "Domicilio"),
    email: pendiente(CLUB.email, "Correo de contacto"),
  };
}

function AvisoLegal() {
  const t = datosTitular();
  return (
    <>
      <h2>1. Titular de la web</h2>
      <p>
        En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE),
        se informa de que esta web pertenece a:
      </p>
      <ul>
        <li>Titular: {t.nombre}</li>
        <li>NIF/CIF: {t.nif}</li>
        <li>Domicilio: {t.domicilio}</li>
        <li>Correo electrónico: {t.email}</li>
      </ul>
      <h2>2. Objeto</h2>
      <p>
        La web de {CLUB.nombre} informa sobre las clases, horarios, torneos y actividades de la escuela, y permite a sus
        alumnos y familias reservar pista, consultar sus clases y recibir avisos.
      </p>
      <h2>3. Uso de la web</h2>
      <p>
        Quien usa la web se compromete a hacerlo de forma correcta, sin dañar su funcionamiento ni usar datos de otras
        personas. Las cuentas son personales y cada usuario es responsable de guardar su contraseña.
      </p>
      <h2>4. Propiedad intelectual</h2>
      <p>
        Los textos, logotipos, fotografías y diseño de la web pertenecen a {CLUB.nombre} o se usan con permiso de sus
        autores. No se pueden copiar ni difundir sin autorización. Los titulares de noticias enlazan a la web de cada medio,
        que es el dueño de su contenido.
      </p>
      <h2>5. Enlaces a otras webs</h2>
      <p>
        La web incluye enlaces a otros sitios (medios de comunicación, WhatsApp, redes sociales, patrocinadores). {CLUB.nombre}{" "}
        no se hace responsable de su contenido ni de sus condiciones.
      </p>
      <h2>6. Responsabilidad</h2>
      <p>
        Se procura que la información esté actualizada, pero horarios, precios y disponibilidad pueden cambiar. En caso de
        duda, confirma siempre con el club.
      </p>
      <h2>7. Ley aplicable</h2>
      <p>Este aviso se rige por la legislación española.</p>
    </>
  );
}

function Privacidad() {
  const t = datosTitular();
  return (
    <>
      <h2>1. Responsable del tratamiento</h2>
      <p>
        {t.nombre} (NIF {t.nif}), con domicilio en {t.domicilio}. Contacto: {t.email}.
      </p>
      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>Datos de la cuenta: nombre, apellidos, correo electrónico y teléfono.</li>
        <li>Datos de la escuela: grupo, asistencia a clase, recuperaciones y reservas de pista.</li>
        <li>Datos de menores: solo los necesarios para las clases, facilitados por su madre, padre o tutor.</li>
        <li>Mensajes que nos envíes por WhatsApp.</li>
        <li>Fotografías de actividades del club, si se ha dado permiso para publicarlas.</li>
      </ul>
      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Gestionar las clases, las reservas de pista y los torneos.</li>
        <li>Enviarte avisos sobre tus clases y reservas (en la web, por WhatsApp o por Telegram si lo activas).</li>
        <li>Responder a tus consultas.</li>
      </ul>
      <h2>4. Base legal</h2>
      <p>
        La relación con la escuela (inscripción en clases y reservas), tu consentimiento (avisos, fotografías) y el
        cumplimiento de obligaciones legales.
      </p>
      <h2>5. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras seas alumno o tengas cuenta en la web y, después, el tiempo que exija la ley. Puedes pedir que se borren
        en cualquier momento.
      </p>
      <h2>6. Con quién se comparten</h2>
      <p>
        No se venden ni se ceden a terceros. Algunos servicios técnicos (alojamiento, mensajería de WhatsApp o Telegram)
        pueden tratarlos por cuenta del club con las garantías que marca la ley.
      </p>
      <h2>7. Tus derechos</h2>
      <p>
        Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad de tus datos escribiendo a{" "}
        {t.email}. Si no quedas satisfecho, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
      </p>
    </>
  );
}

function Cookies() {
  return (
    <>
      <h2>1. Qué usa esta web</h2>
      <p>
        Esta web no usa cookies de publicidad ni de análisis. Para que puedas mantener la sesión iniciada guarda en tu
        navegador (almacenamiento local) un identificador de sesión y tus datos básicos de usuario. Son técnicos y
        necesarios para que la web funcione, por lo que no requieren consentimiento.
      </p>
      <h2>2. Servicios de terceros</h2>
      <ul>
        <li>Previsión del tiempo: se consulta a Open-Meteo para mostrar el estado de la pista.</li>
        <li>Tipografías: se cargan desde Google Fonts.</li>
        <li>Enlaces a WhatsApp, redes sociales y medios de comunicación: al abrirlos se aplican sus propias políticas.</li>
      </ul>
      <h2>3. Cómo borrarlos</h2>
      <p>
        Al cerrar sesión se borran los datos de la sesión. También puedes borrarlos desde la configuración de tu navegador,
        en el apartado de datos de sitios web.
      </p>
      <h2>4. Cambios</h2>
      <p>Si en el futuro se añaden otras cookies, se actualizará esta página y se pedirá permiso cuando sea necesario.</p>
    </>
  );
}

const PAGINAS = {
  "aviso-legal": { titulo: "Aviso legal", Contenido: AvisoLegal },
  privacidad: { titulo: "Política de privacidad", Contenido: Privacidad },
  cookies: { titulo: "Política de cookies", Contenido: Cookies },
};

export default function Legal({ tipo }) {
  const pagina = PAGINAS[tipo] || PAGINAS["aviso-legal"];
  const { Contenido } = pagina;
  return (
    <article className="legal" aria-labelledby="legal-title">
      <p className="legalBorrador" role="note">
        <strong>Borrador pendiente de revisión legal.</strong> Este texto es una base genérica y aún no es definitivo.
      </p>
      <h1 id="legal-title">{pagina.titulo}</h1>
      <Contenido />
      <nav className="legalOtras" aria-label="Otros textos legales">
        {Object.entries(PAGINAS)
          .filter(([clave]) => PAGINAS[clave] !== pagina)
          .map(([clave, otra]) => (
            <Link key={clave} to={`/${clave}`}>
              {otra.titulo}
            </Link>
          ))}
      </nav>
    </article>
  );
}
