import { useEffect, useMemo, useState } from "react";
import "./galeria.css";

const PHOTOS = [
  {
    id: 1,
    title: "Final del torneo social",
    category: "Competiciones",
    src: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1600&q=80",
    highlight: "Ambiente de partido y grada",
    desc: "Fin de semana de torneo con pistas llenas, publico y finales muy igualadas.",
  },
  {
    id: 2,
    title: "Entrenamiento tecnico",
    category: "Clases",
    src: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1600&q=80",
    highlight: "Trabajo de bandeja y volea",
    desc: "Sesion de tecnica con correcciones en vivo y grupos reducidos.",
  },
  {
    id: 3,
    title: "Jornada de club",
    category: "Club",
    src: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1600&q=80",
    highlight: "Comunidad y buen ambiente",
    desc: "Momentos del club, convivencias y actividades fuera de la pista.",
  },
  {
    id: 4,
    title: "Equipo Norba",
    category: "Equipo",
    src: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1600&q=80",
    highlight: "Foto oficial de temporada",
    desc: "Jugadores, profes y staff compartiendo una jornada especial.",
  },
  {
    id: 5,
    title: "Clinic de volea",
    category: "Clases",
    src: "https://images.unsplash.com/photo-1603112579965-7a0c1e3b7a4f?auto=format&fit=crop&w=1600&q=80",
    highlight: "Correccion tecnica personalizada",
    desc: "Sesiones intensivas para mejorar control, posicion y definicion en red.",
  },
  {
    id: 6,
    title: "Partido amistoso al atardecer",
    category: "Competiciones",
    src: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1600&q=80",
    highlight: "Padel con luz dorada",
    desc: "Uno de esos partidos que resumen el ambiente de escuela y club.",
  },
  {
    id: 7,
    title: "Dia de cantera",
    category: "Club",
    src: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1600&q=80",
    highlight: "Base y progresion",
    desc: "Actividades con menores y seguimiento de evolucion durante la temporada.",
  },
  {
    id: 8,
    title: "Preparacion de equipo",
    category: "Equipo",
    src: "https://images.unsplash.com/photo-1505250469679-203ad9ced0cb?auto=format&fit=crop&w=1600&q=80",
    highlight: "Trabajo fisico y tactico",
    desc: "Preparacion previa a jornadas de liga y competicion interna.",
  },
];

const CATEGORIES = ["Todas", "Competiciones", "Clases", "Club", "Equipo"];

function Galeria() {
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const filteredPhotos = useMemo(() => {
    return selectedCategory === "Todas"
      ? PHOTOS
      : PHOTOS.filter((photo) => photo.category === selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    setActiveIndex(0);
  }, [selectedCategory]);

  useEffect(() => {
    if (!autoplay || filteredPhotos.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % filteredPhotos.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [autoplay, filteredPhotos]);

  const activePhoto = filteredPhotos[activeIndex] || PHOTOS[0];

  const goPrev = () => {
    setAutoplay(false);
    setActiveIndex((current) => (current - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  const goNext = () => {
    setAutoplay(false);
    setActiveIndex((current) => (current + 1) % filteredPhotos.length);
  };

  return (
    <section className="galeria">
      <div className="galeriaHero">
        <div className="galeriaHeroText">
          <div className="galeriaPill">Momentos del club</div>
          <h2>Galeria</h2>
          <p className="galeriaIntro">
            Recoge torneos, entrenamientos y vida de club en un formato mas visual, dinamico y facil de explorar.
          </p>

          <div className="galeriaStats">
            <div className="galeriaStat">
              <strong>{filteredPhotos.length}</strong>
              <span>imagenes</span>
            </div>
            <div className="galeriaStat">
              <strong>{CATEGORIES.length - 1}</strong>
              <span>categorias</span>
            </div>
            <div className="galeriaStat">
              <strong>{autoplay ? "ON" : "OFF"}</strong>
              <span>carrusel</span>
            </div>
          </div>
        </div>

        <div
          className="showcaseCard"
          onMouseEnter={() => setAutoplay(false)}
          onMouseLeave={() => setAutoplay(true)}
        >
          <div className="showcaseImageWrap">
            <img src={activePhoto.src} alt={activePhoto.title} loading="eager" />
            <div className="showcaseOverlay" />

            <div className="showcaseTop">
              <span className="showcaseTag">{activePhoto.category}</span>
              <button
                type="button"
                className={`autoBtn ${autoplay ? "active" : ""}`}
                onClick={() => setAutoplay((value) => !value)}
              >
                {autoplay ? "Auto" : "Pausa"}
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
              <button type="button" className="navBtn" onClick={goNext} aria-label="Foto siguiente">
                ›
              </button>
            </div>
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
          Navega con las miniaturas o deja el modo automatico para ver la galeria como carrusel.
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
            }}
          >
            <div className="galleryImageWrap">
              <img src={photo.src} alt={photo.title} loading="lazy" />
              <span className="galleryCategory">{photo.category}</span>
            </div>

            <div className="galleryInfo">
              <strong>{photo.title}</strong>
              <p>{photo.desc}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="galleryHint">
        <strong>Siguiente mejora</strong>
        <span>
          Podemos conectar esta seccion con backend para subir fotos reales del club, crear albumes y abrir cada imagen en modal completa.
        </span>
      </div>
    </section>
  );
}

export default Galeria;
