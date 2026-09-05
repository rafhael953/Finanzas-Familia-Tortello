import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, formatoQuincena, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";
import GraficoLinea from "../components/GraficoLinea";
import GraficoDona from "../components/GraficoDona";
import BarraDeuda from "../components/BarraDeuda";

// Fila de saldo que se puede editar a mano -- para cuentas que viven fuera
// de esta app (el banco, el exchange) y cuyo numero no se puede calcular
// solo con los movimientos registrados aqui.
function FilaSaldo({ etiqueta, valor, sufijoUSD, extra, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [valorEdit, setValorEdit] = useState(String(valor));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (valorEdit === "" || Number(valorEdit) < 0) return;
    setGuardando(true);
    try {
      await onGuardar(Number(valorEdit));
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
      <span className="text-[#5c5347]">{etiqueta}</span>
      {editando ? (
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={valorEdit}
            onChange={(e) => setValorEdit(e.target.value)}
            className="font-serif-num w-28 text-right border border-[var(--color-ledger-border)] rounded-md px-2 py-1 text-[13px] bg-[var(--color-fondo)]/40"
            autoFocus
          />
          <button
            onClick={guardar}
            disabled={guardando}
            className="text-[11px] font-semibold text-[var(--color-positivo)]"
          >
            Guardar
          </button>
        </span>
      ) : (
        <button
          onClick={() => {
            setValorEdit(String(valor));
            setEditando(true);
          }}
          className="font-serif-num font-semibold underline decoration-dotted"
        >
          {sufijoUSD ? `${valor.toFixed(2)} USD` : formatoCOP(valor)}
          {extra && <span className="text-xs text-[var(--color-muted)] font-sans"> · {extra}</span>}
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [cuentas, setCuentas] = useState(null);
  const [evolucionNU, setEvolucionNU] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

  function cargarCuentas() {
    return api.getCuentas().then(setCuentas);
  }

  useEffect(() => {
    Promise.all([api.getCuentas(), api.getEvolucionNU(), api.getDeudas()]).then(([c, e, d]) => {
      setCuentas(c);
      setEvolucionNU(e);
      setDeudas(d);
      setCargando(false);
    });
  }, []);

  if (cargando || !cuentas) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }

  const deudaTotal = deudas.reduce((a, d) => a + d.saldo, 0);
  const deudaInicialTotal = deudas.reduce((a, d) => a + d.saldoInicial, 0);
  const xtbCOP = cuentas.xtbUSD * cuentas.trm;
  const binanceCOP = cuentas.binanceUSD * cuentas.trm;
  const patrimonioLiquido = cuentas.nu + cuentas.bancolombia + xtbCOP + binanceCOP;
  const patrimonioNeto = patrimonioLiquido - deudaTotal;

  const puntosNU = evolucionNU.map((e) => ({ label: formatoQuincena(e.quincenaId).replace("Quincena ", "Q"), valor: e.saldo }));

  // Tanto Rafael como Jerardith pueden llegar aqui -- el enlace de volver
  // debe llevar a cada quien a su propio panel.
  const perfil = localStorage.getItem("perfil") === "jerardith" ? "jerardith" : "rafael";
  const rutaVolver = perfil === "jerardith" ? "/jerardith" : "/rafael";
  const etiquetaVolver = perfil === "jerardith" ? "← panel de Jerardith" : "← panel de Rafael";

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">Vista general</h1>
        </div>
      </header>
      <div className="flex justify-between">
        <Link to={rutaVolver} className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          {etiquetaVolver}
        </Link>
        <Link to="/" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          cambiar perfil
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />

      {/* Patrimonio neto */}
      <div className="ledger-card p-5 mb-5">
        <span className="kicker">Patrimonio neto (activos − deudas)</span>
        <span
          className={`font-serif-num text-[32px] font-bold block leading-tight ${
            patrimonioNeto >= 0 ? "text-[var(--color-positivo)]" : "text-[var(--color-negativo)]"
          }`}
        >
          {formatoCOP(patrimonioNeto)}
        </span>
        <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-[var(--color-ledger-rule)] text-xs">
          <span className="text-[var(--color-muted)]">Activos líquidos: {formatoCOP(patrimonioLiquido)}</span>
          <span className="text-[var(--color-negativo)]">Deudas: {formatoCOP(deudaTotal)}</span>
        </div>
      </div>

      {/* NU */}
      <div className="ledger-card p-5 mb-5">
        <div className="flex justify-between items-baseline mb-1">
          <h2 className="section-title-editorial">Saldo NU</h2>
          <span className="text-xs text-[var(--color-muted)]">rinde {(cuentas.rendNU * 100).toFixed(1)}% E.A.</span>
        </div>
        <GraficoLinea puntos={puntosNU} />
      </div>

      {/* Cuentas */}
      <div className="ledger-card p-5 mb-5">
        <h2 className="section-title-editorial mb-3">Cuentas e inversiones</h2>
        <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
          <span className="text-[#5c5347]">NU (ahorro)</span>
          <span className="font-serif-num font-semibold">{formatoCOP(cuentas.nu)}</span>
        </div>
        <FilaSaldo
          etiqueta="Bancolombia (puente)"
          valor={cuentas.bancolombia}
          onGuardar={(v) => api.editarSaldoCuenta("bancolombia", v).then(cargarCuentas)}
        />
        <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
          <span className="text-[#5c5347]">XTB (inversión)</span>
          <span className="font-serif-num font-semibold">
            {cuentas.xtbUSD.toFixed(2)} USD
            <span className="text-xs text-[var(--color-muted)] font-sans"> · {formatoCOP(xtbCOP)}</span>
          </span>
        </div>
        <FilaSaldo
          etiqueta="Binance (cripto)"
          valor={cuentas.binanceUSD}
          sufijoUSD
          extra={formatoCOP(binanceCOP)}
          onGuardar={(v) => api.editarSaldoCuenta("binanceUSD", v).then(cargarCuentas)}
        />
        <p className="text-[10px] text-[var(--color-muted)] mt-2">
          TRM referencia: {formatoCOP(cuentas.trm)} · toca un saldo para actualizarlo a mano
        </p>
      </div>

      {/* Deudas */}
      <div className="ledger-card p-5 mb-5">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="section-title-editorial">Deudas</h2>
          <span className="text-xs text-[var(--color-muted)]">
            {Math.round(((deudaInicialTotal - deudaTotal) / deudaInicialTotal) * 100)}% pagado en total
          </span>
        </div>
        <GraficoDona
          segmentos={deudas.map((d) => ({
            nombre: ETIQUETAS_CATEGORIA[d.nombre] || d.nombre,
            valor: d.saldo,
            color: CATEGORIA_COLOR[d.nombre],
          }))}
        />
        <div className="mt-4">
          {deudas.map((d) => (
            <BarraDeuda key={d.nombre} nombre={d.nombre} saldo={d.saldo} saldoInicial={d.saldoInicial} />
          ))}
        </div>
      </div>

      <Link
        to="/rafael/deudas"
        className="border border-[var(--color-ledger-border)] rounded-md py-4 text-center font-semibold text-[15px] bg-[var(--color-ledger)] hover:bg-white hover:border-[var(--color-muted)] hover:shadow-sm transition-all"
      >
        Ver plan de pagos proyectado
      </Link>
    </div>
  );
}
