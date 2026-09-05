import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, formatoQuincena } from "../api";
import ListaMovimientos from "../components/ListaMovimientos";

export default function Historial() {
  const [movimientos, setMovimientos] = useState(null);

  function cargar() {
    api.getHistorial().then(setMovimientos);
  }

  useEffect(() => {
    cargar();
  }, []);

  if (!movimientos) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }

  // Agrupados por quincena, de la mas reciente a la mas antigua.
  const porQuincena = [];
  const indice = {};
  for (const m of movimientos) {
    if (!(m.quincenaId in indice)) {
      indice[m.quincenaId] = porQuincena.length;
      porQuincena.push({ quincenaId: m.quincenaId, movimientos: [] });
    }
    porQuincena[indice[m.quincenaId]].movimientos.push(m);
  }
  porQuincena.sort((a, b) => (a.quincenaId < b.quincenaId ? 1 : -1));

  const totalConfirmado = movimientos
    .filter((m) => m.confirmado !== false)
    .reduce((acc, m) => acc + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">Historial completo</h1>
        </div>
      </header>
      <div className="flex justify-end">
        <Link to="/rafael" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          volver
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />

      <div className="ledger-card p-5 mb-5">
        <span className="kicker">Balance neto desde el inicio (confirmado)</span>
        <span
          className={`font-serif-num text-[28px] font-bold block ${
            totalConfirmado >= 0 ? "text-[var(--color-positivo)]" : "text-[var(--color-negativo)]"
          }`}
        >
          {formatoCOP(totalConfirmado)}
        </span>
        <span className="text-xs text-[var(--color-muted)] mt-1 block">
          {movimientos.length} movimientos registrados en total
        </span>
      </div>

      {porQuincena.map((grupo) => (
        <div key={grupo.quincenaId} className="ledger-card p-5 mb-5">
          <h2 className="section-title-editorial mb-1">{formatoQuincena(grupo.quincenaId)}</h2>
          <p className="text-xs text-[var(--color-muted)] mb-2">{grupo.movimientos.length} movimientos</p>
          <ListaMovimientos movimientos={grupo.movimientos} onCambio={cargar} />
        </div>
      ))}
    </div>
  );
}
