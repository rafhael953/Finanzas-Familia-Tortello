import { useEffect, useState } from "react";
import { api, formatoCOP } from "../api";

// La "radiografia" de una deuda: saldo inicial mas cada compra y cada pago
// registrado, en orden, con el saldo que iba quedando despues de cada uno.
// Se carga solo al abrirla (no en cada visita a Deudas) para no pedir esto
// de mas cuando nadie lo esta revisando.
export default function DetalleDeuda({ categoria }) {
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    api
      .getDetalleDeuda(categoria)
      .then(setDetalle)
      .finally(() => setCargando(false));
  }, [categoria]);

  if (cargando) return <p className="text-xs text-[var(--color-muted)] py-3">Cargando...</p>;
  if (!detalle) return null;

  return (
    <div className="pl-3 border-l-2 border-[var(--color-ledger-rule)] ml-1 my-2 text-[12.5px]">
      <div className="flex justify-between py-1 text-[var(--color-muted)]">
        <span>Saldo inicial</span>
        <span className="font-serif-num">{formatoCOP(detalle.saldoInicial)}</span>
      </div>
      {detalle.eventos.length === 0 && (
        <p className="text-[var(--color-muted)] py-1">Sin compras ni pagos registrados todavía.</p>
      )}
      {detalle.eventos.map((e) => (
        <div key={e.id} className="flex justify-between items-baseline py-1 gap-2">
          <span className="min-w-0">
            <span className={e.tipo === "compra" ? "text-[var(--color-negativo)]" : "text-[var(--color-positivo)]"}>
              {e.tipo === "compra" ? "+ compra" : "− pago"}
            </span>{" "}
            <span className="text-[var(--color-muted)]">
              {e.fecha}
              {e.descripcion && ` · ${e.descripcion}`}
              {e.cuotas > 1 && ` · ${e.cuotas} cuotas`}
              {!e.confirmado && " · pendiente"}
            </span>
          </span>
          <span className="flex-shrink-0 text-right">
            <span className="font-serif-num block">{formatoCOP(e.monto)}</span>
            <span className="text-[10.5px] text-[var(--color-muted)] block">
              saldo: {formatoCOP(e.saldoDespues)}
            </span>
          </span>
        </div>
      ))}
      <div className="flex justify-between pt-2 mt-1 border-t border-dashed border-[var(--color-ledger-rule)] font-semibold">
        <span>Saldo actual</span>
        <span className="font-serif-num">{formatoCOP(detalle.saldoFinal)}</span>
      </div>
    </div>
  );
}
