import { useState } from "react";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";

function Punto({ categoria }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: CATEGORIA_COLOR[categoria] || "#8A7F6E" }}
    />
  );
}

export default function FilaCategoria({ categoria, tipo, confirmado, pendiente, presupuesto, pagadoEnOtraQuincena, quincenaId, onCambio }) {
  const total = confirmado + pendiente;
  const color = CATEGORIA_COLOR[categoria] || "#8A7F6E";
  const [monto, setMonto] = useState(presupuesto > 0 ? String(presupuesto) : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Deuda ya pagada en la otra quincena del mismo mes: no se paga dos veces.
  if (total === 0 && pagadoEnOtraQuincena > 0) {
    return (
      <div className="dashed-row py-2.5 flex items-center justify-between gap-2">
        <span className="text-[13.5px] text-[var(--color-texto)] flex items-center gap-2">
          <Punto categoria={categoria} />
          {ETIQUETAS_CATEGORIA[categoria] || categoria}
        </span>
        <span className="text-[11px] font-semibold text-[var(--color-positivo)]">
          ✓ Ya pagada este mes ({formatoCOP(pagadoEnOtraQuincena)})
        </span>
      </div>
    );
  }

  // Nada registrado aun para esta categoria: fila de confirmacion rapida.
  if (total === 0 && quincenaId) {
    async function confirmarRapido() {
      if (!monto || Number(monto) <= 0) {
        setError("Monto inválido");
        return;
      }
      setGuardando(true);
      setError("");
      const item = { tipo, categoria, monto: Number(monto), quincenaId, confirmado: true, descripcion: "" };
      try {
        try {
          await api.agregarMovimiento(item);
        } catch (err) {
          if (err.duplicado && window.confirm(err.message)) {
            await api.agregarMovimiento({ ...item, forzar: true });
          } else {
            throw err;
          }
        }
        await onCambio();
      } catch (err) {
        setError(err.message);
      } finally {
        setGuardando(false);
      }
    }

    return (
      <div className="dashed-row py-2.5 flex items-center justify-between gap-2">
        <span className="text-[13.5px] text-[var(--color-texto)] flex-1 min-w-0 flex items-center gap-2">
          <Punto categoria={categoria} />
          {ETIQUETAS_CATEGORIA[categoria] || categoria}
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0"
          className="font-serif-num w-28 text-right border border-[var(--color-ledger-border)] rounded-md px-2 py-1.5 text-[13px] bg-[var(--color-fondo)]/40 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-acento)]/20 transition-shadow"
        />
        <button
          onClick={confirmarRapido}
          disabled={guardando || !monto}
          className="text-[11px] font-semibold bg-[var(--color-positivo)] text-white rounded-full px-3 py-2 disabled:opacity-40 flex-shrink-0 hover:brightness-110 active:scale-95 transition-all"
        >
          {guardando ? "..." : "✓ Confirmar"}
        </button>
        {error && <p className="text-[var(--color-negativo)] text-xs w-full">{error}</p>}
      </div>
    );
  }

  const base = presupuesto > 0 ? presupuesto : total || 1;
  const pctConfirmado = Math.min(100, Math.round((confirmado / base) * 100));
  const pctPendiente = Math.min(100 - pctConfirmado, Math.round((pendiente / base) * 100));
  const excedido = presupuesto > 0 && total > presupuesto;

  return (
    <div className="py-2">
      <div className="flex justify-between items-baseline dashed-row pb-2">
        <span className="text-[13.5px] text-[var(--color-texto)] flex items-center gap-2">
          <Punto categoria={categoria} />
          {ETIQUETAS_CATEGORIA[categoria] || categoria}
        </span>
        <span
          className={`font-serif-num font-semibold text-[15px] ${
            excedido ? "text-[var(--color-negativo)]" : "text-[var(--color-texto)]"
          }`}
        >
          {formatoCOP(total)}
          {presupuesto > 0 && <span className="text-xs text-[var(--color-muted)] font-sans"> / {formatoCOP(presupuesto)}</span>}
        </span>
      </div>
      <div className="h-[3px] bg-[var(--color-ledger-rule)] mt-2 relative flex overflow-hidden rounded-full">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pctConfirmado}%`, background: excedido ? "var(--color-negativo)" : color }}
        />
        {pendiente > 0 && (
          <div className="h-full transition-all duration-300" style={{ width: `${pctPendiente}%`, background: "#B0842A" }} />
        )}
      </div>
      {pendiente > 0 && (
        <span className="text-xs text-[#B0842A] mt-1 block">+ {formatoCOP(pendiente)} pendiente de confirmar</span>
      )}
    </div>
  );
}
