import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor."
  );
}

// El servidor es el unico que habla con Supabase (el cliente sigue hablando
// solo con /api/*), asi que usa la service role key: necesita poder leer y
// escribir el estado sin pelear con RLS. Esta key nunca debe llegar al navegador.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
