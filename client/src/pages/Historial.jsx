import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navegacion from "../components/Navegacion";
import { api, formatoCOP, formatoQuincena } from "../api";
import ListaMovimientos from "../components/ListaMovimientos";

export default function Historial() {
  const [movimientos, setMovimientos] = useState(null);
  const [expandidas, setExpandidas] = useState(new Set());

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

  // Lo que Jerardith registra que gasto de su propio bolsillo es solo
  // visibilidad para ella -- no es una segunda salida de dinero (ya se
  // conto cuando Rafael se lo asigno), asi que no se vuelve a restar aqui.
  const noDobleConteo = (m) => !(m.categoria === "jerardith" && m.registradoPor === "jerardith");

  const totalConfirmado = movimientos
    .filter((m) => m.confirmado !== false)
    .filter(noDobleConteo)
    .reduce((acc, m) => acc + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);

  function alternar(quincenaId) {
    setExpandidas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(quincenaId)) nuevo.delete(quincenaId);
      else nuevo.add(quincenaId);
      return nuevo;
    });
  }

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Historial completo</h1>
        </div>
      </header>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />
      <Navegacion />

      <div className="ledger-card ledger-card--hero p-6 mb-6">
        <span className="kicker">Balance neto desde el inicio (confirmado)</span>
        <span
          className={`font-serif-num text-[32px] font-bold block ${
            totalConfirmado >= 0 ? "text-[var(--color-positivo-alto)]" : "text-[var(--color-negativo-alto)]"
          }`}
        >
          {formatoCOP(totalConfirmado)}
        </span>
        <span className="text-xs text-white/50 mt-1 block">
          {movimientos.length} movimientos registrados en total · {porQuincena.length} quincenas
        </span>
        <p className="text-xs text-white/40 mt-3 pt-3 border-t border-dashed border-white/15">
          Esto es un registro de lo que pasó, no se edita desde aquí. Si hay
          algo que corregir, se hace en la quincena donde se registró.
        </p>
      </div>

      {porQuincena.map((grupo, i) => {
        const abierta = expandidas.has(grupo.quincenaId) || (expandidas.size === 0 && i === 0);
        const netoQuincena = grupo.movimientos
          .filter((m) => m.confirmado !== false)
          .filter(noDobleConteo)
          .reduce((a, m) => a + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);

        return (
          <div key={grupo.quincenaId} className="ledger-card p-6 mb-6">
            <button onClick={() => alternar(grupo.quincenaId)} className="w-full text-left">
              <div className="flex justify-between items-baseline">
                <h2 className="section-title-editorial">
                  {abierta ? "▾" : "▸"} {formatoQuincena(grupo.quincenaId)}
                </h2>
                <span
                  className={`font-serif-num font-semibold text-[14px] ${
                    netoQuincena >= 0 ? "text-[var(--color-positivo)]" : "text-[var(--color-negativo)]"
                  }`}
                >
                  {formatoCOP(netoQuincena)}
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] mb-2">{grupo.movimientos.length} movimientos</p>
            </button>
            {abierta && (
              <ListaMovimientos movimientos={grupo.movimientos} onCambio={cargar} soloLectura />
            )}
          </div>
        );
      })}
    </div>
  );
}
