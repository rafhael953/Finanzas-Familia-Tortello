import { createClient } from "@supabase/supabase-js";
import dns from "dns";

// En algunas funciones de Vercel, Node resuelve el dominio de Supabase a una
// direccion IPv6 y la conexion se queda colgada sin dar error ni respuesta
// (timeout de 300s) porque la red de salida no tiene ruta IPv6 completa.
// Forzar IPv4 primero evita ese cuelgue.
dns.setDefaultResultOrder("ipv4first");

// Vercel a veces guarda las env vars con comillas o espacios de mas si se
// pegaron asi en el dashboard; limpiamos eso para no romper createClient.
const limpiar = (valor) => valor?.trim().replace(/^["']|["']$/g, "");

const SUPABASE_URL = limpiar(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = limpiar(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor."
  );
}

if (!/^https?:\/\//.test(SUPABASE_URL)) {
  throw new Error(
    `SUPABASE_URL no es una URL http(s) valida (largo=${SUPABASE_URL.length}, empieza con "${SUPABASE_URL.slice(0, 12)}..."). Revisa en Vercel > Settings > Environment Variables que no tenga comillas ni espacios extra, y que este seteada para Production.`
  );
}

// Sin esto, una llamada que se cuelga en la red (ej. problema de ruta hacia
// Supabase) tarda los 300s completos del limite de Vercel antes de fallar.
// Con esto falla en 10s y el log muestra el motivo real en vez de un timeout
// generico de la plataforma.
function fetchConLimite(url, opciones = {}) {
  const control = new AbortController();
  const aviso = setTimeout(() => control.abort(), 10_000);
  return fetch(url, { ...opciones, signal: control.signal }).finally(() => clearTimeout(aviso));
}

// El servidor es el unico que habla con Supabase (el cliente sigue hablando
// solo con /api/*), asi que usa la service role key: necesita poder leer y
// escribir el estado sin pelear con RLS. Esta key nunca debe llegar al navegador.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch: fetchConLimite },
});
