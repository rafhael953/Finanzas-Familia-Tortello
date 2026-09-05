import { useState } from "react";

// Seccion que se puede plegar para no tener que hacer scroll infinito.
// Al plegarse deja visible el total, para que ocultarla no signifique
// perder de vista el dato.
export default function SeccionPlegable({
  titulo,
  descripcion,
  resumen,
  abiertaPorDefecto = true,
  children,
}) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto);

  return (
    <div className="ledger-card p-6 mb-6">
      <button onClick={() => setAbierta((v) => !v)} className="w-full text-left">
        <div className="flex justify-between items-baseline gap-3">
          <h2 className="section-title-editorial">
            <span className="text-[var(--color-muted)] mr-1">{abierta ? "▾" : "▸"}</span>
            {titulo}
          </h2>
          {resumen != null && (
            <span className="font-serif-num font-bold text-[14px] flex-shrink-0">{resumen}</span>
          )}
        </div>
        {descripcion && (
          <p className="text-xs text-[var(--color-muted)] mt-1">{descripcion}</p>
        )}
      </button>
      {abierta && <div className="mt-2">{children}</div>}
    </div>
  );
}
