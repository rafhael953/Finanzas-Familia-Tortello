import { formatoCOP, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";

// Compara el plan de la hoja de presupuesto contra lo que de verdad paso
// en la quincena. La idea no es regañar por cada peso, sino ver rapido en
// que rubro se esta saliendo del cauce -- y sobre todo si el ahorro que se
// prometio de verdad se esta haciendo.
export default function PlanIdeal({ estado }) {
  const ideal = estado.ideal;
  if (!ideal) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-3">
        Todavía no hay un plan cargado para este tipo de quincena.
      </p>
    );
  }

  const realDe = (categoria) => {
    const fila =
      estado.gastos.find((g) => g.categoria === categoria) ||
      estado.inversiones.find((i) => i.categoria === categoria);
    return fila ? fila.confirmado : 0;
  };

  const filas = Object.entries(ideal.categorias)
    .map(([categoria, meta]) => ({
      categoria,
      meta,
      real: realDe(categoria),
    }))
    .sort((a, b) => b.meta - a.meta);

  // Las deudas van juntas: el plan dice cuanto destinar a tarjetas en
  // total, no como repartirlo entre cada una.
  if (ideal.deudas > 0 || estado.deudasConfirmado > 0) {
    filas.push({ categoria: "_deudas", meta: ideal.deudas, real: estado.deudasConfirmado });
  }

  const ahorroMeta = (ideal.categorias.nu || 0) + (ideal.categorias.xtb || 0);
  const ahorroReal =
    (estado.inversiones.find((i) => i.categoria === "nu")?.confirmado || 0) +
    (estado.inversiones.find((i) => i.categoria === "xtb")?.confirmado || 0);
  const pctMeta = ideal.ingreso ? Math.round((ahorroMeta / ideal.ingreso) * 100) : 0;
  const pctReal = estado.ingresosConfirmado
    ? Math.round((ahorroReal / estado.ingresosConfirmado) * 100)
    : 0;

  return (
    <div>
      {/* Lo que de verdad importa del plan: cuanto se esta ahorrando */}
      <div
        className={`tile-suave mb-4 ${
          pctReal >= pctMeta ? "bg-[var(--color-suave-verde)]" : "bg-[var(--color-suave-ambar)]"
        }`}
      >
        <div
          className={`text-[11px] font-semibold opacity-80 ${
            pctReal >= pctMeta
              ? "text-[var(--color-suave-verde-texto)]"
              : "text-[var(--color-suave-ambar-texto)]"
          }`}
        >
          Ahorro de esta quincena
        </div>
        <div
          className={`font-serif-num text-[19px] font-bold mt-1 ${
            pctReal >= pctMeta
              ? "text-[var(--color-suave-verde-texto)]"
              : "text-[var(--color-suave-ambar-texto)]"
          }`}
        >
          {formatoCOP(ahorroReal)}{" "}
          <span className="text-[13px] font-semibold opacity-70">
            de {formatoCOP(ahorroMeta)}
          </span>
        </div>
        <div
          className={`text-[11.5px] mt-1 ${
            pctReal >= pctMeta
              ? "text-[var(--color-suave-verde-texto)]"
              : "text-[var(--color-suave-ambar-texto)]"
          }`}
        >
          Vas en {pctReal}% de lo que entró · la meta es {pctMeta}%
        </div>
      </div>

      {filas.map((f) => {
        const dif = f.real - f.meta;
        const excedido = dif > 0;
        const pct = f.meta > 0 ? Math.min(100, Math.round((f.real / f.meta) * 100)) : 0;
        const color = f.categoria === "_deudas" ? "#A8453C" : CATEGORIA_COLOR[f.categoria] || "#8A7F6E";
        const nombre =
          f.categoria === "_deudas" ? "Deudas y tarjetas" : ETIQUETAS_CATEGORIA[f.categoria] || f.categoria;

        return (
          <div key={f.categoria} className="py-2.5 dashed-row">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[13.5px] font-medium flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                {nombre}
              </span>
              <span className="font-serif-num text-[13.5px]">
                <span className="font-bold">{formatoCOP(f.real)}</span>
                <span className="text-[var(--color-muted)]"> / {formatoCOP(f.meta)}</span>
              </span>
            </div>
            <div className="h-[5px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${f.meta > 0 ? pct : f.real > 0 ? 100 : 0}%`,
                  background: excedido ? "var(--color-negativo)" : color,
                }}
              />
            </div>
            {dif !== 0 && (
              <span
                className={`text-[11px] mt-1 block ${
                  excedido ? "text-[var(--color-negativo)]" : "text-[var(--color-muted)]"
                }`}
              >
                {excedido
                  ? `${formatoCOP(dif)} por encima del plan`
                  : `Te faltan ${formatoCOP(-dif)} para lo planeado`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
