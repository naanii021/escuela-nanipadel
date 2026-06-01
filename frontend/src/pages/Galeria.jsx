import { useEffect, useMemo, useState } from "react";
import GalleryFilters from "../components/GalleryFilters";
import GalleryLightbox from "../components/GalleryLightbox";
import { apiGet, apiPatch, apiUpload } from "../services/api";
import { buildApiUrl } from "../services/apiConfig";
import { getUser, isLogged } from "../services/auth";
import "./galeria.css";

const FILTERS = ["Todas", "Alumnos", "Clases", "Liga", "Torneos", "Club", "Otros"];
const UPLOAD_CATEGORIES = ["Alumnos", "Clases", "Liga", "Torneos", "Club", "Otros"];
const EMPTY_UPLOAD_FORM = { titulo: "", categoria: "Otros", descripcion: "", imagen: null };

function withPublicUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/uploads")) return buildApiUrl(path);
  const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${publicUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function Galeria() {
  const [photos, setPhotos] = useState([]);
  const [manifestPhotos, setManifestPhotos] = useState([]);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD_FORM);
  const [uploadStatus, setUploadStatus] = useState({ type: "", message: "" });
  const [uploading, setUploading] = useState(false);
  const [pendingLoaded, setPendingLoaded] = useState(false);

  const user = getUser();
  const logged = isLogged();
  const isAdmin = String(user?.rol || "").toLowerCase() === "admin";

  useEffect(() => {
    let cancelled = false;

    async function loadPhotos() {
      try {
        const [manifestResult, apiResult] = await Promise.allSettled([
          fetch(withPublicUrl("/gallery-manifest.json"), {
            headers: { Accept: "application/json" },
            cache: "no-store",
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          }),
          apiGet("/api/galeria").catch(() => ({ photos: [] })),
        ]);

        const staticPhotos = manifestResult.status === "fulfilled" && Array.isArray(manifestResult.value.photos)
          ? manifestResult.value.photos
          : [];
        const dbPhotos = apiResult.status === "fulfilled" && Array.isArray(apiResult.value.photos)
          ? apiResult.value.photos
          : [];

        if (!cancelled) {
          setManifestPhotos(staticPhotos);
          setUploadedPhotos(dbPhotos);
          setPhotos([...dbPhotos, ...staticPhotos]);
        }
      } catch {
        if (!cancelled) {
          setManifestPhotos([]);
          setUploadedPhotos([]);
          setPhotos([]);
        }
      } finally {
        if (!cancelled) {
          setManifestLoaded(true);
        }
      }
    }

    loadPhotos();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPending() {
      if (!isAdmin) return;
      try {
        const data = await apiGet("/api/galeria/pendientes");
        if (!cancelled) setPendingPhotos(data.photos || []);
      } catch {
        if (!cancelled) setPendingPhotos([]);
      } finally {
        if (!cancelled) setPendingLoaded(true);
      }
    }

    loadPending();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const reloadApprovedPhotos = async () => {
    try {
      const data = await apiGet("/api/galeria");
      const dbPhotos = data.photos || [];
      setUploadedPhotos(dbPhotos);
      setPhotos([...dbPhotos, ...manifestPhotos]);
    } catch {
      setPhotos([...uploadedPhotos, ...manifestPhotos]);
    }
  };

  const reloadPendingPhotos = async () => {
    if (!isAdmin) return;
    const data = await apiGet("/api/galeria/pendientes");
    setPendingPhotos(data.photos || []);
  };

  const filteredPhotos = useMemo(() => {
    if (selectedCategory === "Todas") return photos;
    return photos.filter((photo) => photo.category === selectedCategory);
  }, [photos, selectedCategory]);

  const coverPhoto = filteredPhotos[0] || photos[0] || null;
  const featuredStrip = filteredPhotos.slice(0, 3);

  const stats = useMemo(() => {
    return {
      total: photos.length,
      alumnos: photos.filter((photo) => photo.category === "Alumnos").length,
      clases: photos.filter((photo) => photo.category === "Clases").length,
      liga: photos.filter((photo) => photo.category === "Liga").length,
    };
  }, [photos]);

  const openLightbox = (index) => {
    setLightboxIndex(index);
  };

  const openUpload = () => {
    if (!logged) {
      setUploadStatus({ type: "info", message: "Inicia sesión para enviar fotos al club." });
      setUploadOpen(true);
      return;
    }
    setUploadStatus({ type: "", message: "" });
    setUploadOpen(true);
  };

  const closeUpload = () => {
    if (uploading) return;
    setUploadOpen(false);
    setUploadForm(EMPTY_UPLOAD_FORM);
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!logged) return;
    if (!uploadForm.imagen) {
      setUploadStatus({ type: "error", message: "Selecciona una imagen antes de enviar." });
      return;
    }

    const formData = new FormData();
    formData.append("imagen", uploadForm.imagen);
    formData.append("titulo", uploadForm.titulo);
    formData.append("categoria", uploadForm.categoria);
    formData.append("descripcion", uploadForm.descripcion);

    try {
      setUploading(true);
      const data = await apiUpload("/api/galeria/upload", formData);
      setUploadStatus({ type: data.estado === "aprobada" ? "success" : "info", message: data.message });
      setUploadForm(EMPTY_UPLOAD_FORM);
      if (data.estado === "aprobada") await reloadApprovedPhotos();
      if (isAdmin) await reloadPendingPhotos();
    } catch (e) {
      setUploadStatus({ type: "error", message: e.message || "No hemos podido subir la foto." });
    } finally {
      setUploading(false);
    }
  };

  const moderatePhoto = async (photo, action) => {
    const motivo = action === "rechazar" ? window.prompt("Motivo de rechazo (opcional):") || "" : "";
    try {
      await apiPatch(`/api/galeria/${photo.dbId}/` + action, action === "rechazar" ? { motivo } : undefined);
      await reloadPendingPhotos();
      if (action === "aprobar") await reloadApprovedPhotos();
    } catch (e) {
      setUploadStatus({ type: "error", message: e.message || "No hemos podido actualizar la foto." });
      setUploadOpen(true);
    }
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const showPrev = () => {
    setLightboxIndex((current) => {
      if (current === null || !filteredPhotos.length) return current;
      return (current - 1 + filteredPhotos.length) % filteredPhotos.length;
    });
  };

  const showNext = () => {
    setLightboxIndex((current) => {
      if (current === null || !filteredPhotos.length) return current;
      return (current + 1) % filteredPhotos.length;
    });
  };

  return (
    <section className="galeria">
      <header className="galeriaHero">
        <div className="galeriaHeroCopy">
          <span className="galeriaEyebrow">Escuela de pádel</span>
          <h1>Galería</h1>
          <p className="galeriaLead">
            Fotos de clases, torneos y momentos del club. También puedes enviar tus fotos para que el equipo las revise.
          </p>

          <div className="galeriaStats">
            <article className="statCard">
              <strong>{stats.total}</strong>
              <span>Imágenes</span>
            </article>
            <article className="statCard">
              <strong>{stats.clases}</strong>
              <span>Clases</span>
            </article>
            <article className="statCard">
              <strong>{stats.liga}</strong>
              <span>Liga</span>
            </article>
            <article className="statCard">
              <strong>{stats.alumnos}</strong>
              <span>Alumnos</span>
            </article>
          </div>

          <div className="galeriaHeroActions">
            <button type="button" className="galleryUploadBtn" onClick={openUpload}>
              Enviar foto al club
            </button>
            {!logged && <span>Inicia sesión para enviar tus fotos al club.</span>}
          </div>
        </div>

        <div className="galeriaHeroPanel">
          {coverPhoto ? (
            <>
              <img
                className="heroPanelImage"
                src={withPublicUrl(coverPhoto.src)}
                alt={coverPhoto.title}
              />
              <div className="heroPanelOverlay" />
              <div className="heroPanelContent">
                <span className="heroPanelTag">{coverPhoto.category}</span>
                <strong>{coverPhoto.title}</strong>
                <p>{coverPhoto.desc}</p>
              </div>
            </>
          ) : (
            <div className="heroPanelEmpty">
              {manifestLoaded ? "No hay imágenes disponibles todavía." : "Cargando galería..."}
            </div>
          )}
        </div>
      </header>

      <section className="galeriaControls">
        <GalleryFilters
          filters={FILTERS}
          selectedCategory={selectedCategory}
          onChange={setSelectedCategory}
        />
        <p className="galleryToolbarNote">
          {filteredPhotos.length} foto{filteredPhotos.length === 1 ? "" : "s"} en esta vista
        </p>
      </section>

      {isAdmin && (
        <section className="galleryModeration">
          <div className="moderationHeader">
            <div>
              <span className="galeriaEyebrow">Moderación</span>
              <h2>Fotos pendientes de revisión</h2>
            </div>
            <strong>{pendingPhotos.length}</strong>
          </div>
          {!pendingLoaded && <p className="galleryToolbarNote">Cargando fotos pendientes...</p>}
          {pendingLoaded && pendingPhotos.length === 0 && <p className="galleryToolbarNote">No hay fotos pendientes ahora mismo.</p>}
          {pendingPhotos.length > 0 && (
            <div className="pendingPhotoGrid">
              {pendingPhotos.map((photo) => (
                <article className="pendingPhotoCard" key={photo.id}>
                  <img src={withPublicUrl(photo.src)} alt={photo.title} />
                  <div>
                    <span className="statusBadge statusPending">Pendiente</span>
                    <h3>{photo.title}</h3>
                    <p>{photo.desc}</p>
                    <small>{photo.category} · {photo.usuario_nombre || "Usuario"}</small>
                    <div className="pendingActions">
                      <button type="button" onClick={() => moderatePhoto(photo, "aprobar")}>Aprobar</button>
                      <button type="button" className="rejectBtn" onClick={() => moderatePhoto(photo, "rechazar")}>Rechazar</button>
                      <button type="button" className="deleteBtn" onClick={() => moderatePhoto(photo, "eliminar")}>Eliminar</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {featuredStrip.length > 0 && (
        <section className="featuredStrip" aria-label="Resumen visual">
          {featuredStrip.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="featuredCard"
              onClick={() => openLightbox(index)}
            >
              <img src={withPublicUrl(photo.src)} alt={photo.title} />
              <span>{photo.category}</span>
              <strong>{photo.title}</strong>
            </button>
          ))}
        </section>
      )}

      <section className="galleryGrid" aria-live="polite">
        {filteredPhotos.map((photo, index) => (
          <article
            key={photo.id}
            className={`galleryCard ${index === 0 ? "galleryCardLarge" : ""}`}
          >
            <button
              type="button"
              className="galleryCardButton"
              onClick={() => openLightbox(index)}
            >
              <div className="galleryImageWrap">
                <img src={withPublicUrl(photo.src)} alt={photo.title} loading="lazy" />
                <div className="galleryImageShade" />
                <span className="galleryCategory">{photo.category}</span>
              </div>
              <div className="galleryInfo">
                <span className="galleryMeta">{photo.highlight}</span>
                <strong>{photo.title}</strong>
                <p>{photo.desc}</p>
              </div>
            </button>
          </article>
        ))}
      </section>

      {manifestLoaded && filteredPhotos.length === 0 && (
        <section className="galleryEmpty">
          <strong>Aún no hay fotos en esta categoría.</strong>
          <p>
            Cuando el club apruebe nuevas fotos, aparecerán aquí junto a las imágenes actuales.
          </p>
        </section>
      )}

      <GalleryLightbox
        photos={filteredPhotos}
        activeIndex={lightboxIndex}
        onClose={closeLightbox}
        onPrev={showPrev}
        onNext={showNext}
        resolveSrc={withPublicUrl}
      />

      {uploadOpen && (
        <div className="galleryUploadOverlay" role="dialog" aria-modal="true" aria-labelledby="gallery-upload-title">
          <form className="galleryUploadModal" onSubmit={submitUpload}>
            <div className="uploadModalHeader">
              <div>
                <span className="galeriaEyebrow">NaniPadel</span>
                <h2 id="gallery-upload-title">{logged ? "Enviar foto al club" : "Subir foto"}</h2>
              </div>
              <button type="button" onClick={closeUpload} aria-label="Cerrar subida">x</button>
            </div>

            {!logged ? (
              <div className="uploadLoginBox">
                <p>Inicia sesión para enviar fotos al club.</p>
                <a href="/login" className="galleryUploadBtn">Entrar</a>
              </div>
            ) : (
              <>
                <label>
                  Imagen
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setUploadForm((current) => ({ ...current, imagen: e.target.files?.[0] || null }))} />
                </label>
                <label>
                  Título
                  <input value={uploadForm.titulo} maxLength={150} onChange={(e) => setUploadForm((current) => ({ ...current, titulo: e.target.value }))} required />
                </label>
                <label>
                  Categoría
                  <select value={uploadForm.categoria} onChange={(e) => setUploadForm((current) => ({ ...current, categoria: e.target.value }))}>
                    {UPLOAD_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  Descripción opcional
                  <textarea value={uploadForm.descripcion} rows="4" onChange={(e) => setUploadForm((current) => ({ ...current, descripcion: e.target.value }))} />
                </label>
                <button type="submit" className="galleryUploadBtn" disabled={uploading}>
                  {uploading ? "Enviando..." : isAdmin ? "Subir y publicar" : "Enviar para revisión"}
                </button>
              </>
            )}

            {uploadStatus.message && (
              <p className={`uploadStatus uploadStatus-${uploadStatus.type || "info"}`}>{uploadStatus.message}</p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}

export default Galeria;
