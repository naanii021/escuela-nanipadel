import { useEffect, useMemo, useState } from "react";
import "./galeria.css";

const AUTOPLAY_MS = 4200;
const NEWS_MS = 5500;

const PHOTOS = [
  {
    id: 1,
    title: "Final del torneo social",
    category: "Competiciones",
    src: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1600&q=80",
    highlight: "Ambiente de partido y grada",
    desc: "Fin de semana de torneo con pistas llenas, público y finales muy igualadas.",
    year: "2026",
  },
  {
    id: 2,
    title: "Entrenamiento técnico",
    category: "Clases",
    src: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1600&q=80",
    highlight: "Trabajo de bandeja y volea",
    desc: "Sesión de técnica con correcciones en vivo y grupos reducidos de máximo 4 jugadores.",
    year: "2026",
  },
  {
    id: 3,
    title: "Jornada de club",
    category: "Club",
    src: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80",
    highlight: "Comunidad y buen ambiente",
    desc: "Momentos del club, convivencias y actividades fuera de la pista que unen a todos.",
    year: "2025",
  },
  {
    id: 4,
    title: "Equipo Norba",
    category: "Equipo",
    src: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1600&q=80",
    highlight: "Foto oficial de temporada",
    desc: "Jugadores, profes y staff compartiendo una jornada especial de inicio de temporada.",
    year: "2025",
  },
  {
    id: 5,
    title: "Clinic de volea",
    category: "Clases",
    src: "https://images.unsplash.com/photo-1593341646782-e0b495cff86d?auto=format&fit=crop&w=1600&q=80",
    highlight: "Corrección técnica personalizada",
    desc: "Sesiones intensivas para mejorar control, posición y definición en la red.",
    year: "2026",
  },
  {
    id: 6,
    title: "Partido al atardecer",
    category: "Competiciones",
    src: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1600&q=80",
    highlight: "Pádel con luz dorada",
    desc: "Uno de esos partidos que resumen perfectamente el ambiente de escuela y club.",
    year: "2026",
  },
  {
    id: 7,
    title: "Día de cantera",
    category: "Club",
    src: "https://images.unsplash.com/photo-1484357176978-f27a41acd48d?auto=format&fit=crop&w=1600&q=80",
    highlight: "Base y progresión",
    desc: "Actividades con los más jóvenes del club y seguimiento de evolución en temporada.",
    year: "2025",
  },
  {
    id: 8,
    title: "Preparación de equipo",
    category: "Equipo",
    src: "https://images.unsplash.com/photo-1540479859555-17af45c78602?auto=format&fit=crop&w=1600&q=80",
    highlight: "Trabajo físico y táctico",
    desc: "Preparación previa a jornadas de liga y competición interna del club.",
    year: "2025",
  },
];

const NEWS = [
  {
    id: 1,
    tag: "Torneo",
    tagColor: "amber",
    title: "Torneo de Primavera — inscripciones abiertas",
    body: "El 3 de mayo arranca el torneo social de primavera. Plazas limitadas para todas las categorías, ¡apúntate cuanto antes!",
    date: "17 abr 2026",
  },
  {
    id: 2,
    tag: "Clases",
    tagColor: "blue",
    title: "Nuevo horario de clases para mayo",
    body: "Añadimos sesiones de mañana los martes y jueves desde el 1 de mayo para nivel iniciación y perfeccionamiento.",
    date: "15 abr 2026",
  },
  {
    id: 3,
    tag: "Pistas",
    tagColor: "green",
    title: "Pista 3 renovada con cristal panorámico",
    body: "Ya disponible la pista 3 tras su renovación con nueva iluminación LED y cristal de alta calidad panorámico.",
    date: "10 abr 2026",
  },
  {
    id: 4,
    tag: "Evento",
    tagColor: "purple",
    title: "Puertas abiertas — domingo 27 de abril",
    body: "Invita a tus amigos a probar el pádel gratis. Sesiones guiadas de 10h a 14h sin necesidad de reserva previa.",
    date: "5 abr 2026",
  },
  {
    id: 5,
    tag: "Liga",
    tagColor: "rose",
    title: "Clasificación actualizada tras la ronda 4",
    body: "El equipo B lidera la tabla con 3 victorias consecutivas. Consulta la clasificación completa en el panel.",
    date: "14 abr 2026",
  },
];

const CATEGORIES = ["Todas", "Competiciones", "Clases", "Club", "Equipo"];

function Galeria() {
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [imgKey, setImgKey] = useState(0);
  const [newsIndex, setNewsIndex] = useState(0);
  const [newsVisible, setNewsVisible] = useState(true);
  const [newsReset, setNewsReset] = useState(0);

  const filteredPhotos = useMemo(() => {
    return selectedCategory === "Todas"
      ? PHOTOS
      : PHOTOS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    setActiveIndex(0);
  }, [selectedCategory]);

  useEffect(() => {
    setImgKey((k) => k + 1);
  }, [activeIndex]);

  useEffect(() => {
    if (!autoplay || filteredPhotos.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % filteredPhotos.length);
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
      setNewsIndex((i) => (i + 1) % NEWS.length);
      setNewsVisible(true);
    }, 320);
    return () => window.clearTimeout(id);
  }, [newsVisible]);

  const activePhoto = filteredPhotos[activeIndex] || PHOTOS[0];
  const activeNews = NEWS[newsIndex];

  const goPrev = () => {
    setAutoplay(false);
    setActiveIndex((i) => (i - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  const goNext = () => {
    setAutoplay(false);
    setActiveIndex((i) => (i + 1) % filteredPhotos.length);
  };

  const selectNews = (i) => {
    setNewsVisible(false);
    window.setTimeout(() => {
      setNewsIndex(i);
      setNewsVisible(true);
      setNewsReset((r) => r + 1);
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
          <h2>Galería</h2>
          <p className="galeriaIntro">
            Torneos, entrenamientos y vida de club en un formato visual, dinámico y fácil de explorar.
          </p>

          <div className="galeriaStats">
            <div className="galeriaStat">
              <strong>{PHOTOS.length}</strong>
              <span>Fotos</span>
            </div>
            <div className="galeriaStat">
              <strong>{CATEGORIES.length - 1}</strong>
              <span>Categorías</span>
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
              <span className="galeriaNewsLabel">Últimas noticias</span>
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
              {NEWS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`newsDot ${i === newsIndex ? "active" : ""}`}
                  onClick={() => selectNews(i)}
                  aria-label={`Noticia ${i + 1}`}
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
            <img
              key={imgKey}
              src={activePhoto.src}
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
                onClick={() => setAutoplay((v) => !v)}
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

            {autoplay && (
              <div className="progressBar">
                <div
                  key={`prog-${activeIndex}`}
                  className="progressFill"
                  style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                />
              </div>
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
                <img src={photo.src} alt={photo.title} loading="lazy" />
                <span>{photo.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="galleryToolbar">
        <div className="filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filterBtn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => {
                setAutoplay(true);
                setSelectedCategory(cat);
              }}
            >
              {cat}
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
              <img src={photo.src} alt={photo.title} loading="lazy" />
              <span className="galleryCategory">{photo.category}</span>
              {index === activeIndex && (
                <span className="galleryActiveBadge">Vista actual</span>
              )}
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
