import { readFile, writeFile, rename, copyFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
