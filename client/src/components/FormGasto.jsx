import { useState } from "react";
import { api } from "../api";

const NUEVO = "__nuevo__";

export default function FormGasto({ rubros = [], rubroInicial, onGuardar, onCancelar, onRubroCreado }) {
  const [rubro, setRubro] = useState(rubroInicial || rubros[0]?.valor || "mercado");
  const [nuevoRubro, setNuevoRubro] = useState("");
  const [creando, setCreando] = useState(false);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function crearRubro() {
    if (!nuevoRubro.trim()) return;
    setCreando(true);
    setError("");
    try {
      const creado = await api.crearCategoria("gasto", nuevoRubro.trim(), true);
      await onRubroCreado?.();
      setRubro(creado.categoria);
      setNuevoRubro("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!monto || Number(monto) <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    if (rubro === NUEVO) {
      setError("Crea el rubro nuevo antes de guardar");
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
          className="border border-[var(--color-ledger-border)] rounded-[14px] px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        >
          {rubros.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
          <option value={NUEVO}>+ Crear un rubro nuevo…</option>
        </select>
        {rubro === NUEVO && (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={nuevoRubro}
              onChange={(e) => setNuevoRubro(e.target.value)}
              placeholder="Ej. Farmacia"
              className="flex-1 border border-[var(--color-ledger-border)] rounded-[14px] px-3 py-2 text-sm bg-[var(--color-fondo)]/40"
              autoFocus
            />
            <button
              type="button"
              onClick={crearRubro}
              disabled={creando || !nuevoRubro.trim()}
              className="text-xs font-semibold bg-[var(--color-positivo)] text-white rounded-[14px] px-3 py-2 disabled:opacity-40"
            >
              {creando ? "..." : "Crear"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Monto</label>
        <input
          type="number"
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="45000"
          className="border border-[var(--color-ledger-border)] rounded-[14px] px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Descripción</label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Frutas y verduras"
          className="border border-[var(--color-ledger-border)] rounded-[14px] px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-[var(--color-ledger-border)] rounded-[14px] px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      {error && <p className="text-[var(--color-negativo)] text-sm">{error}</p>}

      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 bg-[var(--color-acento)] text-white rounded-[16px] py-3 font-semibold text-base disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar gasto"}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 bg-transparent border border-[var(--color-ledger-border)] rounded-[16px] py-3 font-semibold text-base text-[var(--color-texto)]"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
