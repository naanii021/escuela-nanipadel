import { useMemo, useState } from "react";
import "./galeria.css";

// Página de galería
function Galeria() {
  // Categorías disponibles
  const categories = ["Todas", "Competiciones", "Clases", "Club", "Equipo"];

  // Fotos mock (luego las traeremos del backend)
  const photos = useMemo(
    () => [
      {
        id: 1,
        title: "Final del torneo social",
        category: "Competiciones",
        src: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1400&q=80",
      },
      {
        id: 2,
        title: "Entrenamiento técnico",
        category: "Clases",
        src: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1400&q=80",
      },
      {
        id: 3,
        title: "Día de club",
        category: "Club",
        src: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80",
      },
      {
        id: 4,
        title: "Foto de equipo",
        category: "Equipo",
        src: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1400&q=80",
      },
      {
        id: 5,
        title: "Clínic de volea",
        category: "Clases",
        src: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1400&q=80",
      },
      {
        id: 6,
        title: "Partido amistoso",
        category: "Competiciones",
        src: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80",
      },
    ],
    []
  );

  const [selectedCategory, setSelectedCategory] = useState("Todas");

  // Filtrado según categoría
  const filteredPhotos =
    selectedCategory === "Todas"
      ? photos
      : photos.filter((p) => p.category === selectedCategory);

  return (
    <section className="galeria">
      <div className="galeriaHeader">
        <div>
          <h2>Galería</h2>
          <p className="muted">
            Fotos de competiciones, clases y momentos del club.
          </p>
        </div>

        {/* Filtros */}
        <div className="filters">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filterBtn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de imágenes */}
      <div className="grid">
        {filteredPhotos.map((photo) => (
          <article className="tile card" key={photo.id}>
            <div className="imgWrap">
              <img src={photo.src} alt={photo.title} loading="lazy" />
            </div>
            <div className="tileInfo">
              <strong>{photo.title}</strong>
              <span className="muted">{photo.category}</span>
            </div>
          </article>
        ))}
      </div>

      {/* Nota: más adelante aquí meteremos subida real */}
      <div className="hint card">
        <strong>Próximamente:</strong>
        <span className="muted">
          Subida de fotos con cuenta de admin/profe y almacenamiento en servidor.
        </span>
      </div>
    </section>
  );
}

export default Galeria;
