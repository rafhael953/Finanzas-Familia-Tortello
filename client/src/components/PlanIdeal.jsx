import { formatoCOP, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";

// Dos barras encima de la otra: arriba lo planeado (en gris), abajo lo
// real (en color). De un vistazo se ve si la barra de abajo se queda
// corta o se pasa de la de arriba.
function BarrasComparadas({ titulo, meta, real, colorReal, invertido = false }) {
  const tope = Math.max(meta, real, 1);
  const dif = real - meta;
  // En gastos pasarse es malo; en ingresos y ahorro pasarse es bueno.
  const bien = invertido ? real >= meta : real <= meta;

  return (
    <div className="py-2.5 dashed-row">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[13px] font-semibold">{titulo}</span>
        <span className="font-serif-num text-[13px]">
          <span className="font-bold">{formatoCOP(real)}</span>
          <span className="text-[var(--color-muted)]"> / {formatoCOP(meta)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] text-[var(--color-muted)] w-8 flex-shrink-0">plan</span>
        <div className="flex-1 h-[6px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[#cfc3ae]" style={{ width: `${(meta / tope) * 100}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-[var(--color-muted)] w-8 flex-shrink-0">real</span>
        <div className="flex-1 h-[6px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(real / tope) * 100}%`, background: bien ? colorReal : "var(--color-negativo)" }}
          />
        </div>
      </div>
      {dif !== 0 && (
        <span
          className={`text-[11px] mt-1.5 block ${
            bien ? "text-[var(--color-muted)]" : "text-[var(--color-negativo)]"
          }`}
        >
          {dif > 0 ? `${formatoCOP(dif)} más que el plan` : `${formatoCOP(-dif)} menos que el plan`}
        </span>
      )}
    </div>
  );
}

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

  const AHORRO = ["nu", "xtb", "binance"];
  const ahorroMeta = AHORRO.reduce((a, k) => a + (ideal.categorias[k] || 0), 0);
  const ahorroReal = estado.inversionesConfirmado;

  // Lo que se va en vivir: el plan menos lo que era ahorro.
  const gastosMeta = Object.entries(ideal.categorias)
    .filter(([k]) => !AHORRO.includes(k))
    .reduce((a, [, v]) => a + v, 0);
  const gastosReal = estado.gastosConfirmado;
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

      {/* Como se comporto la quincena en grande, antes del detalle */}
      <p className="kicker mb-1">Cómo se comportó</p>
      <BarrasComparadas
        titulo="Entró"
        meta={ideal.ingreso}
        real={estado.ingresosConfirmado}
        colorReal="var(--color-positivo)"
        invertido
      />
      <BarrasComparadas
        titulo="Gastos del día a día"
        meta={gastosMeta}
        real={gastosReal}
        colorReal="var(--color-acento-vivo)"
      />
      <BarrasComparadas
        titulo="Deudas y tarjetas"
        meta={ideal.deudas}
        real={estado.deudasConfirmado}
        colorReal="#A8453C"
      />
      <BarrasComparadas
        titulo="Ahorro e inversión"
        meta={ahorroMeta}
        real={ahorroReal}
        colorReal="var(--color-positivo)"
        invertido
      />

      <p className="kicker mt-5 mb-1">Rubro por rubro</p>
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
