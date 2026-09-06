import { readFile, writeFile, rename, copyFile, mkdir, access } from "fs/promises";
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

let sembrado = false;

async function asegurarDB() {
  if (sembrado) return;

  let existe = true;
  try {
    await access(DB_PATH);
  } catch {
    existe = false;
  }

  // En produccion los datos viven en un volumen que sobrevive a los
  // despliegues, asi que la semilla normalmente NO se aplica. Para
  // reemplazarlos a proposito (ej. una carga historica hecha en local) se
  // pone SEMBRAR_FORZADO=1 en las variables de Railway, se despliega, y
  // se quita. Siempre se guarda antes una copia del archivo que habia.
  const forzar = process.env.SEMBRAR_FORZADO === "1";

  if (!existe || forzar) {
    await mkdir(path.dirname(DB_PATH), { recursive: true });
    if (existe && forzar) {
      const copia = `${DB_PATH}.reemplazado-${Date.now()}.json`;
      await copyFile(DB_PATH, copia).catch(() => {});
      console.log(`SEMBRAR_FORZADO: se reemplazan los datos. Copia previa en ${copia}`);
    }
    await copyFile(SEED_PATH, DB_PATH);
    console.log(
      existe
        ? "finanzas.json reemplazado desde server/seed/finanzas-seed.json"
        : "finanzas.json no existia — sembrado desde server/seed/finanzas-seed.json"
    );
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
