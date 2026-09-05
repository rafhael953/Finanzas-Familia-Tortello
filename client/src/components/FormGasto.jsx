import { useState } from "react";

const RUBROS = [
  { valor: "mercado", etiqueta: "Mercado" },
  { valor: "cuidado", etiqueta: "Cuidado" },
  { valor: "esposa", etiqueta: "Esposa (bolsillo)" },
];

export default function FormGasto({ rubroInicial, onGuardar, onCancelar }) {
  const [rubro, setRubro] = useState(rubroInicial || "mercado");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!monto || Number(monto) <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({ rubro, monto: Number(monto), descripcion, fecha });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 ledger-card p-5">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Rubro</label>
        <select
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        >
          {RUBROS.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Monto</label>
        <input
          type="number"
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="45000"
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Descripción</label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Frutas y verduras"
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      {error && <p className="text-[var(--color-negativo)] text-sm">{error}</p>}

      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 bg-[var(--color-acento)] text-white rounded-md py-3 font-semibold text-base disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar gasto"}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 bg-transparent border border-[var(--color-ledger-border)] rounded-md py-3 font-semibold text-base text-[var(--color-texto)]"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
