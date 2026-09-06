import { readFile, writeFile, rename, copyFile, mkdir, access, stat, readdir } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(__dirname, "data", "finanzas.json");
const TMP_PATH = DB_PATH + ".tmp";
const BACKUP_PATH = DB_PATH + ".bak";
// La semilla vive FUERA de server/data a proposito: si en produccion se
// monta un volumen persistente en server/data, ese volumen puede llegar
// vacio la primera vez y tapar el archivo que traia el codigo. Al estar
// afuera, la semilla siempre esta disponible para reponer los datos.
const SEED_PATH = path.join(__dirname, "seed", "finanzas-seed.json");
// Marca en el volumen que recuerda cual fue el ultimo reemplazo aplicado,
// para que una variable olvidada no vuelva a pisar los datos en cada arranque.
const MARCA_PATH = path.join(__dirname, "data", ".ultimo-reemplazo");

let sembrado = false;

// Agrega a los datos que ya existen los movimientos de la semilla que
// falten (comparando por id), SIN tocar lo que ya estaba. Se usa para
// llevar a produccion una carga historica hecha en local sin perder lo
// que se haya registrado desde el celular mientras tanto.
async function fusionarConSemilla() {
  const actual = JSON.parse(await readFile(DB_PATH, "utf-8"));
  const semilla = JSON.parse(await readFile(SEED_PATH, "utf-8"));

  const idsActuales = new Set((actual.movimientos || []).map((m) => m.id));
  const nuevos = (semilla.movimientos || []).filter((m) => !idsActuales.has(m.id));

  if (nuevos.length === 0) {
    console.log("IMPORTAR_HISTORIA: no hay movimientos nuevos que agregar.");
    return;
  }

  const copia = `${DB_PATH}.antes-de-importar-${Date.now()}.json`;
  await copyFile(DB_PATH, copia).catch(() => {});

  // Cada pago historico que se agrega tiene que sumarse al saldo inicial
  // de esa deuda, o el saldo actual (que es el correcto) se desplomaria.
  // Se calcula desde los movimientos que de verdad se estan agregando,
  // asi el ajuste es exacto sin importar como estuvieran los datos.
  actual.deudasIniciales = actual.deudasIniciales || {};
  for (const m of nuevos) {
    if (m.tipo === "deuda") {
      actual.deudasIniciales[m.categoria] = (actual.deudasIniciales[m.categoria] || 0) + m.monto;
    }
  }

  // Deudas que solo existen en la carga historica (ya saldadas).
  actual.cuotasRecomendadas = actual.cuotasRecomendadas || {};
  actual.deudasFechaCreacion = actual.deudasFechaCreacion || {};
  for (const cat of Object.keys(actual.deudasIniciales)) {
    if (actual.cuotasRecomendadas[cat] === undefined) actual.cuotasRecomendadas[cat] = 0;
    if (!actual.deudasFechaCreacion[cat]) actual.deudasFechaCreacion[cat] = "2026-01";
  }

  // Configuracion que viene con la carga y que no borra nada existente.
  if (semilla.presupuestoIdeal) actual.presupuestoIdeal = semilla.presupuestoIdeal;
  actual.categoriasPersonalizadas = actual.categoriasPersonalizadas || {};
  for (const tipo of Object.keys(semilla.categoriasPersonalizadas || {})) {
    actual.categoriasPersonalizadas[tipo] = {
      ...(semilla.categoriasPersonalizadas[tipo] || {}),
      ...(actual.categoriasPersonalizadas[tipo] || {}),
    };
  }

  actual.movimientos = [...nuevos, ...(actual.movimientos || [])];

  await writeFile(TMP_PATH, JSON.stringify(actual, null, 2), "utf-8");
  await rename(TMP_PATH, DB_PATH);
  console.log(
    `IMPORTAR_HISTORIA: se agregaron ${nuevos.length} movimientos. Copia previa en ${copia}`
  );
}

