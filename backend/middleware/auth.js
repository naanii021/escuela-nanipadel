import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "nanipadel_secret_2026";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).type("application/json").json({ ok: false, message: "No autorizado" });
  }

  try {
    req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).type("application/json").json({ ok: false, message: "Token invalido o expirado" });
  }
}

export function requireRoles(allowedRoles = []) {
  const normalizedAllowed = allowedRoles.map((role) => String(role).toLowerCase());

  return (req, res, next) => {
    const userRole = String(req.user?.rol || "").toLowerCase();

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).type("application/json").json({ ok: false, message: "No tienes permisos para acceder a esta zona" });
    }

    next();
  };
}
