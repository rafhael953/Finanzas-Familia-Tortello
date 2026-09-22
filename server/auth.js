import crypto from "crypto";

const SECRET = process.env.APP_SECRET || process.env.APP_PASS || "cambiaesto-secreto";
const APP_USERS = (process.env.APP_USERS || "tortello")
  .split(",")
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);
const APP_PASS = process.env.APP_PASS || "cambiaesto";
const EXIGIR_AUTH = !!process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL_ENV === "production";

function firmar(valor) {
  return crypto.createHmac("sha256", SECRET).update(valor).digest("hex");
}

export function credencialesValidas(usuario, clave) {
  return APP_USERS.includes((usuario || "").trim().toLowerCase()) && clave === APP_PASS;
}

export function crearToken(usuario) {
  const payload = Buffer.from(usuario).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

export function usuarioDeToken(token) {
  if (!token) return null;
  const [payload, firma] = token.split(".");
  if (!payload || !firma) return null;
  if (firmar(payload) !== firma) return null;
  try {
    return Buffer.from(payload, "base64url").toString();
  } catch {
    return null;
  }
}

function leerCookie(req, nombre) {
  const header = req.headers.cookie || "";
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(nombre + "="));
  return match ? decodeURIComponent(match.slice(nombre.length + 1)) : null;
}

// Middleware: adjunta req.usuario si hay sesion valida. No bloquea nada por
// si solo (eso lo hace exigirSesion), asi /api/whoami puede responder libre.
export function leerSesion(req, res, next) {
  const token = leerCookie(req, "sesion");
  req.usuario = usuarioDeToken(token) || (!EXIGIR_AUTH ? APP_USERS[0] : null);
  next();
}

// Bloquea si EXIGIR_AUTH esta activo (Railway) y no hay sesion valida.
// En desarrollo local se deja pasar siempre, para no complicar el trabajo diario.
export function exigirSesion(req, res, next) {
  if (!EXIGIR_AUTH) {
    req.usuario = req.usuario || APP_USERS[0];
    return next();
  }
  if (req.usuario) return next();
  res.status(401).json({ error: "No autenticado" });
}

export const AUTH_CONFIG = { EXIGIR_AUTH };

export function setCookieSesion(res, usuario) {
  const token = crearToken(usuario);
  const partes = [
    `sesion=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 60}`, // 60 dias
  ];
  if (EXIGIR_AUTH) partes.push("Secure");
  res.setHeader("Set-Cookie", partes.join("; "));
}

export function borrarCookieSesion(res) {
  res.setHeader("Set-Cookie", "sesion=; Path=/; HttpOnly; Max-Age=0");
}
