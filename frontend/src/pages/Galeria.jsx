import { useEffect, useMemo, useState } from "react";
import GalleryFilters from "../components/GalleryFilters";
import GalleryLightbox from "../components/GalleryLightbox";
import "./galeria.css";

const FILTERS = ["Todas", "Alumnos", "Clases", "Liga"];

function withPublicUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${publicUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function Galeria() {
  const [photos, setPhotos] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [manifestLoaded, setManifestLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      try {
        const res = await fetch(withPublicUrl("/gallery-manifest.json"), {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const nextPhotos = Array.isArray(data.photos) ? data.photos : [];

        if (!cancelled) {
          setPhotos(nextPhotos);
        }
      } catch {
        if (!cancelled) {
          setPhotos([]);
        }
      } finally {
        if (!cancelled) {
          setManifestLoaded(true);
        }
      }
    }

    loadManifest();

    return () => {
      cancelled = true;
    };
  }, []);

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
          <span className="galeriaEyebrow">Escuela de padel</span>
          <h1>Galeria</h1>
          <p className="galeriaLead">
            Partidos, clases y momentos del club reunidos en una galeria mas visual, rapida y preparada para crecer automaticamente.
          </p>

          <div className="galeriaStats">
            <article className="statCard">
              <strong>{stats.total}</strong>
              <span>Imagenes</span>
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
              {manifestLoaded ? "No hay imagenes disponibles todavia." : "Cargando galeria..."}
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
          <strong>No hay imagenes en esta categoria.</strong>
          <p>
            Anade archivos en `frontend/public/fotosAlumnos`, `frontend/public/fotosClase` o
            `frontend/public/fotosLiga` y la galeria los recogera automaticamente en la siguiente build.
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
    </section>
  );
}

export default Galeria;
