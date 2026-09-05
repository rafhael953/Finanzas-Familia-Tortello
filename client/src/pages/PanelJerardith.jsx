import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP } from "../api";
import FormGasto from "../components/FormGasto";

const ETIQUETAS = { mercado: "Mercado", cuidado: "Cuidado", esposa: "Esposa" };

export default function PanelJerardith() {
  const [resumen, setResumen] = useState(null);
  const [deudaTotal, setDeudaTotal] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    setCargando(true);
    Promise.all([api.getResumenJerardith(), api.getDeudas()]).then(([r, d]) => {
      setResumen(r);
      setDeudaTotal(d.reduce((a, x) => a + x.saldo, 0));
      setCargando(false);
    });
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardarGasto(gasto) {
    await api.postGastoJerardith(gasto);
    setMostrarForm(false);
    cargar();
  }

  if (cargando) return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;

  const totalGastadoMes = resumen.historialMes.reduce((a, g) => a + Number(g.monto), 0);

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">Panel Jerardith</h1>
        </div>
      </header>
      <div className="flex justify-end">
        <Link to="/" className="text-xs text-[var(--color-muted)] underline">
          cambiar perfil
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />

      <div className="ledger-card p-5 mb-5">
        <h2 className="section-title-editorial mb-3">Estado general de la familia</h2>
        <div className="flex justify-between">
          <div>
            <span className="font-serif-num text-2xl font-bold text-[var(--color-negativo)] block">
              {formatoCOP(deudaTotal)}
            </span>
            <span className="kicker">Deuda total</span>
          </div>
          <div className="text-right">
            <span
              className={`font-serif-num text-2xl font-bold block ${
                resumen.balanceGeneral < 0 ? "text-[var(--color-negativo)]" : "text-[var(--color-positivo)]"
              }`}
            >
              {formatoCOP(resumen.balanceGeneral)}
            </span>
            <span className="kicker">Balance quincena</span>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-3">Quincena {resumen.quincenaActual}</p>
      </div>

      <div className="ledger-card p-5 mb-5">
        <h2 className="section-title-editorial mb-2">Tus rubros</h2>
        {resumen.resumen.map((r) => {
          const porcentaje = Math.min(100, Math.round((r.gastado / (r.presupuesto || 1)) * 100));
          return (
            <div key={r.rubro} className="py-3 dashed-row">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-medium text-[13.5px]">{ETIQUETAS[r.rubro]}</span>
                <span
                  className={`font-serif-num font-semibold text-[16px] ${
                    r.disponible < 0 ? "text-[var(--color-negativo)]" : "text-[var(--color-positivo)]"
                  }`}
                >
                  {formatoCOP(r.disponible)} disp.
                </span>
              </div>
              <div className="h-[3px] bg-[var(--color-ledger-rule)] relative">
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{ width: `${porcentaje}%`, background: r.disponible < 0 ? "var(--color-negativo)" : "var(--color-acento)" }}
                />
              </div>
              <span className="text-xs text-[var(--color-muted)] mt-1 block">
                {formatoCOP(r.gastado)} de {formatoCOP(r.presupuesto)}
              </span>
            </div>
          );
        })}
      </div>

      {mostrarForm ? (
        <div className="mb-5">
          <FormGasto onGuardar={guardarGasto} onCancelar={() => setMostrarForm(false)} />
        </div>
      ) : (
        <button
          onClick={() => setMostrarForm(true)}
          className="bg-[var(--color-acento)] text-white rounded-md py-4 text-center font-semibold text-[15px] mb-5"
        >
          Registrar gasto
        </button>
      )}

      <div className="ledger-card p-5">
        <div className="flex justify-between items-baseline dashed-row pb-2 mb-1">
          <h2 className="section-title-editorial">Historial del mes</h2>
          <span className="font-serif-num font-semibold text-[15px]">{formatoCOP(totalGastadoMes)}</span>
        </div>
        {resumen.historialMes.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] pt-2">Sin registros todavía.</p>
        ) : (
          resumen.historialMes.map((g) => (
            <div key={g.id} className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
              <div>
                <p className="font-medium capitalize">{ETIQUETAS[g.rubro] || g.rubro}</p>
                <p className="text-xs text-[var(--color-muted)]">{g.descripcion || "Sin descripción"} · {g.fecha}</p>
              </div>
              <span className="font-serif-num font-semibold">{formatoCOP(g.monto)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
