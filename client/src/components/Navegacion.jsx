import { Link, useLocation } from "react-router-dom";

// Todas las secciones a la mano. La app crecio a varias pantallas y los
// enlaces quedaron repartidos por dentro de las tarjetas, donde no se
// encuentran; aqui estan siempre visibles.
const SECCIONES = [
  { a: "/rafael", texto: "Quincena" },
  { a: "/reparto", texto: "Reparto" },
  { a: "/graficas", texto: "Gráficas" },
  { a: "/rafael/deudas", texto: "Deudas" },
  { a: "/ahorro", texto: "Ahorro" },
  { a: "/historial", texto: "Historial" },
  { a: "/dashboard", texto: "Patrimonio" },
];

export default function Navegacion() {
  const { pathname } = useLocation();

  return (
    <nav className="-mx-5 px-5 mb-5 overflow-x-auto">
      <div className="flex gap-2 w-max">
        {SECCIONES.map((s) => {
          const activa = pathname === s.a;
          return (
            <Link
              key={s.a}
              to={s.a}
              className={`rounded-full px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap transition-all ${
                activa
                  ? "bg-[var(--color-acento)] text-white"
                  : "bg-[var(--color-ledger)] text-[var(--color-muted)] hover:text-[var(--color-texto)]"
              }`}
            >
              {s.texto}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
