import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import registrosRouter from "./routes/registros.js";
import deudasRouter from "./routes/deudas.js";
import cuentasRouter from "./routes/cuentas.js";
import jerardithRouter from "./routes/jerardith.js";
import movimientosRouter from "./routes/movimientos.js";
import { readDB } from "./db.js";
import {
  leerSesion,
  exigirSesion,
  credencialesValidas,
  setCookieSesion,
  borrarCookieSesion,
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(leerSesion);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/whoami", (req, res) => {
  res.json({ usuario: req.usuario || null });
});

app.post("/api/login", (req, res) => {
  const { usuario, clave } = req.body || {};
  if (!credencialesValidas(usuario, clave)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  setCookieSesion(res, usuario);
  res.json({ ok: true, usuario });
});

app.post("/api/logout", (req, res) => {
  borrarCookieSesion(res);
  res.json({ ok: true });
});

// A partir de aqui, todo requiere sesion (excepto lo de arriba: health,
// whoami, login). En desarrollo local esto no bloquea nada.
app.use("/api", exigirSesion);

app.use("/api/registros", registrosRouter);
app.use("/api/deudas", deudasRouter);
app.use("/api/cuentas", cuentasRouter);
app.use("/api/jerardith", jerardithRouter);
app.use("/api/movimientos", movimientosRouter);

app.get("/api/config", async (req, res) => {
  const db = await readDB();
  res.json({
    config: db.config,
    gastosFijos: db.gastosFijos,
    cuotasRecomendadas: db.cuotasRecomendadas,
  });
});

// En produccion, el cliente se compila en client/dist y este mismo servidor
// lo sirve, para que todo quede en una sola direccion (un solo servicio).
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Tortello Finanzas escuchando en puerto ${PORT}`);
});
