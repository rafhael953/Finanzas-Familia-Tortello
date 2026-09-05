import { formatoCOP } from "../api";

const COLORES = ["#7D8B5A", "#C98BA0", "#A0937E", "#5B7B8C", "#C6A15B", "#8B5E3C"];

// Distribucion como barra segmentada + lista con pastillas de porcentaje.
// Se prefirio esto a una dona porque en el celular la lista se lee de un
// vistazo y la barra ya da la proporcion sin tener que interpretar angulos.
export default function GraficoDona({ segmentos }) {
  const visibles = (segmentos || []).filter((s) => s.valor > 0);
  const total = visibles.reduce((a, s) => a + s.valor, 0);

  if (total <= 0) {
    return (
      <div className="py-6 text-center text-xs text-[var(--color-muted)]">
        Aún no hay nada confirmado esta quincena
      </div>
    );
  }

  const conColor = visibles.map((s, i) => ({
    ...s,
    color: s.color || COLORES[i % COLORES.length],
    pct: Math.round((s.valor / total) * 100),
  }));

  return (
    <div>
      <div className="flex h-[11px] rounded-full overflow-hidden gap-[2px] mb-3">
        {conColor.map((s) => (
          <div key={s.nombre} style={{ flex: s.valor, background: s.color }} />
        ))}
      </div>

      {conColor.map((s) => (
        <div key={s.nombre} className="flex items-center gap-3 py-2">
          <div className="pastilla" style={{ background: s.color }}>
            {s.pct}%
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold truncate">{s.nombre}</div>
          </div>
          <div className="ml-auto font-serif-num font-bold text-[14px]">{formatoCOP(s.valor)}</div>
        </div>
      ))}
    </div>
  );
}
