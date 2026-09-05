import { formatoCOP } from "../api";

export default function GraficoLinea({ puntos, color = "var(--color-positivo)" }) {
  if (!puntos || puntos.length === 0) {
    return (
      <div className="flex items-center justify-center h-[100px] text-xs text-[var(--color-muted)]">
        Sin datos suficientes todavía
      </div>
    );
  }
  if (puntos.length === 1) {
    return (
      <div className="py-4">
        <span className="font-serif-num text-xl font-bold">{formatoCOP(puntos[0].valor)}</span>
        <p className="text-xs text-[var(--color-muted)] mt-1">{puntos[0].label}</p>
      </div>
    );
  }

  const W = 320;
  const H = 90;
  const PAD = 8;
  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 1);
  const rango = max - min || 1;

  const coords = puntos.map((p, i) => {
    const x = PAD + (i / (puntos.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((p.valor - min) / rango) * (H - PAD * 2);
    return [x, y];
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1][0]},${H - PAD} L${coords[0][0]},${H - PAD} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px]">
        <path d={areaPath} fill={color} opacity="0.08" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--color-muted)] mt-1">
        <span>{puntos[0].label}</span>
        <span>{puntos[puntos.length - 1].label}</span>
      </div>
      <div className="flex justify-between items-baseline mt-2">
        <span className="text-xs text-[var(--color-muted)]">Actual</span>
        <span className="font-serif-num font-bold text-lg">{formatoCOP(puntos[puntos.length - 1].valor)}</span>
      </div>
    </div>
  );
}
