import { useEffect, useState } from "react";
import { api, ETIQUETAS_CATEGORIA, aplicarCategoriasPersonalizadas } from "../api";

const CATEGORIAS_BASE = {
  gasto: ["arriendo", "servicios", "mercado", "cuidado", "salud", "combustible", "ocio", "efectivo", "medicaBucaramanga", "jerardith"],
  deuda: ["falabella", "rappi", "auteco", "numama", "decameron"],
  inversion: ["xtb"],
  ingreso: ["salario", "prima", "extra"],
};

// Tipos donde se puede crear una categoria nueva sobre la marcha. Las
// deudas no entran: necesitan saldo y cuota, no solo un nombre.
const TIPOS_PERSONALIZABLES = ["gasto", "inversion", "ingreso"];

const ETIQUETAS_TIPO = {
  gasto: "Gasto",
  deuda: "Abono a deuda",
  inversion: "Inversión",
  ingreso: "Ingreso",
};

const NUEVA = "__nueva__";

export default function FormMovimiento({ quincenaId, onGuardado, onCancelar }) {
  const [categoriasPersonalizadas, setCategoriasPersonalizadas] = useState({ gasto: {}, inversion: {}, ingreso: {} });
  const [tipo, setTipo] = useState("gasto");
  const [categoria, setCategoria] = useState(CATEGORIAS_BASE.gasto[0]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [confirmado, setConfirmado] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCategoriasPersonalizadas().then((datos) => {
      setCategoriasPersonalizadas(datos);
      aplicarCategoriasPersonalizadas(datos);
    }).catch(() => {});
  }, []);

  function categoriasDe(t) {
    return [...CATEGORIAS_BASE[t], ...Object.keys(categoriasPersonalizadas[t] || {})];
  }

  function cambiarTipo(nuevoTipo) {
    setTipo(nuevoTipo);
    setCategoria(CATEGORIAS_BASE[nuevoTipo][0]);
  }

  function cambiarCategoria(valor) {
    if (valor === NUEVA) {
      setCategoria(NUEVA);
      setNuevaCategoria("");
    } else {
      setCategoria(valor);
    }
  }

  async function crearCategoria() {
    if (!nuevaCategoria.trim()) return;
    setCreandoCategoria(true);
    setError("");
    try {
      const nueva = await api.crearCategoria(tipo, nuevaCategoria.trim());
      const actualizadas = await api.getCategoriasPersonalizadas();
      setCategoriasPersonalizadas(actualizadas);
      aplicarCategoriasPersonalizadas(actualizadas);
      setCategoria(nueva.categoria);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreandoCategoria(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (categoria === NUEVA) {
      setError("Crea la categoría nueva antes de guardar");
      return;
    }
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
          onChange={(e) => cambiarCategoria(e.target.value)}
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        >
          {categoriasDe(tipo).map((cat) => (
            <option key={cat} value={cat}>
              {ETIQUETAS_CATEGORIA[cat] || cat}
            </option>
          ))}
          {TIPOS_PERSONALIZABLES.includes(tipo) && <option value={NUEVA}>+ Agregar categoría nueva…</option>}
        </select>
        {categoria === NUEVA && (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Nombre de la categoría"
              className="flex-1 border border-[var(--color-ledger-border)] rounded-md px-3 py-2 text-sm bg-[var(--color-fondo)]/40"
              autoFocus
            />
            <button
              type="button"
              onClick={crearCategoria}
              disabled={creandoCategoria || !nuevaCategoria.trim()}
              className="text-xs font-semibold bg-[var(--color-positivo)] text-white rounded-md px-3 py-2 disabled:opacity-40"
            >
              {creandoCategoria ? "..." : "Crear"}
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
