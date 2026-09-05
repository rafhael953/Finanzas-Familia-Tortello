import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, ETIQUETAS_CATEGORIA } from "../api";
import BarraDeuda from "../components/BarraDeuda";

export default function Deudas() {
  const [deudas, setDeudas] = useState([]);
  const [proyeccion, setProyeccion] = useState(null);
  const [mostrarPlan, setMostrarPlan] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.getDeudas().then((d) => {
      setDeudas(d);
      setCargando(false);
    });
  }, []);

  function cargarPlan() {
    if (proyeccion) {
      setMostrarPlan((v) => !v);
      return;
    }
    api.getDeudasProyeccion().then((p) => {
      setProyeccion(p);
      setMostrarPlan(true);
    });
  }

  const nombres = deudas.map((d) => d.nombre);

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">Deudas</h1>
        </div>
      </header>
      <div className="flex justify-end">
        <Link to="/rafael" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          volver
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />

      {cargando ? (
        <p className="text-center py-8 font-serif-num">Cargando...</p>
      ) : (
        <>
          <div className="ledger-card p-5 mb-5">
            <h2 className="section-title-editorial mb-2">Estado actual</h2>
            {deudas.map((d) => (
              <BarraDeuda key={d.nombre} nombre={d.nombre} saldo={d.saldo} saldoInicial={d.saldoInicial} />
            ))}
          </div>

          <button
            onClick={cargarPlan}
            className="border border-[var(--color-ledger-border)] rounded-md py-3 text-center font-semibold text-sm mb-5 bg-[var(--color-ledger)] hover:bg-white hover:border-[var(--color-muted)] hover:shadow-sm transition-all"
          >
            {mostrarPlan ? "Ocultar plan de pagos" : "Ver plan de pagos"}
          </button>

          {mostrarPlan && proyeccion && (
            <div className="ledger-card p-5 overflow-x-auto">
              <h2 className="section-title-editorial mb-2">Plan de pagos</h2>
              <p className="text-xs text-[var(--color-muted)] mb-4">
                Sobrante mensual estimado para abono extra: {formatoCOP(proyeccion.sobranteMensualBase)}
              </p>
              <table className="text-[13px] w-full min-w-[480px]">
                <thead>
                  <tr className="text-left dashed-row">
                    <th className="py-2 pr-2 font-semibold">Mes</th>
                    {nombres.map((n) => (
                      <th key={n} className="py-2 pr-2 font-semibold">{ETIQUETAS_CATEGORIA[n]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proyeccion.proyeccion.map((fila) => {
                    const todoPagado = Object.values(fila.saldos).every((s) => s <= 0);
                    return (
                      <tr key={fila.mes} className="dashed-row">
                        <td className="py-2 pr-2 font-serif-num font-medium">
                          {fila.mes}
                          {todoPagado && <span className="text-[var(--color-positivo)]"> ✓</span>}
                        </td>
                        {nombres.map((n) => (
                          <td key={n} className="py-2 pr-2 font-serif-num text-[#5c5347]">
                            {formatoCOP(fila.saldos[n] || 0)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
