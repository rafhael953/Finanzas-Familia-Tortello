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
import categoriasRouter from "./routes/categorias.js";
import planRouter from "./routes/plan.js";
import { readDB, withDB, listarRespaldos, obtenerRespaldo } from "./db.js";
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
app.use("/api/categorias", categoriasRouter);
app.use("/api/plan", planRouter);

// Descarga todo lo registrado, tal cual esta guardado. Sirve como copia
// de seguridad y para traer lo del celular al computador cuando haya que
// trabajar con los datos de verdad.
app.get("/api/respaldo", async (req, res) => {
  const db = await readDB();
  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Disposition", `attachment; filename="finanzas-${fecha}.json"`);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(db, null, 2));
});

// Copias de seguridad guardadas en Supabase antes de cada escritura. Sirven
// para recuperar algo que se haya perdido sin tener que entrar al servidor.
app.get("/api/respaldos", async (req, res) => {
  res.json(await listarRespaldos());
});

app.get("/api/respaldos/:nombre", async (req, res) => {
  const nombre = req.params.nombre;
  const datos = await obtenerRespaldo(nombre);
  if (!datos) return res.status(404).json({ error: "No existe ese respaldo" });
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(datos, null, 2));
});

app.get("/api/config", async (req, res) => {
  const db = await readDB();
  res.json({
    config: db.config,
    gastosFijos: db.gastosFijos,
    cuotasRecomendadas: db.cuotasRecomendadas,
  });
});

// Valores de configuracion que se ajustan a mano desde la app (la TRM
// cambia todos los dias, el abono extra depende de cuanto se quiera
// meterle de mas a las deudas ese mes).
const CONFIG_EDITABLE = ["trm", "abonoExtraMensual", "rendNU", "cupoTarjetasMensual", "saldoInicialReal"];

app.put("/api/config", async (req, res) => {
  const { campo, valor } = req.body || {};
  if (!CONFIG_EDITABLE.includes(campo)) {
    return res.status(400).json({ error: "Ese valor no se puede editar" });
  }
  const num = Number(valor);
  if (!Number.isFinite(num) || num < 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }
  await withDB(async (db) => {
    db.config[campo] = num;
  });
  res.json({ ok: true, campo, valor: num });
});

// En Vercel el cliente lo sirve la plataforma como sitio estatico (ver
// vercel.json), asi que este bloque solo aplica a Railway/local, donde el
// mismo servidor Express sirve tambien client/dist.
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");
if (!process.env.VERCEL && existsSync(CLIENT_DIST)) {
  // Los archivos de /assets llevan un hash en el nombre y cambian en cada
  // despliegue, asi que se pueden cachear para siempre sin riesgo.
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: "1y" }));

  // Un /assets que no existe tiene que dar 404, NO el index.html. Si se
  // responde con HTML, el navegador recibe una pagina donde esperaba un
  // modulo de JavaScript, se niega a ejecutarla y la app queda en blanco
  // sin ningun mensaje. Pasa cuando el celular tiene guardado un index.html
  // viejo que pide un archivo del despliegue anterior.
  app.get(/^\/assets\//, (req, res) => res.status(404).end());

  app.get(/^(?!\/api).*/, (req, res) => {
    // El index.html nunca se cachea: es el que dice cuales son los archivos
    // buenos de esta version. Si el navegador se queda con uno viejo, sigue
    // pidiendo archivos que ya no existen.
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

// En Vercel no hay que escuchar un puerto: la plataforma invoca este mismo
// app (ver api/index.js) como funcion serverless en cada request.
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor Tortello Finanzas escuchando en puerto ${PORT}`);
  });
}

export default app;
