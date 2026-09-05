import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";
import GraficoLinea from "../components/GraficoLinea";
import GraficoDona from "../components/GraficoDona";
import BarraDeuda from "../components/BarraDeuda";
import FilaSaldo from "../components/FilaValorEditable";

const MESES_CORTOS = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function etiquetaMes(prefijo) {
  const [anio, mes] = prefijo.split("-");
  return `${MESES_CORTOS[Number(mes)]} ${anio.slice(2)}`;
}

export default function Dashboard() {
  const [cuentas, setCuentas] = useState(null);
  const [evolucionNU, setEvolucionNU] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

  function cargarCuentas() {
    return api.getCuentas().then(setCuentas);
  }

  function cargarTodo() {
    return Promise.all([
      api.getCuentas(),
      api.getEvolucionNUMensual(),
      api.getDeudas(),
    ]).then(([c, e, d]) => {
      setCuentas(c);
      setEvolucionNU(e);
      setDeudas(d);
      setCargando(false);
    });
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  if (cargando || !cuentas) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }

  const deudaTotal = deudas.reduce((a, d) => a + d.saldo, 0);
  const deudaInicialTotal = deudas.reduce((a, d) => a + d.saldoInicial, 0);
  const xtbCOP = cuentas.xtbUSD * cuentas.trm;
  const binanceCOP = cuentas.binanceUSD * cuentas.trm;
  const patrimonioLiquido = cuentas.nu + xtbCOP + binanceCOP;
  const patrimonioNeto = patrimonioLiquido - deudaTotal;

  const puntosNU = evolucionNU.map((e) => ({ label: etiquetaMes(e.mes), valor: e.saldo }));

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
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Vista general</h1>
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
      <div className="h-px bg-[var(--color-ledger-rule)] my-6" />

      {/* Patrimonio neto -- tarjeta titular de esta pagina */}
      <div className="ledger-card ledger-card--hero p-6 mb-6">
        <span className="kicker">Patrimonio neto (activos − deudas)</span>
        <span
          className={`font-serif-num text-[36px] font-bold block leading-tight ${
            patrimonioNeto >= 0 ? "text-[var(--color-positivo-alto)]" : "text-[var(--color-negativo-alto)]"
          }`}
        >
          {formatoCOP(patrimonioNeto)}
        </span>
        <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-white/15 text-xs">
          <span className="text-white/55">Activos líquidos: {formatoCOP(patrimonioLiquido)}</span>
          <span className="text-[var(--color-negativo-alto)]">Deudas: {formatoCOP(deudaTotal)}</span>
        </div>
      </div>

      {/* NU */}
      <div className="ledger-card p-6 mb-6">
        <div className="flex justify-between items-baseline mb-1">
          <h2 className="section-title-editorial">Saldo NU</h2>
          <span className="text-xs text-[var(--color-muted)]">rinde {(cuentas.rendNU * 100).toFixed(1)}% E.A.</span>
        </div>
        <p className="text-xs text-[var(--color-muted)] mb-2">Acumulado mes a mes</p>
        <GraficoLinea puntos={puntosNU} />
      </div>

      {/* Cuentas */}
      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Cuentas e inversiones</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">
          Crecen con lo que confirmes como inversión. Toca un saldo si el número real no coincide.
        </p>
        <FilaSaldo
          etiqueta="NU (ahorro)"
          valor={cuentas.nu}
          onGuardar={(v) => api.editarSaldoCuenta("nu", v).then(cargarCuentas)}
        />
        <FilaSaldo
          etiqueta="XTB (inversión)"
          valor={cuentas.xtbUSD}
          sufijoUSD
          extra={formatoCOP(xtbCOP)}
          onGuardar={(v) => api.editarSaldoCuenta("xtbUSD", v).then(cargarCuentas)}
        />
        <FilaSaldo
          etiqueta="Binance (cripto)"
          valor={cuentas.binanceUSD}
          sufijoUSD
          extra={formatoCOP(binanceCOP)}
          onGuardar={(v) => api.editarSaldoCuenta("binanceUSD", v).then(cargarCuentas)}
        />
        <FilaSaldo
          etiqueta="TRM (dólar de referencia)"
          valor={cuentas.trm}
          onGuardar={(v) => api.editarConfig("trm", v).then(cargarCuentas)}
        />
      </div>

      {/* Deudas */}
      <div className="ledger-card p-6 mb-6">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="section-title-editorial">Deudas</h2>
          <span className="text-xs text-[var(--color-muted)]">
            {deudaInicialTotal > 0
              ? Math.round(((deudaInicialTotal - deudaTotal) / deudaInicialTotal) * 100)
              : 0}
            % pagado en total
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
