import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut } from "../services/api";
import { getToken, updateStoredUser } from "../services/auth";
import "./perfil.css";

const GAME_LEVELS = [
  { value: "", label: "Sin nivel configurado" },
  { value: 0, label: "0 - Iniciación" },
  { value: 1, label: "1 - Principiante" },
  { value: 2, label: "2 - Medio bajo" },
  { value: 3, label: "3 - Medio" },
  { value: 4, label: "4 - Medio alto" },
  { value: 5, label: "5 - Avanzado" },
  { value: 6, label: "6 - Competición / profesional" },
];

const SPECIALTIES = [
  "Niños",
  "Adultos iniciacion",
  "Adultos avanzado",
  "Competición",
  "Clases particulares",
  "Tecnificación",
  "Torneos",
  "Preparacion fisica",
];

const emptyProfile = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  foto_perfil_url: "",
  nivel_juego: "",
  mano_dominante: "",
  lado_preferido: "",
  ciudad: "",
  club_habitual: "",
  disponibilidad_general: "",
  preferencias_notificacion: "",
  buscar_partidas_abiertas: 1,
  privacidad_perfil: "",
};

const emptyProfessional = {
  zona_trabajo: "",
  ciudad_base: "",
  pueblos_trabajo: "",
  club_principal: "",
  otros_clubes: "",
  tiene_club_propio: 0,
  nombre_club_propio: "",
  especialidades: "",
  anos_experiencia: "",
  niveles_que_entrena: "",
  disponibilidad_laboral: "",
  biografia_profesional: "",
  instagram_profesional: "",
  telefono_profesional: "",
};

const emptyNotificationPreferences = {
  email_enabled: 1,
  whatsapp_enabled: 0,
  in_app_enabled: 0,
  notify_reservas: 1,
  notify_clases: 1,
  notify_club: 1,
  notify_torneos: 1,
  whatsapp_phone: "",
};

function initials(nombre, apellidos) {
  return `${String(nombre || "U").charAt(0)}${String(apellidos || "").charAt(0)}`.toUpperCase();
}

function roleLabel(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "Administrador";
  if (normalized === "profesor" || normalized === "profe") return "Profesor";
  if (normalized === "alumno") return "Alumno";
  return "Usuario";
}

function gameLevelLabel(value) {
  return GAME_LEVELS.find((item) => String(item.value) === String(value))?.label || "Sin nivel configurado";
}

function toFormProfile(profile) {
  return {
    ...emptyProfile,
    ...Object.fromEntries(Object.keys(emptyProfile).map((key) => [key, profile?.[key] ?? emptyProfile[key]])),
  };
}

function toFormProfessional(profile) {
  return {
    ...emptyProfessional,
    ...Object.fromEntries(Object.keys(emptyProfessional).map((key) => [key, profile?.[key] ?? emptyProfessional[key]])),
  };
}

function toFormNotificationPreferences(preferences) {
  return {
    ...emptyNotificationPreferences,
    ...Object.fromEntries(
      Object.keys(emptyNotificationPreferences).map((key) => [
        key,
        preferences?.[key] ?? emptyNotificationPreferences[key],
      ])
    ),
    email_enabled: 1,
    whatsapp_phone: preferences?.whatsapp_phone || "",
  };
}

