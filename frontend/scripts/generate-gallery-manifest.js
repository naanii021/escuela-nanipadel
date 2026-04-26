const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const photosDir = path.join(rootDir, "public", "fotos");
const manifestPath = path.join(photosDir, "gallery-manifest.json");
const validExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function toTitle(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferCategory(fileName) {
  const value = fileName.toLowerCase();

  if (value.includes("clase")) return "Clases";
  if (value.includes("premio")) return "Premios";
  if (value.includes("liga")) return "Liga";
  if (value.includes("torneo")) return "Competiciones";
  if (value.includes("vs")) return "Competiciones";
  if (value.includes("equipo")) return "Equipo";

  return "Club";
}

function inferHighlight(category) {
  if (category === "Clases") return "Entrenamiento en la escuela";
  if (category === "Premios") return "Entrega de premios";
  if (category === "Liga") return "Jornada de liga";
  if (category === "Competiciones") return "Partido de competicion";
  if (category === "Equipo") return "Momentos de equipo";
  return "Vida de club";
}

function inferDescription(title, category) {
  if (category === "Clases") return `Imagen de ${title.toLowerCase()} durante una sesion de entrenamiento en pista.`;
  if (category === "Premios") return `Foto de ${title.toLowerCase()} en una entrega de premios o celebracion del club.`;
  if (category === "Liga") return `Instantanea de ${title.toLowerCase()} durante una jornada de liga del club.`;
  if (category === "Competiciones") return `Momento de ${title.toLowerCase()} capturado en una jornada de competicion.`;
  if (category === "Equipo") return `Foto de ${title.toLowerCase()} relacionada con la preparacion y el ambiente de equipo.`;
  return `Imagen de ${title.toLowerCase()} dentro de la vida diaria del club.`;
}

if (!fs.existsSync(photosDir)) {
  throw new Error(`No existe la carpeta de fotos: ${photosDir}`);
}

const files = fs
  .readdirSync(photosDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((fileName) => validExtensions.has(path.extname(fileName).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, "es"));

const photos = files.map((fileName, index) => {
  const title = toTitle(fileName);
  const category = inferCategory(fileName);
  const stats = fs.statSync(path.join(photosDir, fileName));

  return {
    id: index + 1,
    title,
    category,
    src: `/fotos/${fileName}`,
    highlight: inferHighlight(category),
    desc: inferDescription(title, category),
    year: String(stats.mtime.getFullYear()),
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  photos,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated gallery manifest with ${photos.length} photos.`);
