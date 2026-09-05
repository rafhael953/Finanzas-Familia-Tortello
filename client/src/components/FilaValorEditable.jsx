import { useState } from "react";
import { formatoCOP } from "../api";

// Fila de un valor que se puede editar a mano tocandolo -- para saldos que
// viven fuera de esta app (el banco, el exchange) o valores base como la
// cuota recomendada de una deuda, que deben poder ajustarse directamente.
export default function FilaValorEditable({ etiqueta, valor, sufijoUSD, extra, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [valorEdit, setValorEdit] = useState(String(valor));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (valorEdit === "" || Number(valorEdit) < 0) return;
    setGuardando(true);
    try {
      await onGuardar(Number(valorEdit));
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
      <span className="text-[var(--color-texto)]">{etiqueta}</span>
      {editando ? (
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={valorEdit}
            onChange={(e) => setValorEdit(e.target.value)}
            className="font-serif-num w-28 text-right border border-[var(--color-ledger-border)] rounded-md px-2 py-1 text-[13px] bg-[var(--color-fondo)]/40"
            autoFocus
          />
          <button
            onClick={guardar}
            disabled={guardando}
            className="text-[11px] font-semibold text-[var(--color-positivo)]"
          >
            Guardar
          </button>
        </span>
      ) : (
        <button
          onClick={() => {
            setValorEdit(String(valor));
            setEditando(true);
          }}
          className="font-serif-num font-semibold underline decoration-dotted"
        >
          {sufijoUSD ? `${valor.toFixed(2)} USD` : formatoCOP(valor)}
          {extra && <span className="text-xs text-[var(--color-muted)] font-sans"> · {extra}</span>}
        </button>
      )}
    </div>
  );
}
