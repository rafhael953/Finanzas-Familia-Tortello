import { useState } from "react";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, ETIQUETAS_TIPO, CATEGORIA_COLOR } from "../api";

// soloLectura: en el historial lo pasado ya paso. Poder borrar ahi un gasto
// de hace un mes cambia hacia atras el balance de esa quincena y el de todo
// el ano, sin que quede rastro de por que. Se corrige donde se registro,
// mientras la quincena esta en curso.
export default function ListaMovimientos({ movimientos, onCambio, soloLectura = false }) {
  const [editando, setEditando] = useState(null);
  const [valorEdit, setValorEdit] = useState("");
  const [fechaEdit, setFechaEdit] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState("");

  function iniciarEdicion(m) {
    setEditando(m.id);
    setValorEdit(String(m.monto));
    setFechaEdit(m.fecha);
  }

  async function guardarEdicion(id) {
    if (!valorEdit || Number(valorEdit) <= 0) {
      setError("Monto inválido");
      return;
    }
    setOcupado(id);
    setError("");
    try {
      await api.editarMovimiento(id, { monto: Number(valorEdit), fecha: fechaEdit });
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
        const enEdicion = editando === m.id;
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
                {enEdicion ? (
                  <input
                    type="date"
                    value={fechaEdit}
                    onChange={(e) => setFechaEdit(e.target.value)}
                    className="text-[11px] border border-[var(--color-ledger-border)] rounded-md px-1.5 py-0.5 mt-1 bg-[var(--color-fondo)]/40"
                  />
                ) : soloLectura ? (
                  <span className="text-[11px] text-[var(--color-muted)] block">
                    {m.fecha} {m.descripcion ? `· ${m.descripcion}` : ""}
                  </span>
                ) : (
                  <button
                    onClick={() => iniciarEdicion(m)}
                    className="text-[11px] text-[var(--color-muted)] underline decoration-dotted text-left"
                  >
                    {m.fecha} {m.descripcion ? `· ${m.descripcion}` : ""}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {enEdicion ? (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={valorEdit}
                      onChange={(e) => setValorEdit(e.target.value)}
                      className="font-serif-num w-24 text-right border border-[var(--color-ledger-border)] rounded-md px-2 py-1 text-[13px] bg-[var(--color-fondo)]/40 text-[var(--color-texto)]"
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
                ) : soloLectura ? (
                  <span className="font-serif-num font-semibold text-[14px]">
                    {formatoCOP(m.monto)}
                  </span>
                ) : (
                  <button
                    onClick={() => iniciarEdicion(m)}
                    className="font-serif-num font-semibold text-[14px] underline decoration-dotted"
                  >
                    {formatoCOP(m.monto)}
                  </button>
                )}

                {soloLectura ? (
                  <span
                    className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                      confirmado
                        ? "bg-[var(--color-positivo)]/10 text-[var(--color-positivo)]"
                        : "bg-[#B0842A]/10 text-[#B0842A]"
                    }`}
                    title={confirmado ? "Sucedió" : "Quedó como plan, no se confirmó"}
                  >
                    {confirmado ? "✓" : "●"}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => alternarConfirmado(m)}
                      disabled={ocupado === m.id}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                        confirmado ? "bg-[var(--color-positivo)]/10 text-[var(--color-positivo)]" : "bg-[#B0842A]/10 text-[#B0842A]"
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
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
