import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, ETIQUETAS_CATEGORIA } from "../api";
import BarraDeuda from "../components/BarraDeuda";
import FilaValorEditable from "../components/FilaValorEditable";

const TARJETAS = ["falabella", "rappi"];

function FormCompraTarjeta({ onGuardado, onCancelar }) {
  const [tarjeta, setTarjeta] = useState(TARJETAS[0]);
  const [monto, setMonto] = useState("");
  const [cuotas, setCuotas] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cuotaMensual = monto && cuotas ? Math.round(Number(monto) / Number(cuotas)) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!monto || Number(monto) <= 0) return setError("Ingresa un monto válido");
    if (!cuotas || Number(cuotas) <= 0) return setError("Ingresa un número de cuotas válido");
    setGuardando(true);
    try {
      await onGuardado({ tarjeta, monto: Number(monto), cuotas: Number(cuotas), fecha, descripcion });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ledger-card p-6 mb-6 flex flex-col gap-4">
      <h2 className="section-title-editorial">Registrar compra con tarjeta</h2>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Tarjeta</label>
        <div className="grid grid-cols-2 gap-1">
          {TARJETAS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTarjeta(t)}
              className={`rounded-lg py-2 text-xs font-medium ${
                tarjeta === t ? "bg-[var(--color-acento)] text-white" : "bg-black/5"
              }`}
            >
              {ETIQUETAS_CATEGORIA[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Monto de la compra</label>
        <input
          type="number"
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="600000"
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Número de cuotas</label>
        <input
          type="number"
          inputMode="numeric"
          value={cuotas}
          onChange={(e) => setCuotas(e.target.value)}
          placeholder="6"
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
        {cuotaMensual > 0 && (
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Esto sube la cuota mensual de {ETIQUETAS_CATEGORIA[tarjeta]} en {formatoCOP(cuotaMensual)}/mes.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Descripción (opcional)</label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
        />
      </div>

      {error && <p className="text-[var(--color-negativo)] text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 bg-[var(--color-acento)] text-white rounded-md py-3 font-semibold text-base disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Registrar compra"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 bg-transparent border border-[var(--color-ledger-border)] rounded-md py-3 font-semibold text-base text-[var(--color-texto)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// Una compra ya registrada, que se puede corregir o borrar. Al guardar o
// borrar, el servidor revierte el efecto anterior sobre el saldo y la
// cuota mensual de esa tarjeta, asi que los numeros siguen cuadrando.
function FilaCompra({ compra, onCambio }) {
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState(String(compra.monto));
  const [cuotas, setCuotas] = useState(String(compra.cuotas));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  async function guardar() {
    if (!monto || Number(monto) <= 0) return setError("Monto inválido");
    if (!cuotas || Number(cuotas) <= 0) return setError("Cuotas inválidas");
    setOcupado(true);
    setError("");
    try {
      await api.editarCompraTarjeta(compra.id, {
        monto: Number(monto),
        cuotas: Number(cuotas),
      });
      setEditando(false);
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function borrar() {
    setOcupado(true);
    setError("");
    try {
      await api.borrarCompraTarjeta(compra.id);
      await onCambio();
    } catch (err) {
      setError(err.message);
      setOcupado(false);
    }
  }

  if (editando) {
    return (
      <div className="dashed-row py-3">
        <p className="text-[13.5px] font-medium mb-2">{ETIQUETAS_CATEGORIA[compra.tarjeta]}</p>
        <div className="flex gap-2 mb-2">
          <label className="flex-1 text-[11px] text-[var(--color-muted)]">
            Monto
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="font-serif-num w-full text-right border border-[var(--color-ledger-border)] rounded-md px-2 py-1.5 text-[13px] bg-[var(--color-fondo)]/40"
              autoFocus
            />
          </label>
          <label className="w-24 text-[11px] text-[var(--color-muted)]">
            Cuotas
            <input
              type="number"
              value={cuotas}
              onChange={(e) => setCuotas(e.target.value)}
              className="font-serif-num w-full text-right border border-[var(--color-ledger-border)] rounded-md px-2 py-1.5 text-[13px] bg-[var(--color-fondo)]/40"
            />
          </label>
        </div>
        {monto && cuotas && Number(cuotas) > 0 && (
          <p className="text-[11px] text-[var(--color-muted)] mb-2">
            Nueva cuota: {formatoCOP(Math.round(Number(monto) / Number(cuotas)))}/mes
          </p>
        )}
        {error && <p className="text-[var(--color-negativo)] text-xs mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={guardar}
            disabled={ocupado}
            className="text-[11px] font-semibold bg-[var(--color-positivo)] text-white rounded-md px-3 py-1.5 disabled:opacity-40"
          >
            Guardar
          </button>
          <button
            onClick={() => setEditando(false)}
            className="text-[11px] font-semibold border border-[var(--color-ledger-border)] rounded-md px-3 py-1.5"
          >
            Cancelar
          </button>
          <button
            onClick={borrar}
            disabled={ocupado}
            className="text-[11px] font-semibold text-[var(--color-negativo)] ml-auto disabled:opacity-40"
          >
            Eliminar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditando(true)}
      className="dashed-row py-2.5 flex justify-between items-baseline w-full text-left"
    >
      <span>
        <span className="text-[13.5px] font-medium">
          {ETIQUETAS_CATEGORIA[compra.tarjeta]}
          <span className="text-[10px] text-[var(--color-muted)] uppercase ml-1.5">
            {compra.cuotas} cuotas
          </span>
        </span>
        <span className="text-[11px] text-[var(--color-muted)] block">
          {compra.fecha} {compra.descripcion ? `· ${compra.descripcion}` : ""} · +
          {formatoCOP(compra.cuotaMensual)}/mes
        </span>
      </span>
      <span className="font-serif-num font-semibold text-[14px] underline decoration-dotted">
        {formatoCOP(compra.monto)}
      </span>
    </button>
  );
}

export default function Deudas() {
  const [deudas, setDeudas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [proyeccion, setProyeccion] = useState(null);
  const [mostrarPlan, setMostrarPlan] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(true);

  function cargar() {
    return Promise.all([api.getDeudas(), api.getComprasTarjeta()]).then(([d, c]) => {
      setDeudas(d);
      setCompras(c);
      setCargando(false);
    });
  }

  // Cualquier cambio en saldos o cuotas invalida la proyeccion: se vuelve a
  // pedir para que el plan no quede mostrando numeros viejos.
  async function recargarTodo() {
    await cargar();
    if (proyeccion) {
      const p = await api.getDeudasProyeccion();
      setProyeccion(p);
    }
  }

  useEffect(() => {
    cargar();
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

  async function guardarAbonoExtra(valor) {
    await api.editarConfig("abonoExtraMensual", valor);
    const p = await api.getDeudasProyeccion();
    setProyeccion(p);
  }

  async function registrarCompra(compra) {
    await api.registrarCompraTarjeta(compra);
    setMostrarForm(false);
    setProyeccion(null);
    await cargar();
  }

  const nombres = deudas.map((d) => d.nombre);

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Deudas</h1>
        </div>
      </header>
      <div className="flex justify-end">
        <Link to="/rafael" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          volver
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-6" />

      {cargando ? (
        <p className="text-center py-8 font-serif-num">Cargando...</p>
      ) : (
        <>
          <div className="ledger-card p-6 mb-6">
            <h2 className="section-title-editorial mb-2">Estado actual</h2>
            {deudas.map((d) => (
              <BarraDeuda key={d.nombre} nombre={d.nombre} saldo={d.saldo} saldoInicial={d.saldoInicial} />
            ))}
          </div>

          <div className="ledger-card p-6 mb-6">
            <h2 className="section-title-editorial mb-1">Cuota mensual recomendada</h2>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              Es una línea base, no un valor fijo — tócala para ajustarla.
            </p>
            {deudas.map((d) => (
              <FilaValorEditable
                key={d.nombre}
                etiqueta={ETIQUETAS_CATEGORIA[d.nombre] || d.nombre}
                valor={d.cuotaRecomendada}
                onGuardar={(v) => api.editarCuotaDeuda(d.nombre, v).then(recargarTodo)}
              />
            ))}
          </div>

          {mostrarForm ? (
            <FormCompraTarjeta onGuardado={registrarCompra} onCancelar={() => setMostrarForm(false)} />
          ) : (
            <button
              onClick={() => setMostrarForm(true)}
              className="bg-[var(--color-acento)] text-white rounded-md py-4 text-center font-semibold text-[15px] mb-6 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              + Registrar compra con tarjeta
            </button>
          )}

          {compras.length > 0 && (
            <div className="ledger-card p-6 mb-6">
              <h2 className="section-title-editorial mb-1">Compras a cuotas registradas</h2>
              <p className="text-xs text-[var(--color-muted)] mb-2">
                Toca una para corregir el monto o las cuotas, o para borrarla.
              </p>
              {[...compras].reverse().map((c) => (
                <FilaCompra key={c.id} compra={c} onCambio={recargarTodo} />
              ))}
            </div>
          )}

          <button
            onClick={cargarPlan}
            className="border border-[var(--color-ledger-border)] rounded-md py-3 text-center font-semibold text-sm mb-6 bg-[var(--color-ledger)] hover:bg-white hover:border-[var(--color-muted)] hover:shadow-sm transition-all"
          >
            {mostrarPlan ? "Ocultar plan de pagos" : "Ver plan de pagos"}
          </button>

          {mostrarPlan && proyeccion && (
            <div className="ledger-card p-6 overflow-x-auto">
              <h2 className="section-title-editorial mb-1">Plan de pagos</h2>
              <p className="text-xs text-[var(--color-muted)] mb-2">
                Proyección con las cuotas de arriba. Si además vas a abonar de más cada mes,
                ponlo aquí — si lo dejas en $0 verás el escenario realista sin abonos extra.
              </p>
              <FilaValorEditable
                etiqueta="Abono extra mensual"
                valor={proyeccion.abonoExtraMensual}
                onGuardar={guardarAbonoExtra}
              />
              <p className="text-[11px] text-[var(--color-muted)] mt-2 mb-4">
                Referencia: si cada quincena cerrara exactamente como está presupuestado,
                sobrarían {formatoCOP(proyeccion.sobranteMensualBase)} al mes.
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
