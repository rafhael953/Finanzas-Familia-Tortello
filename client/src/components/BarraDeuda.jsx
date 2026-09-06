import { formatoCOP, CATEGORIA_COLOR, ETIQUETAS_CATEGORIA } from "../api";

export default function BarraDeuda({ nombre, saldo, saldoInicial, comprado = 0 }) {
  // Con una tarjeta que se sigue usando, el punto de partida no es solo lo
  // que se debia al principio: hay que sumarle lo comprado despues. Sin
  // esto, una tarjeta con compras nuevas mostraba "0% pagado de X" con un
  // saldo mayor que X, que no se entiende.
  const base = saldoInicial + comprado;
  const pagado = Math.max(0, base - saldo);
  const porcentaje = base > 0 ? Math.min(100, Math.round((pagado / base) * 100)) : 0;
  const color = CATEGORIA_COLOR[nombre] || "var(--color-positivo)";
  const saldada = saldo <= 0;

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
        <span
          className={`font-serif-num font-semibold text-[16px] ${
            saldada ? "text-[var(--color-positivo)]" : "text-[var(--color-negativo)]"
          }`}
        >
          {saldada ? "✓ Pagada" : formatoCOP(saldo)}
        </span>
      </div>
      <div className="h-[3px] bg-[var(--color-ledger-rule)] relative rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full transition-all duration-300"
          style={{ width: `${porcentaje}%`, background: color }}
        />
      </div>
      <span className="text-xs text-[var(--color-muted)] mt-1 block">
        {porcentaje}% pagado de {formatoCOP(base)}
        {comprado > 0 &&
          ` (${formatoCOP(saldoInicial)} al inicio + ${formatoCOP(comprado)} en compras)`}
      </span>
    </div>
  );
}