// Reemplazo completo de los datos por la semilla. Es la operacion mas
// destructiva que existe aca, asi que tiene tres seguros:
//
//   1. Si en produccion hay movimientos que la semilla no trae, NO reemplaza.
//      Esos movimientos son lo que se registro desde el celular; pisarlos es
//      justo lo que nunca se debe hacer. Se puede insistir a proposito con
//      REEMPLAZAR_DATOS=FORZAR.
//   2. Se desarma solo: deja una marca en el volumen con la senal usada, para
//      que no se vuelva a ejecutar en cada arranque si la variable queda
//      puesta por olvido.
//   3. Siempre guarda una copia de lo que habia antes, descargable desde
//      /api/respaldos.
async function reemplazarConSemilla() {
  const modo = process.env.REEMPLAZAR_DATOS;
  const senal = `${modo}:${(await stat(SEED_PATH)).mtimeMs}`;

  const yaHecho = await readFile(MARCA_PATH, "utf-8").catch(() => null);
  if (yaHecho === senal) {
    console.log(
      "REEMPLAZAR_DATOS: este reemplazo ya se hizo antes; no se repite. " +
        "Puedes borrar la variable en Railway."
    );
    return;
  }

  const actual = JSON.parse(await readFile(DB_PATH, "utf-8"));
  const idsSemilla = new Set((JSON.parse(await readFile(SEED_PATH, "utf-8")).movimientos || []).map((m) => m.id));
  const soloEnProduccion = (actual.movimientos || []).filter((m) => !idsSemilla.has(m.id));

  if (soloEnProduccion.length > 0 && modo !== "FORZAR") {
    console.error(
      `REEMPLAZAR_DATOS: CANCELADO. Aqui hay ${soloEnProduccion.length} movimientos ` +
        `que la semilla no trae y se perderian:\n` +
        soloEnProduccion
          .slice(0, 20)
          .map((m) => `  - ${m.fecha} ${m.tipo} ${m.categoria} ${m.monto} ${m.descripcion || ""}`)
          .join("\n") +
        `\nBaja el respaldo desde /api/respaldos, incorpora eso a la semilla y vuelve a intentar. ` +
        `Si de verdad quieres borrarlos, usa REEMPLAZAR_DATOS=FORZAR.`
    );
    return;
  }

  const copia = `${DB_PATH}.reemplazado-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  await copyFile(DB_PATH, copia).catch(() => {});
  await copyFile(SEED_PATH, DB_PATH);
  await writeFile(MARCA_PATH, senal, "utf-8").catch(() => {});
  console.log(
    `REEMPLAZAR_DATOS: datos reemplazados (se descartaron ${soloEnProduccion.length} movimientos ` +
      `propios de produccion). Copia previa en ${copia}`
  );
}

async function asegurarDB() {
  if (sembrado) return;

  let existe = true;
  try {
    await access(DB_PATH);
  } catch {
    existe = false;
  }

  if (!existe) {
    // Volumen nuevo o vacio: se parte de la semilla.
    await mkdir(path.dirname(DB_PATH), { recursive: true });
    await copyFile(SEED_PATH, DB_PATH);
    console.log("finanzas.json no existia — sembrado desde server/seed/finanzas-seed.json");
  } else if (process.env.IMPORTAR_HISTORIA === "1") {
    // En produccion los datos viven en un volumen que sobrevive a los
    // despliegues, asi que la semilla normalmente no se aplica. Con esta
    // variable se agregan (no se reemplazan) los movimientos que falten.
    await fusionarConSemilla();
  } else if (process.env.REEMPLAZAR_DATOS) {
    await reemplazarConSemilla();
  }

  sembrado = true;
}

export async function readDB() {
  await asegurarDB();
  const raw = await readFile(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function writeDB(data) {
  await asegurarDB();
  // Respaldo del estado anterior antes de sobreescribir, por si algo sale mal.
  await copyFile(DB_PATH, BACKUP_PATH).catch(() => {});

  const json = JSON.stringify(data, null, 2);
  // Escritura atomica: escribe a un archivo temporal y lo reemplaza de un
  // solo golpe (rename), para que nunca quede un finanzas.json truncado o
  // a medio escribir si algo falla en el proceso.
  await writeFile(TMP_PATH, json, "utf-8");
  await rename(TMP_PATH, DB_PATH);

  // Historial permanente: cada cambio queda como un commit de git con fecha,
  // para poder ver/recuperar el estado de las finanzas en cualquier momento
  // del pasado sin depender de nada mas que este repositorio. En produccion
  // (sin credenciales de git) esto simplemente no hace nada, en silencio.
  commitSilencioso().catch(() => {});
}

async function commitSilencioso() {
  const opts = { cwd: PROJECT_ROOT, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } };
  await execFileAsync("git", ["add", "server/data/finanzas.json"], opts);
  const fecha = new Date().toISOString().slice(0, 19).replace("T", " ");
  const huboCommit = await execFileAsync(
    "git",
    ["commit", "-m", `Actualizacion de datos: ${fecha}`, "--allow-empty-message", "-q"],
    opts
  )
    .then(() => true)
    .catch(() => false); // si no hay cambios reales, git commit falla, y esta bien

  if (huboCommit) {
    // Respaldo fuera de esta computadora: sube el commit a GitHub de inmediato.
    // Si no hay internet o falla, no rompe el guardado local — solo se queda
    // pendiente de subir en el proximo cambio.
    await execFileAsync("git", ["push", "origin", "main"], opts).catch(() => {});
  }
}

// Cola de escritura: serializa cada ciclo leer->modificar->escribir para que
// dos requests concurrentes (ej. dos clics casi simultaneos) nunca se pisen
// y uno termine borrando los cambios del otro.
let cola = Promise.resolve();

export function withDB(mutador) {
  const tarea = cola.then(async () => {
    const db = await readDB();
    const resultado = await mutador(db);
    await writeDB(db);
    return resultado;
  });
  // Si esta tarea falla, no debe tumbar la cola para las siguientes.
  cola = tarea.catch(() => {});
  return tarea;
}

// Para que las rutas puedan listar y servir las copias de seguridad que
// quedan guardadas en el volumen.
export function carpetaDatos() {
  return path.dirname(DB_PATH);
}

export async function listarRespaldos() {
  const dir = carpetaDatos();
  const archivos = await readdir(dir).catch(() => []);
  // Se incluye el .bak (el estado justo antes de la ultima escritura), que
  // es el que sirve cuando se borro algo por accidente hace un momento.
  const copias = archivos.filter(
    (a) => a.startsWith("finanzas.json.") && (a.endsWith(".json") || a.endsWith(".bak"))
  );
  const info = [];
  for (const nombre of copias) {
    const ruta = path.join(dir, nombre);
    const st = await stat(ruta).catch(() => null);
    if (!st) continue;
    let movimientos = null;
    try {
      movimientos = (JSON.parse(await readFile(ruta, "utf-8")).movimientos || []).length;
    } catch {}
    info.push({ nombre, fecha: st.mtime.toISOString(), bytes: st.size, movimientos });
  }
  return info.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
