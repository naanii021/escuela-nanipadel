function GalleryFilters({ filters, selectedCategory, onChange }) {
  return (
    <div className="galleryFilters" role="tablist" aria-label="Filtrar galeria">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          role="tab"
          aria-selected={selectedCategory === filter}
          className={`galleryFilterBtn ${selectedCategory === filter ? "active" : ""}`}
          onClick={() => onChange(filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

export default GalleryFilters;
