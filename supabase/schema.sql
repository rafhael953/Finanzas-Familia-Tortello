-- Ejecutar una sola vez en el SQL Editor de Supabase antes del primer deploy.
--
-- El estado de la app (movimientos, cuentas, deudas, configuracion, compras
-- con tarjeta, etc.) sigue viajando como un unico documento JSON -- igual que
-- el finanzas.json de antes -- porque toda la logica de calculo en
-- server/calculos.js y server/asesor.js esta escrita contra esa forma. Esta
-- tabla es solo el nuevo lugar donde vive ese documento (antes: archivo en
-- disco; ahora: una fila en Postgres).

create table if not exists finanzas_estado (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Cada escritura guarda aca el estado anterior completo, como respaldo.
create table if not exists finanzas_respaldos (
  id bigserial primary key,
  nombre text unique not null,
  data jsonb not null,
  creado_at timestamptz not null default now()
);

create index if not exists finanzas_respaldos_creado_at_idx
  on finanzas_respaldos (creado_at desc);

-- El servidor accede con la service role key (bypassa RLS), asi que no hace
-- falta una policy de RLS para el uso normal de la app. Se deja RLS activado
-- por si alguna vez se agrega acceso directo desde el cliente con anon key.
alter table finanzas_estado enable row level security;
alter table finanzas_respaldos enable row level security;
