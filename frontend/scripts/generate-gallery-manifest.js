const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const manifestPath = path.join(publicDir, "gallery-manifest.json");
const courtManifestPath = path.join(publicDir, "court-photos-manifest.json");
const validExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const sourceFolders = [
  { folder: "fotosAlumnos", category: "Alumnos", legacy: false },
  { folder: "fotosClase", category: "Clases", legacy: false },
  { folder: "fotosLiga", category: "Liga", legacy: false },
  { folder: "fotos", category: "Alumnos", legacy: true },
];

function toTitle(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferLegacyCategory(fileName) {
  const value = fileName.toLowerCase();
  if (value.includes("clase")) return "Clases";
  if (value.includes("liga")) return "Liga";
  return "Alumnos";
}

function getCategoryMeta(category) {
  if (category === "Clases") {
    return {
      highlight: "Entrenamientos y tecnica",
      desc: "Sesion de entrenamiento y aprendizaje en pista dentro de la escuela.",
    };
  }

  if (category === "Liga") {
    return {
      highlight: "Competicion por equipos",
      desc: "Imagen de una jornada de liga con ritmo competitivo y ambiente de club.",
    };
  }

  return {
    highlight: "Vida del club",
    desc: "Momento destacado de alumnos, premios, partidos y ambiente de la escuela.",
  };
}

function collectPhotosFromFolder(source) {
  const folderPath = path.join(publicDir, source.folder);

  if (!fs.existsSync(folderPath)) {
    return [];
  }

  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => validExtensions.has(path.extname(fileName).toLowerCase()))
    .map((fileName) => {
      const absolutePath = path.join(folderPath, fileName);
      const stats = fs.statSync(absolutePath);
      const category = source.legacy ? inferLegacyCategory(fileName) : source.category;
      const meta = getCategoryMeta(category);

      return {
        title: toTitle(fileName),
        category,
        src: `/${source.folder}/${fileName}`,
        highlight: meta.highlight,
        desc: meta.desc,
        year: String(stats.mtime.getFullYear()),
        sortTime: stats.mtimeMs,
      };
    });
}

const photos = sourceFolders
  .flatMap((source) => collectPhotosFromFolder(source))
  .sort((a, b) => b.sortTime - a.sortTime || a.title.localeCompare(b.title, "es"))
  .map((photo, index) => ({
    id: index + 1,
    title: photo.title,
    category: photo.category,
    src: photo.src,
    highlight: photo.highlight,
    desc: photo.desc,
    year: photo.year,
  }));

const manifest = {
  generatedAt: new Date().toISOString(),
  categories: ["Todas", "Alumnos", "Clases", "Liga"],
  photos,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const courtPhotos = collectPhotosFromFolder({
  folder: "fotosPista",
  category: "Pista",
  legacy: false,
}).map((photo, index) => ({
  id: index + 1,
  title: photo.title,
  src: photo.src,
  desc: "Vista de las pistas y del entorno del club para acompanar el estado de juego.",
}));

const courtManifest = {
  generatedAt: new Date().toISOString(),
  photos: courtPhotos,
};

fs.writeFileSync(courtManifestPath, `${JSON.stringify(courtManifest, null, 2)}\n`, "utf8");
console.log(`Generated gallery manifest with ${photos.length} photos.`);
