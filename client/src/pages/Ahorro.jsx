import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navegacion from "../components/Navegacion";
import { api, formatoCOP, formatoQuincena } from "../api";
import GraficoLinea from "../components/GraficoLinea";
import FilaValorEditable from "../components/FilaValorEditable";

const MESES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function etiquetaMes(prefijo) {
  const [anio, mes] = prefijo.split("-");
  return `${MESES[Number(mes)]} ${anio.slice(2)}`;
}

export default function Ahorro() {
  const [cuentas, setCuentas] = useState(null);
  const [mensual, setMensual] = useState([]);
  const [porQuincena, setPorQuincena] = useState([]);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    return Promise.all([
      api.getCuentas(),
      api.getEvolucionNUMensual(),
      api.getEvolucionNU(),
    ]).then(([c, m, q]) => {
      setCuentas(c);
      setMensual(m);
      setPorQuincena(q);
      setCargando(false);
    });
  }

  useEffect(() => {
    cargar();
  }, []);

  if (cargando || !cuentas) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }

  const puntos = mensual.map((m) => ({ label: etiquetaMes(m.mes), valor: m.saldo }));
  const aportado = mensual.reduce((a, m) => a + m.aporte, 0);
  const xtbCOP = cuentas.xtbUSD * cuentas.trm;
  const binanceCOP = cuentas.binanceUSD * cuentas.trm;

  // Solo las quincenas donde de verdad se aporto algo: la lista es para ver
  // el historial de aportes, no todas las quincenas existentes.
  const aportes = [...porQuincena].filter((p) => p.aNU > 0).reverse();

  const rendimientoMensual = Math.round((cuentas.nu * cuentas.rendNU) / 12);

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Ahorro e inversión</h1>
        </div>
      </header>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />
      <Navegacion />

      <div className="ledger-card ledger-card--hero p-6 mb-6">
        <span className="kicker">Saldo NU</span>
        <span className="font-serif-num text-[36px] font-bold block leading-tight text-[var(--color-positivo-alto)]">
          {formatoCOP(cuentas.nu)}
        </span>
        <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-white/15 text-xs">
          <span className="text-white/55">Aportado: {formatoCOP(aportado)}</span>
          <span className="text-white/55">Rinde {(cuentas.rendNU * 100).toFixed(1)}% E.A.</span>
        </div>
        <p className="text-xs text-white/50 mt-3">
          A esa tasa te genera cerca de {formatoCOP(rendimientoMensual)} al mes sin hacer nada.
        </p>
      </div>

      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Cómo ha crecido</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">Saldo acumulado mes a mes</p>
        <GraficoLinea puntos={puntos} />
      </div>

      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Aportes que has confirmado</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">
          El saldo sube solo con lo que confirmas en tu panel, en "Inversiones y ahorro".
        </p>
        {aportes.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] py-3">
            Todavía no has confirmado ningún aporte al NU.
          </p>
        ) : (
          aportes.map((p) => (
            <div
              key={p.quincenaId}
              className="flex justify-between items-baseline dashed-row py-2.5 text-[13.5px]"
            >
              <span>{formatoQuincena(p.quincenaId)}</span>
              <span className="font-serif-num font-bold text-[var(--color-positivo)]">
                + {formatoCOP(p.aNU)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Otras inversiones</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">
          Toca un saldo si el número real no coincide.
        </p>
        <FilaValorEditable
          etiqueta="XTB (inversión)"
          valor={cuentas.xtbUSD}
          sufijoUSD
          extra={formatoCOP(xtbCOP)}
          onGuardar={(v) => api.editarSaldoCuenta("xtbUSD", v).then(cargar)}
        />
        <FilaValorEditable
          etiqueta="Binance (cripto)"
          valor={cuentas.binanceUSD}
          sufijoUSD
          extra={formatoCOP(binanceCOP)}
          onGuardar={(v) => api.editarSaldoCuenta("binanceUSD", v).then(cargar)}
        />
        <FilaValorEditable
          etiqueta="TRM (dólar de referencia)"
          valor={cuentas.trm}
          onGuardar={(v) => api.editarConfig("trm", v).then(cargar)}
        />
      </div>

      <Link
        to="/graficas"
        className="border border-[var(--color-ledger-border)] rounded-[18px] py-4 text-center font-semibold text-[15px] bg-[var(--color-ledger)] hover:bg-white hover:shadow-sm transition-all"
      >
        Ver gráficas y análisis
      </Link>
    </div>
  );
}
