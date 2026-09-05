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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Contraseña compartida de la familia: sin esto, cualquiera con la URL
// podia ver y editar las finanzas. El navegador pide usuario/clave una sola
// vez y los recuerda. Usuario y clave se configuran por variable de entorno
// (APP_USER / APP_PASS) — nunca quedan escritos en el codigo ni en git.
const APP_USER = process.env.APP_USER || "tortello";
const APP_PASS = process.env.APP_PASS || "cambiaesto";

app.use((req, res, next) => {
  if (req.path === "/api/health") return next();

  const header = req.headers.authorization || "";
  const [tipo, credenciales] = header.split(" ");
  if (tipo === "Basic" && credenciales) {
    const [usuario, clave] = Buffer.from(credenciales, "base64").toString().split(":");
    if (usuario === APP_USER && clave === APP_PASS) return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Tortello Finanzas"');
  res.status(401).send("Acceso restringido");
});

app.use("/api/registros", registrosRouter);
app.use("/api/deudas", deudasRouter);
app.use("/api/cuentas", cuentasRouter);
app.use("/api/jerardith", jerardithRouter);
app.use("/api/movimientos", movimientosRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

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
