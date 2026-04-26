import { useEffect, useMemo, useState } from "react";
import "./galeria.css";

const AUTOPLAY_MS = 4200;
const NEWS_MS = 5500;

const FALLBACK_PHOTOS = [];

const NEWS = [
  {
    id: 1,
    tag: "Torneo",
    tagColor: "amber",
    title: "Torneo de Primavera - inscripciones abiertas",
    body: "El 3 de mayo arranca el torneo social de primavera. Plazas limitadas para todas las categorias, apuntate cuanto antes.",
    date: "17 abr 2026",
  },
  {
    id: 2,
    tag: "Clases",
    tagColor: "blue",
    title: "Nuevo horario de clases para mayo",
    body: "Anadimos sesiones de manana los martes y jueves desde el 1 de mayo para nivel iniciacion y perfeccionamiento.",
    date: "15 abr 2026",
  },
  {
    id: 3,
    tag: "Pistas",
    tagColor: "green",
    title: "Pista 3 renovada con cristal panoramico",
    body: "Ya disponible la pista 3 tras su renovacion con nueva iluminacion LED y cristal de alta calidad panoramico.",
    date: "10 abr 2026",
  },
  {
    id: 4,
    tag: "Evento",
    tagColor: "purple",
    title: "Puertas abiertas - domingo 27 de abril",
    body: "Invita a tus amigos a probar el padel gratis. Sesiones guiadas de 10h a 14h sin necesidad de reserva previa.",
    date: "5 abr 2026",
  },
  {
    id: 5,
    tag: "Liga",
    tagColor: "rose",
    title: "Clasificacion actualizada tras la ronda 4",
    body: "El equipo B lidera la tabla con 3 victorias consecutivas. Consulta la clasificacion completa en el panel.",
    date: "14 abr 2026",
  },
];

function withPublicUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${publicUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function Galeria() {
  const [photos, setPhotos] = useState(FALLBACK_PHOTOS);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [imgKey, setImgKey] = useState(0);
  const [newsIndex, setNewsIndex] = useState(0);
  const [newsVisible, setNewsVisible] = useState(true);
  const [newsReset, setNewsReset] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPhotos = async () => {
      try {
        const res = await fetch(withPublicUrl("/fotos/gallery-manifest.json"), {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const nextPhotos = Array.isArray(data.photos) ? data.photos : [];

        if (!cancelled) {
          setPhotos(nextPhotos.length ? nextPhotos : FALLBACK_PHOTOS);
        }
      } catch {
        if (!cancelled) {
          setPhotos(FALLBACK_PHOTOS);
        }
      }
    };

    loadPhotos();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => ["Todas", ...new Set(photos.map((photo) => photo.category || "Club"))],
    [photos]
  );

  const filteredPhotos = useMemo(() => {
    return selectedCategory === "Todas"
      ? photos
      : photos.filter((photo) => photo.category === selectedCategory);
  }, [photos, selectedCategory]);

  useEffect(() => {
    setActiveIndex(0);
  }, [selectedCategory, photos]);

  useEffect(() => {
    if (activeIndex >= filteredPhotos.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredPhotos.length]);

  useEffect(() => {
    setImgKey((key) => key + 1);
  }, [activeIndex]);

  useEffect(() => {
    if (!autoplay || filteredPhotos.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % filteredPhotos.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [autoplay, filteredPhotos]);

  useEffect(() => {
    const id = window.setInterval(() => setNewsVisible(false), NEWS_MS);
    return () => window.clearInterval(id);
  }, [newsReset]);

  useEffect(() => {
    if (newsVisible) return undefined;
    const id = window.setTimeout(() => {
      setNewsIndex((index) => (index + 1) % NEWS.length);
      setNewsVisible(true);
    }, 320);
    return () => window.clearTimeout(id);
  }, [newsVisible]);

  const activePhoto = filteredPhotos[activeIndex] || filteredPhotos[0] || null;
  const activeNews = NEWS[newsIndex];

  const goPrev = () => {
    if (!filteredPhotos.length) return;
    setAutoplay(false);
    setActiveIndex((index) => (index - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  const goNext = () => {
    if (!filteredPhotos.length) return;
    setAutoplay(false);
    setActiveIndex((index) => (index + 1) % filteredPhotos.length);
  };

  const selectNews = (index) => {
    setNewsVisible(false);
    window.setTimeout(() => {
      setNewsIndex(index);
      setNewsVisible(true);
      setNewsReset((reset) => reset + 1);
    }, 160);
  };

  return (
    <section className="galeria">
      <div className="galeriaHero">
        <div className="galeriaHeroText">
          <div className="galeriaPill">
            <span className="galeriaPillDot" />
            Momentos del club
          </div>
          <h2>Galeria</h2>
          <p className="galeriaIntro">
            Torneos, entrenamientos y vida de club en un formato visual, dinamico y facil de explorar.
          </p>

          <div className="galeriaStats">
            <div className="galeriaStat">
              <strong>{photos.length}</strong>
              <span>Fotos</span>
            </div>
            <div className="galeriaStat">
              <strong>{categories.length - 1}</strong>
              <span>Categorias</span>
            </div>
            <div className="galeriaStat">
              <strong>2026</strong>
              <span>Temporada</span>
            </div>
          </div>

          <div className="galeriaNewsBlock">
            <div className="galeriaNewsHeader">
              <span className="galeriaNewsLive">
                <span className="liveIndicator" />
                En vivo
              </span>
              <span className="galeriaNewsLabel">Ultimas noticias</span>
            </div>

            <div className={`galeriaNewsBody ${newsVisible ? "newsIn" : "newsOut"}`}>
              <span className={`galeriaNewsTag tag-${activeNews.tagColor}`}>
                {activeNews.tag}
              </span>
              <strong className="galeriaNewsTitle">{activeNews.title}</strong>
              <p className="galeriaNewsDesc">{activeNews.body}</p>
              <span className="galeriaNewsDate">{activeNews.date}</span>
            </div>

            <div className="galeriaNewsDots">
              {NEWS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`newsDot ${index === newsIndex ? "active" : ""}`}
                  onClick={() => selectNews(index)}
                  aria-label={`Noticia ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className="showcaseCard"
          onMouseEnter={() => setAutoplay(false)}
          onMouseLeave={() => setAutoplay(true)}
        >
          <div className="showcaseImageWrap">
            {activePhoto ? (
              <>
                <img
                  key={imgKey}
                  src={withPublicUrl(activePhoto.src)}
                  alt={activePhoto.title}
                  loading="eager"
                  className="showcaseImg"
                />
                <div className="showcaseOverlay" />

                <div className="showcaseTop">
                  <span className="showcaseTag">{activePhoto.category}</span>
                  <button
                    type="button"
                    className={`autoBtn ${autoplay ? "active" : ""}`}
                    onClick={() => setAutoplay((value) => !value)}
                  >
                    {autoplay ? "▶ Auto" : "⏸ Pausa"}
                  </button>
                </div>

                <div className="showcaseContent">
                  <span className="showcaseKicker">{activePhoto.highlight}</span>
                  <h3>{activePhoto.title}</h3>
                  <p>{activePhoto.desc}</p>
                </div>

                <div className="showcaseNav">
                  <button type="button" className="navBtn" onClick={goPrev} aria-label="Foto anterior">
                    ‹
                  </button>
                  <span className="navCounter">
                    {activeIndex + 1} <em>/</em> {filteredPhotos.length}
                  </span>
                  <button type="button" className="navBtn" onClick={goNext} aria-label="Foto siguiente">
                    ›
                  </button>
                </div>

                {autoplay && filteredPhotos.length > 1 && (
                  <div className="progressBar">
                    <div
                      key={`prog-${activeIndex}`}
                      className="progressFill"
                      style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="showcaseOverlay" />
            )}
          </div>

          <div className="thumbRail">
            {filteredPhotos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className={`thumbItem ${index === activeIndex ? "active" : ""}`}
                onClick={() => {
                  setAutoplay(false);
                  setActiveIndex(index);
                }}
              >
                <img src={withPublicUrl(photo.src)} alt={photo.title} loading="lazy" />
                <span>{photo.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="galleryToolbar">
        <div className="filters">
          {categories.map((category) => (
            <button
              key={category}
              className={`filterBtn ${selectedCategory === category ? "active" : ""}`}
              onClick={() => {
                setAutoplay(true);
                setSelectedCategory(category);
              }}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="toolbarNote">
          {filteredPhotos.length} foto{filteredPhotos.length !== 1 ? "s" : ""} · Navega con las miniaturas o activa el carrusel
        </div>
      </div>

      <div className="galleryGrid">
        {filteredPhotos.map((photo, index) => (
          <article
            className={`galleryCard ${index === activeIndex ? "isActive" : ""}`}
            key={photo.id}
            onClick={() => {
              setAutoplay(false);
              setActiveIndex(index);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <div className="galleryImageWrap">
              <img src={withPublicUrl(photo.src)} alt={photo.title} loading="lazy" />
              <span className="galleryCategory">{photo.category}</span>
              {index === activeIndex && <span className="galleryActiveBadge">Vista actual</span>}
            </div>
            <div className="galleryInfo">
              <strong>{photo.title}</strong>
              <p>{photo.desc}</p>
              <span className="galleryYear">{photo.year}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Galeria;
