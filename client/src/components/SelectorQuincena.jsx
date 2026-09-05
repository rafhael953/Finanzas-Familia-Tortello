import { useState } from "react";
import { partesQuincena, idQuincena } from "../api";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function SelectorQuincena({ quincenaId, onIr }) {
  const actual = partesQuincena(quincenaId);
  const [anio, setAnio] = useState(actual.anio);
  const [mes, setMes] = useState(actual.mes);
  const [q, setQ] = useState(actual.q);

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-[var(--color-ledger-rule)] flex flex-col gap-2">
      <p className="text-xs text-[var(--color-muted)]">Ir a cualquier quincena:</p>
      <div className="flex gap-2">
        <select
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="flex-1 border border-[var(--color-ledger-border)] rounded-md px-2 py-2 text-[13px] bg-[var(--color-fondo)]/40"
        >
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="w-20 border border-[var(--color-ledger-border)] rounded-md px-2 py-2 text-[13px] bg-[var(--color-fondo)]/40"
        />
        <select
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
          className="w-20 border border-[var(--color-ledger-border)] rounded-md px-2 py-2 text-[13px] bg-[var(--color-fondo)]/40"
        >
          <option value={1}>Q1</option>
          <option value={2}>Q2</option>
        </select>
      </div>
      <button
        onClick={() => onIr(idQuincena(anio, mes, q))}
        className="bg-[var(--color-acento)] text-white rounded-md py-2 font-semibold text-sm"
      >
        Ir
      </button>
    </div>
  );
}
