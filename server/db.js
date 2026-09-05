import { readFile, writeFile, rename, copyFile } from "fs/promises";
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

export async function readDB() {
  const raw = await readFile(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function writeDB(data) {
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
  // del pasado sin depender de nada mas que este repositorio.
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