export default function Perfil() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyProfile);
  const [professionalForm, setProfessionalForm] = useState(emptyProfessional);
  const [notificationForm, setNotificationForm] = useState(emptyNotificationPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isProfessional = useMemo(() => {
    const role = String(profile?.rol || "").toLowerCase();
    return ["admin", "profesor", "profe"].includes(role);
  }, [profile?.rol]);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet("/api/perfil");
      const notificationData = await apiGet("/api/notificaciones/preferencias").catch(() => ({
        preferences: emptyNotificationPreferences,
      }));
      setProfile(data.profile);
      setForm(toFormProfile(data.profile));
      setProfessionalForm(toFormProfessional(data.profile));
      setNotificationForm(toFormNotificationPreferences(notificationData.preferences));
    } catch (e) {
      setError(e.message || "No hemos podido cargar tu perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }

    loadProfile();
  }, [loadProfile, navigate]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateProfessional = (field, value) => setProfessionalForm((current) => ({ ...current, [field]: value }));
  const updateNotification = (field, value) => {
    setNotificationForm((current) => ({ ...current, [field]: value }));
  };

  const getWhatsappPhone = () =>
    String(notificationForm.whatsapp_phone || form.telefono || "").trim();

  const savePersonal = async (event) => {
    event.preventDefault();
    if (Number(notificationForm.whatsapp_enabled) === 1 && !getWhatsappPhone()) {
      setError("Añade un número de teléfono para recibir avisos por WhatsApp.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload = {
        ...form,
        nivel_juego: form.nivel_juego === "" ? null : Number(form.nivel_juego),
        buscar_partidas_abiertas: Number(form.buscar_partidas_abiertas),
        whatsapp_enabled: Number(notificationForm.whatsapp_enabled),
        whatsapp_phone: getWhatsappPhone() || null,
      };
      const data = await apiPut("/api/perfil", payload);
      let notificationData = null;
      try {
        notificationData = await apiPut("/api/notificaciones/preferencias", {
          ...notificationForm,
          email_enabled: 1,
          whatsapp_enabled: Number(notificationForm.whatsapp_enabled),
          in_app_enabled: Number(notificationForm.in_app_enabled),
          notify_reservas: Number(notificationForm.notify_reservas),
          notify_clases: Number(notificationForm.notify_clases),
          notify_club: Number(notificationForm.notify_club),
          notify_torneos: Number(notificationForm.notify_torneos),
          whatsapp_phone: getWhatsappPhone() || null,
        });
      } catch (notificationError) {
        setError(notificationError.message || "Perfil guardado, pero no hemos podido guardar las preferencias de aviso.");
      }
      setProfile(data.profile);
      setForm(toFormProfile(data.profile));
      if (notificationData?.preferences) {
        setNotificationForm(toFormNotificationPreferences(notificationData.preferences));
      }
      updateStoredUser({
        nombre: data.profile.nombre,
        email: data.profile.email,
        rol: data.profile.rol,
        nivel_juego: data.profile.nivel_juego,
        foto_perfil_url: data.profile.foto_perfil_url,
      });
      showNotice(notificationData?.preferences ? "Perfil guardado." : "Perfil guardado. Revisa las preferencias de aviso más tarde.");
    } catch (e) {
      setError(e.message || "No hemos podido guardar tu perfil.");
    } finally {
      setSaving(false);
    }
  };

  const saveProfessional = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = {
        ...professionalForm,
        tiene_club_propio: Number(professionalForm.tiene_club_propio),
        anos_experiencia: professionalForm.anos_experiencia === "" ? null : Number(professionalForm.anos_experiencia),
      };
      const data = await apiPut("/api/perfil/profesional", payload);
      setProfile(data.profile);
      setProfessionalForm(toFormProfessional(data.profile));
      showNotice("Perfil profesional guardado.");
    } catch (e) {
      setError(e.message || "No hemos podido guardar tu perfil profesional.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="profilePage">
        <div className="profileSkeleton" />
        <div className="profileSkeletonGrid"><span /><span /><span /></div>
      </section>
    );
  }

  return (
    <section className="profilePage">
      <header className="profileHero">
        <div className="profileIdentity">
          <div className="profileAvatar">
            {form.foto_perfil_url ? <img src={form.foto_perfil_url} alt="" /> : <span>{initials(form.nombre, form.apellidos)}</span>}
          </div>
          <div>
            <span className="profileEyebrow">Tu cuenta</span>
            <h1>{form.nombre || "Tu perfil"} {form.apellidos || ""}</h1>
            <p>{roleLabel(profile?.rol)} · {gameLevelLabel(form.nivel_juego)}</p>
          </div>
        </div>
        <button className="profilePrimaryBtn" onClick={savePersonal} disabled={saving}>
          {saving ? "Guardando..." : "Guardar perfil"}
        </button>
      </header>

      {notice && <div className="profileNotice">{notice}</div>}
      {error && <div className="profileError">{error}</div>}

      <form className="profileGrid" onSubmit={savePersonal}>
        <article className="profileCard">
          <div className="profileCardHeader">
            <span>01</span>
            <div><h2>Datos personales</h2><p>Informacion basica para que el club pueda identificarte.</p></div>
          </div>
          <div className="profileFormGrid">
            <label>Nombre<input value={form.nombre || ""} onChange={(e) => updateForm("nombre", e.target.value)} required /></label>
            <label>Apellidos<input value={form.apellidos || ""} onChange={(e) => updateForm("apellidos", e.target.value)} /></label>
            <label>Email<input type="email" value={form.email || ""} onChange={(e) => updateForm("email", e.target.value)} required /></label>
            <label>Teléfono<input value={form.telefono || ""} onChange={(e) => updateForm("telefono", e.target.value)} /></label>
            <label>Ciudad<input value={form.ciudad || ""} onChange={(e) => updateForm("ciudad", e.target.value)} /></label>
            <label>Club habitual<input value={form.club_habitual || ""} onChange={(e) => updateForm("club_habitual", e.target.value)} /></label>
          </div>
        </article>

        <article className="profileCard">
          <div className="profileCardHeader">
            <span>02</span>
          <div><h2>Datos de pádel</h2><p>Nos ayudan a ajustar mejor las partidas abiertas.</p></div>
          </div>
          <div className="profileFormGrid">
            <label>Nivel de juego<select value={form.nivel_juego ?? ""} onChange={(e) => updateForm("nivel_juego", e.target.value)}>{GAME_LEVELS.map((level) => <option key={String(level.value)} value={level.value}>{level.label}</option>)}</select></label>
            <label>Mano dominante<select value={form.mano_dominante || ""} onChange={(e) => updateForm("mano_dominante", e.target.value)}><option value="">Sin indicar</option><option value="derecha">Derecha</option><option value="izquierda">Izquierda</option></select></label>
            <label>Lado preferido<select value={form.lado_preferido || ""} onChange={(e) => updateForm("lado_preferido", e.target.value)}><option value="">Sin indicar</option><option value="drive">Drive</option><option value="reves">Reves</option><option value="ambos">Ambos</option></select></label>
            <label>Disponibilidad<select value={form.disponibilidad_general || ""} onChange={(e) => updateForm("disponibilidad_general", e.target.value)}><option value="">Sin indicar</option><option value="mananas">Mañanas</option><option value="tardes">Tardes</option><option value="noches">Noches</option><option value="fines_semana">Fines de semana</option><option value="variable">Variable</option></select></label>
            <label>Buscar partidas abiertas<select value={Number(form.buscar_partidas_abiertas ?? 1)} onChange={(e) => updateForm("buscar_partidas_abiertas", Number(e.target.value))}><option value={1}>Si</option><option value={0}>No</option></select></label>
            <label>Notificaciones<input value={form.preferencias_notificacion || ""} onChange={(e) => updateForm("preferencias_notificacion", e.target.value)} placeholder="Email, avisos web, partidas..." /></label>
          </div>
        </article>

        <article className="profileCard">
          <div className="profileCardHeader">
            <span>03</span>
            <div><h2>Foto y privacidad</h2><p>Elige cómo quieres aparecer en la plataforma.</p></div>
          </div>
          <div className="profileFormGrid">
            <label className="profileWide">URL foto de perfil<input value={form.foto_perfil_url || ""} onChange={(e) => updateForm("foto_perfil_url", e.target.value)} placeholder="https://..." /></label>
            <label className="profileWide">Privacidad del perfil<select value={form.privacidad_perfil || ""} onChange={(e) => updateForm("privacidad_perfil", e.target.value)}><option value="">Privacidad por defecto</option><option value="publico_partidas">Visible en partidas abiertas</option><option value="solo_club">Solo visible para el club</option><option value="privado">Privado</option></select></label>
          </div>
        </article>

        <article className="profileCard">
          <div className="profileCardHeader">
            <span>04</span>
            <div><h2>Preferencias de aviso</h2><p>El email queda siempre activo; el resto depende de tu perfil.</p></div>
          </div>
          <div className="profilePreferenceGrid">
            <label className="profileToggle disabled">
              <input type="checkbox" checked readOnly />
              <span><strong>Email</strong><small>Canal obligatorio para reservas y avisos importantes.</small></span>
            </label>
            <label className="profileToggle">
              <input type="checkbox" checked={Number(notificationForm.in_app_enabled) === 1} onChange={(e) => updateNotification("in_app_enabled", e.target.checked ? 1 : 0)} />
              <span><strong>Notificación interna</strong><small>Avisos visibles en la campana de la web.</small></span>
            </label>
            <label className="profileToggle profileWhatsappToggle">
              <input type="checkbox" checked={Number(notificationForm.whatsapp_enabled) === 1} onChange={(e) => updateNotification("whatsapp_enabled", e.target.checked ? 1 : 0)} />
              <span><strong>Recibir avisos por WhatsApp</strong><small>Recibe avisos importantes en el número indicado.</small></span>
            </label>
          </div>

          <div className="profileWhatsappBox">
            <label>
              Teléfono para WhatsApp
              <input
                value={notificationForm.whatsapp_phone || ""}
                onChange={(e) => updateNotification("whatsapp_phone", e.target.value)}
                placeholder={form.telefono ? `Usar ${form.telefono}` : "Ej: 34600111222"}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <p>
              {Number(notificationForm.whatsapp_enabled) === 1 && !getWhatsappPhone()
                ? "Añade un número de teléfono para recibir avisos por WhatsApp."
                : "Puedes dejarlo vacío si quieres usar el teléfono de tus datos personales."}
            </p>
            <p className="profileWhatsappLegal">
              Acepto recibir avisos de reservas, clases y torneos de NaniPadel por WhatsApp.
            </p>
          </div>

          <div className="profilePreferenceTypes">
            <label><input type="checkbox" checked={Number(notificationForm.notify_reservas) === 1} onChange={(e) => updateNotification("notify_reservas", e.target.checked ? 1 : 0)} /> Reservas</label>
            <label><input type="checkbox" checked={Number(notificationForm.notify_clases) === 1} onChange={(e) => updateNotification("notify_clases", e.target.checked ? 1 : 0)} /> Clases</label>
            <label><input type="checkbox" checked={Number(notificationForm.notify_club) === 1} onChange={(e) => updateNotification("notify_club", e.target.checked ? 1 : 0)} /> Club</label>
            <label><input type="checkbox" checked={Number(notificationForm.notify_torneos) === 1} onChange={(e) => updateNotification("notify_torneos", e.target.checked ? 1 : 0)} /> Torneos</label>
          </div>
        </article>

        {profile?.rol === "admin" && (
          <article className="profileCard profilePermissions">
            <div className="profileCardHeader">
              <span>ADM</span>
              <div><h2>Permisos</h2><p>Resumen de lo que puedes gestionar con tu rol.</p></div>
            </div>
            <div className="permissionGrid">
              <span>Rol: {roleLabel(profile.rol)}</span>
              <span>Gestionar alumnos</span>
              <span>Gestionar grupos</span>
              <span>Gestionar reservas</span>
              <span>Gestionar torneos</span>
              <span>Crear accesos</span>
            </div>
          </article>
        )}

        <div className="profileActionsBar">
          <button type="button" className="profileSecondaryBtn" onClick={loadProfile}>Cancelar cambios</button>
          <button type="submit" className="profilePrimaryBtn" disabled={saving}>{saving ? "Guardando..." : "Guardar perfil"}</button>
        </div>
      </form>

      {isProfessional && (
        <form className="profileProfessional" onSubmit={saveProfessional}>
          <div className="profileCardHeader">
            <span>PRO</span>
            <div><h2>Perfil profesional</h2><p>Datos utiles para profesores y administracion del club.</p></div>
          </div>

          <div className="profileFormGrid">
            <label>Zona de trabajo<input value={professionalForm.zona_trabajo || ""} onChange={(e) => updateProfessional("zona_trabajo", e.target.value)} /></label>
            <label>Ciudad base<input value={professionalForm.ciudad_base || ""} onChange={(e) => updateProfessional("ciudad_base", e.target.value)} /></label>
            <label>Club principal<input value={professionalForm.club_principal || ""} onChange={(e) => updateProfessional("club_principal", e.target.value)} /></label>
            <label>Teléfono profesional<input value={professionalForm.telefono_profesional || ""} onChange={(e) => updateProfessional("telefono_profesional", e.target.value)} /></label>
            <label>Tiene club propio<select value={Number(professionalForm.tiene_club_propio ?? 0)} onChange={(e) => updateProfessional("tiene_club_propio", Number(e.target.value))}><option value={0}>No</option><option value={1}>Si</option></select></label>
            <label>Nombre club propio<input value={professionalForm.nombre_club_propio || ""} onChange={(e) => updateProfessional("nombre_club_propio", e.target.value)} /></label>
            <label>Años de experiencia<input type="number" min="0" max="80" value={professionalForm.anos_experiencia ?? ""} onChange={(e) => updateProfessional("anos_experiencia", e.target.value)} /></label>
            <label>Instagram profesional<input value={professionalForm.instagram_profesional || ""} onChange={(e) => updateProfessional("instagram_profesional", e.target.value)} placeholder="@usuario" /></label>
            <label className="profileWide">Pueblos de trabajo<textarea value={professionalForm.pueblos_trabajo || ""} onChange={(e) => updateProfessional("pueblos_trabajo", e.target.value)} /></label>
            <label className="profileWide">Otros clubes<textarea value={professionalForm.otros_clubes || ""} onChange={(e) => updateProfessional("otros_clubes", e.target.value)} /></label>
            <label className="profileWide">Especialidades<input value={professionalForm.especialidades || ""} onChange={(e) => updateProfessional("especialidades", e.target.value)} list="specialties-list" placeholder="Niños, competición, tecnificación..." /></label>
            <label>Niveles que entrena<input value={professionalForm.niveles_que_entrena || ""} onChange={(e) => updateProfessional("niveles_que_entrena", e.target.value)} /></label>
            <label className="profileWide">Disponibilidad laboral<textarea value={professionalForm.disponibilidad_laboral || ""} onChange={(e) => updateProfessional("disponibilidad_laboral", e.target.value)} /></label>
            <label className="profileWide">Biografia profesional<textarea value={professionalForm.biografia_profesional || ""} onChange={(e) => updateProfessional("biografia_profesional", e.target.value)} /></label>
          </div>
          <datalist id="specialties-list">{SPECIALTIES.map((item) => <option key={item} value={item} />)}</datalist>
          <div className="profileActionsBar">
            <button type="button" className="profileSecondaryBtn" onClick={loadProfile}>Cancelar cambios</button>
            <button type="submit" className="profilePrimaryBtn" disabled={saving}>{saving ? "Guardando..." : "Guardar perfil profesional"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
