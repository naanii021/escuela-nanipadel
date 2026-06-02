import "./env.js";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Falta JWT_SECRET en el entorno");
  }

  return secret;
}

export const JWT_SECRET = getJwtSecret();
