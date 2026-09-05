import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, formatoQuincena, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";
import GraficoLinea from "../components/GraficoLinea";
import GraficoDona from "../components/GraficoDona";
import BarraDeuda from "../components/BarraDeuda";

export default function Dashboard() {
  const [cuentas, setCuentas] = useState(null);
  const [evolucionNU, setEvolucionNU] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

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

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">Vista general</h1>
        </div>
      </header>
      <div className="flex justify-between">
        <Link to="/rafael" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          ← panel de Rafael
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
        <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
          <span className="text-[#5c5347]">Bancolombia (puente)</span>
          <span className="font-serif-num font-semibold">{formatoCOP(cuentas.bancolombia)}</span>
        </div>
        <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
          <span className="text-[#5c5347]">XTB (inversión)</span>
          <span className="font-serif-num font-semibold">
            {cuentas.xtbUSD.toFixed(2)} USD
            <span className="text-xs text-[var(--color-muted)] font-sans"> · {formatoCOP(xtbCOP)}</span>
          </span>
        </div>
        <div className="flex justify-between items-baseline py-2 text-[13.5px]">
          <span className="text-[#5c5347]">Binance (cripto)</span>
          <span className="font-serif-num font-semibold">
            {cuentas.binanceUSD.toFixed(2)} USD
            <span className="text-xs text-[var(--color-muted)] font-sans"> · {formatoCOP(binanceCOP)}</span>
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-muted)] mt-2">TRM referencia: {formatoCOP(cuentas.trm)}</p>
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
