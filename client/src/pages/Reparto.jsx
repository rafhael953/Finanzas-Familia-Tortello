import { useEffect, useState } from "react";
import Navegacion from "../components/Navegacion";
import { api, formatoCOP, ETIQUETAS_CATEGORIA } from "../api";
import FilaValorEditable from "../components/FilaValorEditable";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function nombreMes(prefijo) {
  const [anio, mes] = prefijo.split("-");
  return `${MESES[Number(mes)]} ${anio}`;
}

// Una quincena del reparto: lo que entra, lo que ya está comprometido y lo
// que queda libre de verdad. En rojo si no alcanza.
function Quincena({ titulo, plan, quincena, onMover, onSoltar, ocupado }) {
  const rojo = !plan.alcanza;
  const otra = quincena === 1 ? 2 : 1;

  return (
    <div className="ledger-card p-6 mb-4">
      <div className="flex justify-between items-baseline dashed-row pb-2 mb-3">
        <h2 className="section-title-editorial">{titulo}</h2>
        <span className="font-serif-num font-semibold text-[15px]">
          {formatoCOP(plan.ingreso)}
        </span>
      </div>

      <div className="flex justify-between items-baseline py-1.5 text-[13.5px]">
        <span className="text-[var(--color-muted)]">Gastos fijos</span>
        <span className="font-serif-num">− {formatoCOP(plan.fijos)}</span>
      </div>

      <div className="flex justify-between items-baseline py-1.5 text-[13.5px]">
        <span className="text-[var(--color-muted)]">Cuotas de deuda</span>
        <span className="font-serif-num">− {formatoCOP(plan.totalCuotas)}</span>
      </div>

      {plan.cuotas.length > 0 && (
        <div className="pl-3 border-l-2 border-[var(--color-ledger-rule)] ml-1 my-1">
          {plan.cuotas.map((c) => (
            <div key={c.categoria} className="flex justify-between items-center py-1.5 text-[12.5px] gap-2">
              <span className="text-[var(--color-muted)] min-w-0 truncate">
                {ETIQUETAS_CATEGORIA[c.categoria] || c.categoria}
                {c.aMano && (
                  <button
                    onClick={() => onSoltar(c.categoria)}
                    disabled={ocupado}
                    className="ml-1.5 text-[10px] uppercase text-[var(--color-acento)] underline decoration-dotted"
                    title="Volver a dejar que la app la acomode sola"
                  >
                    fija
                  </button>
                )}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="font-serif-num text-[var(--color-muted)]">{formatoCOP(c.valor)}</span>
                <button
                  onClick={() => onMover(c.categoria, otra)}
                  disabled={ocupado}
                  className="text-[11px] font-semibold text-[var(--color-acento)] border border-[var(--color-ledger-border)] rounded-full px-2 py-0.5 disabled:opacity-40"
                  title={`Pagarla con la quincena ${otra}`}
                >
                  {quincena === 1 ? "→ Q2" : "← Q1"}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className={`flex justify-between items-baseline mt-3 pt-3 border-t border-dashed ${
          rojo ? "border-[var(--color-negativo)]" : "border-[var(--color-ledger-rule)]"
        }`}
      >
        <span className={`font-semibold text-[13.5px] ${rojo ? "text-[var(--color-negativo)]" : ""}`}>
          {rojo ? "No alcanza" : "Te queda libre"}
        </span>
        <span
          className={`font-serif-num font-bold text-[18px] ${
            rojo ? "text-[var(--color-negativo)]" : "text-[var(--color-positivo)]"
          }`}
        >
          {formatoCOP(plan.libre)}
        </span>
      </div>
    </div>
  );
}

export default function Reparto() {
  const [datos, setDatos] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  function cargar() {
    return api.getAsesor().then(setDatos);
  }

  // Mover una cuota la deja fijada a esa quincena; las demás se siguen
  // acomodando solas alrededor.
  async function mover(categoria, quincena) {
    setOcupado(true);
    try {
      setDatos(await api.moverCuota(categoria, quincena));
    } finally {
      setOcupado(false);
    }
  }

  async function soltar(categoria) {
    setOcupado(true);
    try {
      setDatos(await api.soltarCuota(categoria));
    } finally {
      setOcupado(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  if (!datos) return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;

  const { meta, tarjetas, cupoCredito, reparto, meses, quincenaActual } = datos;
  const enRojo = meses.filter((m) => m.estado !== "bien");

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="mb-1">
        <div className="kicker">Tortello · Libro de finanzas</div>
        <h1 className="font-serif text-[30px] font-semibold tracking-tight">Cómo repartir</h1>
      </header>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />
      <Navegacion />

      {/* Lo primero: cómo va la quincena que se está viviendo ahora */}
      <div
        className={`ledger-card p-6 mb-6 ${
          quincenaActual.excedido || quincenaActual.enRiesgo ? "" : "ledger-card--hero"
        }`}
        style={
          quincenaActual.excedido
            ? { background: "#2B1416", color: "white" }
            : quincenaActual.enRiesgo
            ? { background: "#7A2E1E", color: "white" }
            : undefined
        }
      >
        <span className="kicker" style={{ color: "rgba(255,255,255,.6)" }}>
          {quincenaActual.excedido
            ? "Ya te pasaste en esta quincena"
            : quincenaActual.enRiesgo
            ? "Riesgo en esta quincena"
            : "Vas bien en esta quincena"}
        </span>
        <span className="font-serif-num text-[34px] font-bold block leading-tight text-white">
          {formatoCOP(quincenaActual.disponibleReal)}
        </span>
        <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,.6)" }}>
          Entró {formatoCOP(quincenaActual.entro)} · ya salió{" "}
          {formatoCOP(quincenaActual.salio)}
        </p>
        {quincenaActual.faltaPorPagar > 0 && (
          <p className="text-xs mt-2 pt-2 border-t border-dashed border-white/15" style={{ color: "rgba(255,255,255,.75)" }}>
            Todavía falta pagar {formatoCOP(quincenaActual.faltaPorPagar)} de lo
            comprometido{" "}
            {quincenaActual.enRiesgo && "— y eso no cabe en lo que queda."}
          </p>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted)] mb-3 -mt-3">
        Así queda repartida la carga entre las dos quincenas para que ninguna
        se ahogue. Es la guía: si pagas siguiendo esto, el mes cierra.
      </p>

      <Quincena
        titulo="Quincena 1 · del 16 al 31"
        plan={reparto.q1}
        quincena={1}
        onMover={mover}
        onSoltar={soltar}
        ocupado={ocupado}
      />
      <Quincena
        titulo="Quincena 2 · del 1 al 15"
        plan={reparto.q2}
        quincena={2}
        onMover={mover}
        onSoltar={soltar}
        ocupado={ocupado}
      />

      {reparto.desbalance > 600000 && (
        <p className="text-xs text-[#B0842A] -mt-2 mb-4">
          Las dos quincenas quedaron bastante disparejas (
          {formatoCOP(reparto.desbalance)} de diferencia). Se puede, pero una va
          a ir mucho más apretada que la otra.
        </p>
      )}

      <div className="ledger-card p-6 mb-6">
        <div className="flex justify-between items-baseline">
          <h2 className="section-title-editorial">Te queda libre al mes</h2>
          <span
            className={`font-serif-num font-bold text-[18px] ${
              reparto.libreMes >= 0 ? "text-[var(--color-positivo)]" : "text-[var(--color-negativo)]"
            }`}
          >
            {formatoCOP(reparto.libreMes)}
          </span>
        </div>
      </div>

      {/* Meta calculada de lo real, no puesta a dedo */}
      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Meta de ahorro realista</h2>
        <p className="text-xs text-[var(--color-muted)] mb-3">
          Sale de lo que de verdad te sobró en los últimos {meta.mesesMirados}{" "}
          meses cerrados. Si mejoras, sube sola.
        </p>
        <div className="flex justify-between items-baseline">
          <span className="font-serif-num text-[26px] font-bold text-[var(--color-positivo)]">
            {formatoCOP(meta.valor)}
          </span>
          <span className="text-sm text-[var(--color-muted)]">{meta.porcentaje}% de lo que entra</span>
        </div>
        <div className="mt-3 pt-3 border-t border-dashed border-[var(--color-ledger-rule)]">
          {meta.base.map((b) => (
            <div key={b.mes} className="flex justify-between text-[12.5px] py-1">
              <span className="text-[var(--color-muted)]">{nombreMes(b.mes)}</span>
              <span
                className={`font-serif-num ${
                  b.neto < 0 ? "text-[var(--color-negativo)]" : "text-[var(--color-muted)]"
                }`}
              >
                {formatoCOP(b.neto)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* El cupo de tarjetas: la causa de los meses en rojo */}
      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Cupo de tarjeta este mes</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">
          Cuánto te permites comprar con tarjeta al mes. Tócalo para ajustarlo.
        </p>
        <FilaValorEditable
          etiqueta="Tope mensual"
          valor={tarjetas.cupo}
          onGuardar={(v) => api.editarConfig("cupoTarjetasMensual", v).then(cargar)}
        />
        <div className="flex justify-between items-baseline py-2 text-[13.5px]">
          <span className="text-[var(--color-muted)]">Usado</span>
          <span className="font-serif-num">{formatoCOP(tarjetas.usado)}</span>
        </div>
        <div className="h-[6px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (tarjetas.usado / (tarjetas.cupo || 1)) * 100)}%`,
              background: tarjetas.excedido ? "var(--color-negativo)" : "var(--color-acento)",
            }}
          />
        </div>
        <p
          className={`text-xs mt-2 ${
            tarjetas.excedido ? "text-[var(--color-negativo)]" : "text-[var(--color-muted)]"
          }`}
        >
          {tarjetas.excedido
            ? `Te pasaste ${formatoCOP(-tarjetas.disponible)} del tope.`
            : `Te quedan ${formatoCOP(tarjetas.disponible)} de cupo este mes.`}
        </p>
      </div>

      {/* Cupo real de credito por tarjeta -- el limite que da el banco, no
          el tope de disciplina de arriba */}
      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Cupo real de cada tarjeta</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">
          El límite que da el banco. Si el saldo se le acerca o se lo pasa, la
          tarjeta deja de servir sin importar el tope de disciplina de arriba.
        </p>
        {(cupoCredito || []).map((c) => (
          <div key={c.categoria} className="mt-3 first:mt-0">
            <FilaValorEditable
              etiqueta={c.categoria === "rappi" ? "Rappi" : "Falabella"}
              valor={c.cupo}
              onGuardar={(v) => api.editarCupoCredito(c.categoria, v).then(cargar)}
            />
            <div className="flex justify-between items-baseline py-1 text-[13.5px]">
              <span className="text-[var(--color-muted)]">Saldo actual</span>
              <span className="font-serif-num">{formatoCOP(c.saldo)}</span>
            </div>
            <div className="h-[6px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (c.saldo / (c.cupo || 1)) * 100)}%`,
                  background: c.excedido ? "var(--color-negativo)" : "var(--color-acento)",
                }}
              />
            </div>
            <p
              className={`text-xs mt-1 ${
                c.excedido ? "text-[var(--color-negativo)]" : "text-[var(--color-muted)]"
              }`}
            >
              {c.excedido
                ? `Te pasaste ${formatoCOP(-c.disponible)} del cupo real.`
                : `Te quedan ${formatoCOP(c.disponible)} de cupo real.`}
            </p>
          </div>
        ))}
      </div>

      {/* Semáforo mes a mes */}
      <div className="ledger-card p-6">
        <h2 className="section-title-editorial mb-1">Los próximos meses</h2>
        <p className="text-xs text-[var(--color-muted)] mb-3">
          Con los ingresos, los gastos fijos y las cuotas de hoy. Un mes en rojo
          es un aviso de que algo hay que cambiar antes de que llegue.
        </p>
        {enRojo.length === 0 && (
          <p className="text-sm text-[var(--color-positivo)] mb-2">
            ✓ Ningún mes queda en rojo con las cuentas actuales.
          </p>
        )}
        {meses.map((m) => {
          const rojo = m.estado === "riesgo";
          const negro = m.estado === "pasado";
          return (
            <div key={m.mes} className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: negro ? "#1A1A1A" : rojo ? "var(--color-negativo)" : "var(--color-positivo)",
                  }}
                />
                <span className={negro ? "font-semibold text-[var(--color-negativo)]" : ""}>
                  {nombreMes(m.mes)}
                </span>
                {m.prima > 0 && (
                  <span className="text-[10px] uppercase text-[var(--color-muted)]">con prima</span>
                )}
              </span>
              <span
                className={`font-serif-num font-semibold ${
                  negro || rojo ? "text-[var(--color-negativo)]" : "text-[var(--color-texto)]"
                }`}
              >
                {formatoCOP(m.real !== null ? m.real : m.proyectado)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
