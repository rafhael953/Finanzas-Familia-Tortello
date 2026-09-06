import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navegacion from "../components/Navegacion";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";
import GraficoLinea from "../components/GraficoLinea";
import GraficoDona from "../components/GraficoDona";
import BarraDeuda from "../components/BarraDeuda";
import FilaSaldo from "../components/FilaValorEditable";

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "");

const MESES_CORTOS = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function etiquetaMes(prefijo) {
  const [anio, mes] = prefijo.split("-");
  return `${MESES_CORTOS[Number(mes)]} ${anio.slice(2)}`;
}

export default function Dashboard() {
  const [cuentas, setCuentas] = useState(null);
  const [evolucionNU, setEvolucionNU] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [respaldos, setRespaldos] = useState({ copias: [], archivosEnLaCarpeta: [] });
  const [cargando, setCargando] = useState(true);

  function cargarCuentas() {
    return api.getCuentas().then(setCuentas);
  }

  function cargarTodo() {
    return Promise.all([
      api.getCuentas(),
      api.getEvolucionNUMensual(),
      api.getDeudas(),
      api.getRespaldos().catch(() => ({ copias: [], archivosEnLaCarpeta: [] })),
    ]).then(([c, e, d, r]) => {
      setCuentas(c);
      setEvolucionNU(e);
      setDeudas(d);
      setRespaldos(r && r.copias ? r : { copias: [], archivosEnLaCarpeta: [] });
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
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />
      <Navegacion />

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
        className="border border-[var(--color-ledger-border)] rounded-[18px] py-4 text-center font-semibold text-[15px] bg-[var(--color-ledger)] hover:bg-white hover:border-[var(--color-muted)] hover:shadow-sm transition-all mb-6"
      >
        Ver plan de pagos proyectado
      </Link>

      {/* Copia de seguridad: descarga todo lo registrado en un archivo. */}
      <div className="ledger-card p-6">
        <h2 className="section-title-editorial mb-1">Copia de seguridad</h2>
        <p className="text-xs text-[var(--color-muted)] mb-3">
          Descarga todo lo registrado en un archivo. Guárdalo de vez en cuando
          en OneDrive o Drive: si algo le pasa al servidor, ahí está todo.
        </p>
        <a
          href={`${API}/api/respaldo`}
          className="bg-[var(--color-acento)] text-white rounded-[16px] py-3 px-5 font-semibold text-sm inline-block"
        >
          Descargar respaldo
        </a>

        {/* Puntos de restauracion: copias que el servidor guarda solo antes
            de cada cambio grande. Estan aca para poder recuperar algo sin
            depender de nadie. */}
        <div className="mt-5 pt-4 border-t border-dashed border-[var(--color-ledger-rule)]">
          <span className="kicker">Puntos de restauración guardados</span>
          <p className="text-xs text-[var(--color-muted)] mt-1 mb-2">
            Copias que el servidor hizo solo antes de cada cambio grande. Si
            algo se perdió, está aquí.
          </p>

          {respaldos.copias.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] py-2">
              No hay ninguna copia guardada en el servidor.
            </p>
          ) : (
            respaldos.copias.map((r) => (
              <a
                key={r.nombre}
                href={`${API}/api/respaldos/${r.nombre}`}
                className="flex justify-between items-baseline dashed-row py-2 text-[13px] hover:text-[var(--color-acento)]"
              >
                <span>{new Date(r.fecha).toLocaleString("es-CO")}</span>
                <span className="font-serif-num">{r.movimientos ?? "?"} movs ↓</span>
              </a>
            ))
          )}

          {/* Sirve para saber si un archivo esta ahi aunque no se reconozca. */}
          <details className="mt-3">
            <summary className="text-xs text-[var(--color-muted)] cursor-pointer">
              ver qué archivos hay en el servidor
            </summary>
            <pre className="text-[11px] mt-2 p-3 rounded-[12px] bg-[var(--color-fondo)]/60 border border-[var(--color-ledger-border)] overflow-x-auto whitespace-pre-wrap">
              {respaldos.archivosEnLaCarpeta.join("\n") || "(la carpeta está vacía)"}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
