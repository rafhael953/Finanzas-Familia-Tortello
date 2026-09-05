import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, formatoQuincena } from "../api";
import FormGasto from "../components/FormGasto";
import ListaMovimientos from "../components/ListaMovimientos";

const ETIQUETAS = { mercado: "Mercado", cuidado: "Cuidado", esposa: "Esposa" };

export default function PanelJerardith() {
  const [resumen, setResumen] = useState(null);
  const [deudaTotal, setDeudaTotal] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    return Promise.all([api.getResumenJerardith(), api.getDeudas()]).then(([r, d]) => {
      setResumen(r);
      setDeudaTotal(d.reduce((a, x) => a + x.saldo, 0));
      setCargando(false);
    });
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardarGasto(gasto) {
    await api.postGastoJerardith({ ...gasto, quincena: resumen.quincenaActual });
    setMostrarForm(false);
    cargar();
  }

  if (cargando) return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Panel Jerardith</h1>
        </div>
      </header>
      <div className="flex justify-between">
        <Link to="/dashboard" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          ver todo en un lugar
        </Link>
        <Link to="/" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          cambiar perfil
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-6" />

      {/* Lo que a ella le importa primero: cuanto le queda disponible */}
      <div className="ledger-card ledger-card--hero p-6 mb-6">
        <span className="kicker">Te queda disponible</span>
        <span
          className={`font-serif-num text-[36px] font-bold block leading-tight ${
            resumen.disponibleTotal < 0 ? "text-[var(--color-negativo-alto)]" : "text-[var(--color-positivo-alto)]"
          }`}
        >
          {formatoCOP(resumen.disponibleTotal)}
        </span>
        <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-white/15 text-xs">
          <span className="text-white/55">Recibiste: {formatoCOP(resumen.asignadoTotal)}</span>
          <span className="text-white/55">Gastado: {formatoCOP(resumen.gastadoTotal)}</span>
        </div>
        <p className="text-xs text-white/50 mt-3">
          {formatoQuincena(resumen.quincenaActual)} ·{" "}
          <span className={resumen.activa ? "text-[var(--color-positivo-alto)]" : "text-[#E8C468]"}>
            {resumen.activa ? "✓ Activa" : "● Rafael aún no la activa"}
          </span>
        </p>
      </div>

      <div className="ledger-card p-6 mb-6">
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
              <div className="h-[3px] bg-[var(--color-ledger-rule)] relative rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${porcentaje}%`,
                    background: r.disponible < 0 ? "var(--color-negativo)" : "var(--color-acento-vivo)",
                  }}
                />
              </div>
              <span className="text-xs text-[var(--color-muted)] mt-1 block">
                {formatoCOP(r.gastado)} de {formatoCOP(r.presupuesto)}
              </span>
            </div>
          );
        })}
      </div>

      {!resumen.activa ? (
        <div className="ledger-card p-4 mb-6 text-center text-sm text-[#5c5347]">
          Rafael todavía no ha activado esta quincena. Cuando lo haga, vas a poder registrar tus gastos aquí.
        </div>
      ) : mostrarForm ? (
        <div className="mb-6">
          <FormGasto onGuardar={guardarGasto} onCancelar={() => setMostrarForm(false)} />
        </div>
      ) : (
        <button
          onClick={() => setMostrarForm(true)}
          className="bg-[var(--color-acento-vivo)] text-white rounded-md py-4 text-center font-semibold text-[15px] mb-6 shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
        >
          Registrar gasto
        </button>
      )}

      <div className="ledger-card p-6 mb-6">
        <div className="flex justify-between items-baseline dashed-row pb-2 mb-1">
          <h2 className="section-title-editorial">Tus gastos del mes</h2>
          <span className="font-serif-num font-semibold text-[15px]">
            {formatoCOP(resumen.historialMes.reduce((a, g) => a + Number(g.monto), 0))}
          </span>
        </div>
        <p className="text-xs text-[var(--color-muted)] mb-2">
          Toca el monto o la fecha para corregir algo que registraste.
        </p>
        <ListaMovimientos movimientos={resumen.historialMes} onCambio={cargar} />
      </div>

      {/* La situacion de la casa, para que tenga el panorama completo */}
      <div className="ledger-card p-6">
        <h2 className="section-title-editorial mb-3">Estado general de la familia</h2>
        <div className="flex justify-between">
          <div>
            <span className="font-serif-num text-xl font-bold text-[var(--color-negativo)] block">
              {formatoCOP(deudaTotal)}
            </span>
            <span className="kicker">Deuda total</span>
          </div>
          <div className="text-right">
            <span
              className={`font-serif-num text-xl font-bold block ${
                resumen.balanceGeneral < 0 ? "text-[var(--color-negativo)]" : "text-[var(--color-positivo)]"
              }`}
            >
              {formatoCOP(resumen.balanceGeneral)}
            </span>
            <span className="kicker">Balance quincena</span>
          </div>
        </div>
      </div>
    </div>
  );
}
