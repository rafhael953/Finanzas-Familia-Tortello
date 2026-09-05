import { useState } from "react";
import { ETIQUETAS_CATEGORIA } from "../api";

const CATEGORIAS_POR_TIPO = {
  gasto: ["arriendo", "servicios", "mercado", "cuidado", "salud", "combustible", "ocio", "efectivo", "decameron"],
  deuda: ["falabella", "rappi", "auteco", "numama"],
  reserva: ["xtb", "medicaBucaramanga", "jerardith"],
  ingreso: ["salario", "prima", "extra"],
};

const ETIQUETAS_TIPO = {
  gasto: "Gasto",
  deuda: "Abono a deuda",
  reserva: "Reserva/ahorro",
  ingreso: "Ingreso",
};

export default function FormMovimiento({ quincenaId, onGuardado, onCancelar }) {
  const [tipo, setTipo] = useState("gasto");
  const [categoria, setCategoria] = useState(CATEGORIAS_POR_TIPO.gasto[0]);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [confirmado, setConfirmado] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function cambiarTipo(nuevoTipo) {
    setTipo(nuevoTipo);
    setCategoria(CATEGORIAS_POR_TIPO[nuevoTipo][0]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!monto || Number(monto) <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    setGuardando(true);
    try {
      await onGuardado({ tipo, categoria, monto: Number(monto), descripcion, fecha, quincenaId, confirmado });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 ledger-card p-5">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Tipo</label>
        <div className="grid grid-cols-4 gap-1">
          {Object.keys(ETIQUETAS_TIPO).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cambiarTipo(t)}
              className={`rounded-lg py-2 text-xs font-medium ${
                tipo === t ? "bg-[var(--color-acento)] text-white" : "bg-black/5"
              }`}
            >
              {ETIQUETAS_TIPO[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Categoría</label>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        >
          {CATEGORIAS_POR_TIPO[tipo].map((cat) => (
            <option key={cat} value={cat}>
              {ETIQUETAS_CATEGORIA[cat]}
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
          placeholder="100000"
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Descripción (opcional)</label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Estado</label>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setConfirmado(true)}
            className={`rounded-lg py-2 text-xs font-medium ${
              confirmado ? "bg-[var(--color-positivo)] text-white" : "bg-black/5"
            }`}
          >
            ✓ Ya sucedió
          </button>
          <button
            type="button"
            onClick={() => setConfirmado(false)}
            className={`rounded-lg py-2 text-xs font-medium ${
              !confirmado ? "bg-[#B58A00] text-white" : "bg-black/5"
            }`}
          >
            ● Plan / estimado
          </button>
        </div>
      </div>

      {error && <p className="text-[var(--color-negativo)] text-sm">{error}</p>}

      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 bg-[var(--color-acento)] text-white rounded-md py-3 font-semibold text-base disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Agregar"}
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
