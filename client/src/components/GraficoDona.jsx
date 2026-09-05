const COLORES = ["#375623", "#C0392B", "#8A7F6E", "#B58A00"];

export default function GraficoDona({ segmentos }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  if (total <= 0) {
    return (
      <div className="flex items-center justify-center h-[140px] text-xs text-[var(--color-muted)]">
        Sin egresos registrados aún
      </div>
    );
  }

  let acumulado = 0;
  const stops = segmentos
    .filter((s) => s.valor > 0)
    .map((s, i) => {
      const inicio = (acumulado / total) * 360;
      acumulado += s.valor;
      const fin = (acumulado / total) * 360;
      return `${s.color || COLORES[i % COLORES.length]} ${inicio}deg ${fin}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-5">
      <div
        className="rounded-full flex-shrink-0"
        style={{
          width: 108,
          height: 108,
          background: `conic-gradient(${stops})`,
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 22px), #000 calc(100% - 22px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 22px), #000 calc(100% - 22px))",
        }}
      />
      <div className="flex flex-col gap-1.5">
        {segmentos.filter((s) => s.valor > 0).map((s, i) => (
          <div key={s.nombre} className="flex items-center gap-2 text-[12px]">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: s.color || COLORES[i % COLORES.length] }}
            />
            <span className="text-[#5c5347]">{s.nombre}</span>
            <span className="font-serif-num font-semibold ml-auto">
              {Math.round((s.valor / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
