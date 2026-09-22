import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { supabase } from "./supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// La semilla sigue viviendo en el repo (no en Supabase) para poder poblar
// una base nueva la primera vez que se despliega, o para reponer datos a
// mano si hace falta. Una vez que Supabase tiene la fila "actual", la
// semilla ya no se vuelve a tocar sola.
const SEED_PATH = path.join(__dirname, "seed", "finanzas-seed.json");

const ESTADO_TABLA = "finanzas_estado";
const RESPALDOS_TABLA = "finanzas_respaldos";
const ESTADO_ID = "actual";

let sembrado = false;

async function asegurarEstado() {
  if (sembrado) return;

  const { data, error } = await supabase
    .from(ESTADO_TABLA)
    .select("id")
    .eq("id", ESTADO_ID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const semilla = JSON.parse(await readFile(SEED_PATH, "utf-8"));
    const { error: insertError } = await supabase
      .from(ESTADO_TABLA)
      .insert({ id: ESTADO_ID, data: semilla });
    if (insertError) throw insertError;
    console.log("finanzas_estado no existia — sembrado desde server/seed/finanzas-seed.json");
  }

  sembrado = true;
}

export async function readDB() {
  await asegurarEstado();
  const { data, error } = await supabase
    .from(ESTADO_TABLA)
    .select("data")
    .eq("id", ESTADO_ID)
    .single();
  if (error) throw error;
  return data.data;
}

export async function writeDB(data) {
  await asegurarEstado();

  // Respaldo del estado anterior antes de sobreescribir, por si algo sale
  // mal. Reemplaza al respaldo en git/archivo de la version con archivos:
  // aca cada escritura deja una fila nueva en finanzas_respaldos.
  const { data: anterior } = await supabase
    .from(ESTADO_TABLA)
    .select("data")
    .eq("id", ESTADO_ID)
    .maybeSingle();

  if (anterior) {
    const nombre = `finanzas.respaldo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await supabase
      .from(RESPALDOS_TABLA)
      .insert({ nombre, data: anterior.data })
      .then(({ error }) => {
        if (error) console.error("No se pudo guardar el respaldo:", error.message);
      });
  }

  const { error } = await supabase
    .from(ESTADO_TABLA)
    .update({ data, updated_at: new Date().toISOString() })
    .eq("id", ESTADO_ID);
  if (error) throw error;
}

// Cola de escritura: serializa cada ciclo leer->modificar->escribir para que
// dos requests concurrentes (ej. dos clics casi simultaneos) nunca se pisen
// y uno termine borrando los cambios del otro.
//
// OJO: esto solo protege contra concurrencia DENTRO del mismo proceso. En
// Vercel cada invocacion puede correr en una instancia serverless distinta,
// asi que dos escrituras verdaderamente simultaneas en instancias separadas
// no quedan serializadas por esta cola. Para una app de uso personal/familiar
// el riesgo es bajo, pero si esto crece a mas usuarios concurrentes conviene
// mover el candado a Supabase (ej. una funcion SQL con UPDATE optimista).
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

export async function listarRespaldos() {
  const { data, error } = await supabase
    .from(RESPALDOS_TABLA)
    .select("nombre, creado_at, data")
    .order("creado_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const copias = (data || []).map((fila) => ({
    nombre: fila.nombre,
    fecha: fila.creado_at,
    bytes: null,
    movimientos: (fila.data?.movimientos || []).length,
  }));

  return { copias, archivosEnLaCarpeta: copias.map((c) => c.nombre) };
}

export async function obtenerRespaldo(nombre) {
  const { data, error } = await supabase
    .from(RESPALDOS_TABLA)
    .select("data")
    .eq("nombre", nombre)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}
