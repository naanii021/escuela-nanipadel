import { useEffect } from "react";

function GalleryLightbox({ photos, activeIndex, onClose, onPrev, onNext, resolveSrc }) {
  const activePhoto = activeIndex !== null ? photos[activeIndex] : null;

  useEffect(() => {
    if (!activePhoto) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activePhoto, onClose, onPrev, onNext]);

  if (!activePhoto) return null;

  return (
    <div className="galleryLightbox" onClick={onClose} role="dialog" aria-modal="true">
      <div className="galleryLightboxDialog" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="lightboxClose" onClick={onClose} aria-label="Cerrar visor">
          ×
        </button>

        <button type="button" className="lightboxNav lightboxPrev" onClick={onPrev} aria-label="Imagen anterior">
          ‹
        </button>
        <button type="button" className="lightboxNav lightboxNext" onClick={onNext} aria-label="Imagen siguiente">
          ›
        </button>

        <div className="lightboxMedia">
          <img src={resolveSrc(activePhoto.src)} alt={activePhoto.title} />
        </div>

        <div className="lightboxInfo">
          <span className="lightboxTag">{activePhoto.category}</span>
          <strong>{activePhoto.title}</strong>
          <p>{activePhoto.desc}</p>
          <span className="lightboxCounter">
            {activeIndex + 1} / {photos.length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GalleryLightbox;
