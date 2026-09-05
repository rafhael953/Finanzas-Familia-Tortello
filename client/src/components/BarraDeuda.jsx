import { formatoCOP } from "../api";

const NOMBRES = {
  falabella: "Falabella",
  rappi: "Rappi",
  auteco: "Auteco (moto)",
  numama: "NU mamá",
};

export default function BarraDeuda({ nombre, saldo, saldoInicial }) {
  const pagado = Math.max(0, saldoInicial - saldo);
  const porcentaje = saldoInicial > 0 ? Math.min(100, Math.round((pagado / saldoInicial) * 100)) : 0;

  return (
    <div className="py-4 dashed-row">
      <div className="flex justify-between mb-2">
        <span className="font-medium text-[13.5px]">{NOMBRES[nombre] || nombre}</span>
        <span className="font-serif-num font-semibold text-[16px] text-[var(--color-negativo)]">
          {formatoCOP(saldo)}
        </span>
      </div>
      <div className="h-[3px] bg-[var(--color-ledger-rule)] relative">
        <div
          className="absolute left-0 top-0 h-full bg-[var(--color-positivo)]"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <span className="text-xs text-[var(--color-muted)] mt-1 block">
        {porcentaje}% pagado de {formatoCOP(saldoInicial)}
      </span>
    </div>
  );
}
