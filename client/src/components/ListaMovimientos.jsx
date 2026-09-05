import { useState } from "react";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, ETIQUETAS_TIPO, CATEGORIA_COLOR } from "../api";

export default function ListaMovimientos({ movimientos, onCambio }) {
  const [editando, setEditando] = useState(null);
  const [valorEdit, setValorEdit] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState("");

  function iniciarEdicion(m) {
    setEditando(m.id);
    setValorEdit(String(m.monto));
  }

  async function guardarEdicion(id) {
    if (!valorEdit || Number(valorEdit) <= 0) {
      setError("Monto inválido");
      return;
    }
    setOcupado(id);
    setError("");
    try {
      await api.editarMovimiento(id, { monto: Number(valorEdit) });
      setEditando(null);
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  }

  async function alternarConfirmado(m) {
    setOcupado(m.id);
    setError("");
    try {
      await api.editarMovimiento(m.id, { confirmado: !(m.confirmado !== false) });
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  }

  async function borrar(id) {
    setOcupado(id);
    setError("");
    try {
      await api.borrarMovimiento(id);
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  }

  if (movimientos.length === 0) {
    return <p className="text-sm text-[var(--color-muted)] py-3">Aún no hay movimientos en esta quincena.</p>;
  }

  return (
    <div>
      {error && <p className="text-[var(--color-negativo)] text-sm mb-2">{error}</p>}
      {movimientos.map((m) => {
        const confirmado = m.confirmado !== false;
        return (
          <div key={m.id} className="dashed-row py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: CATEGORIA_COLOR[m.categoria] || "#8A7F6E" }}
                  />
                  <span className="text-[13px] font-medium truncate">
                    {ETIQUETAS_CATEGORIA[m.categoria] || m.categoria}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)] uppercase">
                    {ETIQUETAS_TIPO[m.tipo]}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--color-muted)]">
                  {m.fecha} {m.descripcion ? `· ${m.descripcion}` : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {editando === m.id ? (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={valorEdit}
                      onChange={(e) => setValorEdit(e.target.value)}
                      className="font-serif-num w-24 text-right border border-[var(--color-ledger-border)] rounded-md px-2 py-1 text-[13px]"
                      autoFocus
                    />
                    <button
                      onClick={() => guardarEdicion(m.id)}
                      disabled={ocupado === m.id}
                      className="text-[11px] font-semibold text-[var(--color-positivo)]"
                    >
                      Guardar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => iniciarEdicion(m)}
                    className="font-serif-num font-semibold text-[14px] underline decoration-dotted"
                  >
                    {formatoCOP(m.monto)}
                  </button>
                )}

                <button
                  onClick={() => alternarConfirmado(m)}
                  disabled={ocupado === m.id}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                    confirmado ? "bg-[var(--color-positivo)]/10 text-[var(--color-positivo)]" : "bg-[#B58A00]/10 text-[#B58A00]"
                  }`}
                  title={confirmado ? "Ya sucedió — clic para marcar como plan" : "Es un plan — clic para confirmar"}
                >
                  {confirmado ? "✓" : "●"}
                </button>

                <button
                  onClick={() => borrar(m.id)}
                  disabled={ocupado === m.id}
                  className="text-[var(--color-muted)] text-[13px]"
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
