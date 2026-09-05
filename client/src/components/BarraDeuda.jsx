import { formatoCOP, CATEGORIA_COLOR, ETIQUETAS_CATEGORIA } from "../api";

export default function BarraDeuda({ nombre, saldo, saldoInicial }) {
  const pagado = Math.max(0, saldoInicial - saldo);
  const porcentaje = saldoInicial > 0 ? Math.min(100, Math.round((pagado / saldoInicial) * 100)) : 0;
  const color = CATEGORIA_COLOR[nombre] || "var(--color-positivo)";

  return (
    <div className="py-4 dashed-row">
      <div className="flex justify-between mb-2">
        <span className="font-medium text-[13.5px] flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          {ETIQUETAS_CATEGORIA[nombre] || nombre}
        </span>
        <span className="font-serif-num font-semibold text-[16px] text-[var(--color-negativo)]">
          {formatoCOP(saldo)}
        </span>
      </div>
      <div className="h-[3px] bg-[var(--color-ledger-rule)] relative rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full transition-all duration-300"
          style={{ width: `${porcentaje}%`, background: color }}
        />
      </div>
      <span className="text-xs text-[var(--color-muted)] mt-1 block">
        {porcentaje}% pagado de {formatoCOP(saldoInicial)}
      </span>
    </div>
  );
}
