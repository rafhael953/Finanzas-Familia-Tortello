import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, formatoQuincena, partesQuincena } from "../api";
import TarjetaSaldo from "../components/TarjetaSaldo";
import FilaCategoria from "../components/FilaCategoria";
import FormMovimiento from "../components/FormMovimiento";
import ListaMovimientos from "../components/ListaMovimientos";
import GraficoDona from "../components/GraficoDona";
import SelectorQuincena from "../components/SelectorQuincena";

export default function PanelRafael() {
  const [quincenaIdActual, setQuincenaIdActual] = useState(null);
  const [lista, setLista] = useState([]);
  const [estado, setEstado] = useState(null);
  const [deudas, setDeudas] = useState([]);
  const [cuentas, setCuentas] = useState(null);
  const [resumenJerardith, setResumenJerardith] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargarTodo = useCallback(async (id) => {
    const [est, d, c, j, a] = await Promise.all([
      api.getEstadoQuincena(id),
      api.getDeudas(),
      api.getCuentas(),
      api.getResumenJerardith(),
      api.getAlertasDeudas(),
    ]);
    setEstado(est);
    setDeudas(d);
    setCuentas(c);
    setResumenJerardith(j);
    setAlertas(a);
  }, []);

  useEffect(() => {
    (async () => {
      const [actual, listaQ] = await Promise.all([api.getQuincenaActual(), api.getListaQuincenas()]);
      // Preferimos la ultima quincena que el usuario estaba viendo (guardada
      // en este dispositivo) en vez de saltar siempre a la fecha del sistema
      // — que puede no coincidir con el dia real si el reloj esta desfasado.
      const guardada = localStorage.getItem("ultimaQuincena");
      const idInicial = guardada || actual.id;
      setQuincenaIdActual(idInicial);
      setLista(listaQ.includes(idInicial) ? listaQ : [...listaQ, idInicial].sort());
      await cargarTodo(idInicial);
      setCargando(false);
    })();
  }, [cargarTodo]);

  async function cambiarQuincena(id) {
    setCargando(true);
    setQuincenaIdActual(id);
    localStorage.setItem("ultimaQuincena", id);
    setLista((prev) => (prev.includes(id) ? prev : [...prev, id].sort()));
    await cargarTodo(id);
    setCargando(false);
    setMostrarSelector(false);
  }

  async function guardarMovimiento(mov) {
    await api.agregarMovimiento(mov);
    setMostrarForm(false);
    await cargarTodo(quincenaIdActual);
  }

  if (cargando || !estado) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }

  const idxActual = lista.indexOf(quincenaIdActual);
  const hayAnterior = idxActual > 0;
  const haySiguiente = idxActual >= 0 && idxActual < lista.length - 1;

  const deudaTotal = deudas.reduce((a, d) => a + d.saldo, 0);
  const balanceNegativo = estado.balanceConfirmado < 0;
  const hayPendientes = estado.balanceProyectado !== estado.balanceConfirmado;
  // La prima solo llega en junio y diciembre — el resto del año no tiene
  // sentido ofrecerla para confirmar.
  const mesPrimaHabilitado = [6, 12].includes(partesQuincena(quincenaIdActual).mes);

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Panel Rafael</h1>
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

      {alertas.length > 0 && (
        <div className="mb-6 bg-[#FBEFD9] border border-[#E0BB6B] rounded-md p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A5A00] mb-2">
            ⚠ Cuotas atrasadas
          </p>
          {alertas.map((a) => (
            <p key={a.categoria} className="text-[13px] text-[#5c4400] py-1">
              <span className="font-semibold capitalize">{a.categoria}</span>: {a.mensaje}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-between items-end mb-7">
        <TarjetaSaldo titulo="Deuda total restante" valor={deudaTotal} tono="negativo" />
        <div className="text-right">
          <span className="font-serif-num text-[22px] font-bold text-[var(--color-positivo)] block">
            {formatoCOP(cuentas.nu)}
          </span>
          <span className="kicker">Saldo NU</span>
        </div>
      </div>

      {/* Tarjeta de quincena / ledger -- es el "titular" de la pagina */}
      <div className="ledger-card ledger-card--hero p-6 mb-6">
        <div className="dashed-row pb-3 mb-3">
          <div className="flex justify-between items-center">
            <button
              disabled={!hayAnterior}
              onClick={() => cambiarQuincena(lista[idxActual - 1])}
              className="text-white/50 disabled:opacity-20 text-lg leading-none px-1"
              aria-label="Quincena anterior"
            >
              ‹
            </button>
            <button
              onClick={() => setMostrarSelector((v) => !v)}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="font-serif italic text-[17px] text-center">{formatoQuincena(quincenaIdActual)}</span>
              <span className="text-[10px] text-[var(--color-acento-vivo)] underline">▾ cambiar</span>
            </button>
            <button
              disabled={!haySiguiente}
              onClick={() => cambiarQuincena(lista[idxActual + 1])}
              className="text-white/50 disabled:opacity-20 text-lg leading-none px-1"
              aria-label="Quincena siguiente"
            >
              ›
            </button>
          </div>
          {mostrarSelector && (
            <SelectorQuincena
              quincenaId={quincenaIdActual}
              onIr={cambiarQuincena}
              onCerrar={() => setMostrarSelector(false)}
            />
          )}
        </div>

        {balanceNegativo && (
          <div className="mb-3 text-xs text-[var(--color-negativo-alto)] font-medium">
            ⚠ Balance real negativo esta quincena
          </div>
        )}

        <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
          <span className="text-white/60">Ingresos confirmados</span>
          <span className="font-serif-num font-semibold">{formatoCOP(estado.ingresosConfirmado)}</span>
        </div>
        <div className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
          <span className="text-white/60">Egresos confirmados</span>
          <span className="font-serif-num font-semibold">{formatoCOP(estado.egresoConfirmado)}</span>
        </div>

        <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-white/20">
          <span className="text-[11px] uppercase tracking-wide font-bold text-white/70">Balance al día</span>
          <span
            className={`font-serif-num font-bold text-[32px] ${
              balanceNegativo ? "text-[var(--color-negativo-alto)]" : "text-[var(--color-positivo-alto)]"
            }`}
          >
            {formatoCOP(estado.balanceConfirmado)}
          </span>
        </div>

        {hayPendientes && (
          <div className="mt-2 flex justify-between items-baseline text-xs text-[#E8C468]">
            <span>Si se cumple lo pendiente → balance proyectado</span>
            <span className="font-serif-num font-semibold">{formatoCOP(estado.balanceProyectado)}</span>
          </div>
        )}

        {estado.sobrante > 0 && (
          <div className="mt-3 text-xs text-white/50">
            → {formatoCOP(estado.aNU)} al NU · {formatoCOP(estado.aDeuda)} a abono extra de deuda (con lo confirmado hasta ahora)
          </div>
        )}

        <Link
          to="/historial"
          className="text-xs text-white/50 underline hover:text-white mt-3 block text-center"
        >
          ver historial completo desde el inicio →
        </Link>
      </div>

      <Link to="/dashboard" className="ledger-card p-6 mb-6 block hover:shadow-md transition-shadow">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="section-title-editorial">Distribución (confirmado)</h2>
          <span className="text-xs text-[var(--color-muted)] underline">ver gráficas completas →</span>
        </div>
        <GraficoDona
          segmentos={[
            { nombre: "Gastos", valor: estado.gastosConfirmado },
            { nombre: "Deudas", valor: estado.deudasConfirmado },
            { nombre: "Inversiones", valor: estado.inversionesConfirmado },
          ]}
        />
      </Link>

      {/* Agregar movimiento */}
      {mostrarForm ? (
        <div className="mb-6">
          <FormMovimiento
            quincenaId={quincenaIdActual}
            onGuardado={guardarMovimiento}
            onCancelar={() => setMostrarForm(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setMostrarForm(true)}
          className="bg-[var(--color-acento-vivo)] text-white rounded-md py-4 text-center font-semibold text-[15px] mb-6 shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
        >
          + Agregar movimiento
        </button>
      )}

      {/* Lista editable de movimientos: confirmar/editar/borrar item a item */}
      <div className="ledger-card p-6 mb-6">
        <button
          onClick={() => setMostrarLista((v) => !v)}
          className="section-title-editorial mb-1 w-full text-left"
        >
          {mostrarLista ? "▾" : "▸"} Movimientos de la quincena ({estado.movimientos.length})
        </button>
        <p className="text-xs text-[var(--color-muted)] mb-2">
          Toca el monto para editarlo, el círculo para confirmar/marcar como plan.
        </p>
        {mostrarLista && (
          <ListaMovimientos movimientos={estado.movimientos} onCambio={() => cargarTodo(quincenaIdActual)} />
        )}
      </div>

      {/* Categorias — cada una con confirmacion rapida si aun esta en $0 */}
      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Ingresos</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">Confirma cada uno apenas te llegue.</p>
        {estado.ingresos
          .filter((i) => i.categoria !== "prima" || mesPrimaHabilitado || i.total > 0)
          .map((i) => (
            <FilaCategoria
              key={i.categoria}
              categoria={i.categoria}
              tipo="ingreso"
              confirmado={i.confirmado}
              pendiente={i.pendiente}
              presupuesto={i.presupuesto}
              quincenaId={quincenaIdActual}
              onCambio={() => cargarTodo(quincenaIdActual)}
            />
          ))}
      </div>

      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Gastos de la quincena</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">Confirma cada uno a medida que lo pagas.</p>
        {estado.gastos
          .filter((g) => g.total > 0 || g.presupuesto > 0)
          .map((g) => (
            <FilaCategoria
              key={g.categoria}
              categoria={g.categoria}
              tipo="gasto"
              confirmado={g.confirmado}
              pendiente={g.pendiente}
              presupuesto={g.presupuesto}
              quincenaId={quincenaIdActual}
              onCambio={() => cargarTodo(quincenaIdActual)}
            />
          ))}
      </div>

      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Estado de las deudas</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">Confirma cada cuota cuando la pagues.</p>
        {estado.deudas.map((d) => (
          <FilaCategoria
            key={d.categoria}
            categoria={d.categoria}
            tipo="deuda"
            confirmado={d.confirmado}
            pendiente={d.pendiente}
            presupuesto={d.presupuesto}
            pagadoEnOtraQuincena={d.pagadoEnOtraQuincena}
            quincenaId={quincenaIdActual}
            onCambio={() => cargarTodo(quincenaIdActual)}
          />
        ))}
      </div>

      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-1">Inversiones</h2>
        <p className="text-xs text-[var(--color-muted)] mb-2">Opcional — solo si invertiste algo esta quincena.</p>
        {estado.inversiones.map((r) => (
          <FilaCategoria
            key={r.categoria}
            categoria={r.categoria}
            tipo="inversion"
            confirmado={r.confirmado}
            pendiente={r.pendiente}
            presupuesto={0}
            quincenaId={quincenaIdActual}
            onCambio={() => cargarTodo(quincenaIdActual)}
          />
        ))}
      </div>

      <Link
        to="/rafael/deudas"
        className="border border-[var(--color-ledger-border)] rounded-md py-4 text-center font-semibold text-[15px] mb-6 bg-[var(--color-ledger)] hover:bg-white hover:border-[var(--color-muted)] hover:shadow-sm transition-all"
      >
        Ver deudas y plan de pagos
      </Link>

      {resumenJerardith && (
        <div className="ledger-card p-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="section-title-editorial">Resumen de Jerardith (esta quincena)</h2>
            <span
              className={`text-[11px] font-semibold ${
                resumenJerardith.activa ? "text-[var(--color-positivo)]" : "text-[#B58A00]"
              }`}
            >
              {resumenJerardith.activa ? "✓ Activa" : "● Inactiva"}
            </span>
          </div>
          {resumenJerardith.resumen.map((r) => (
            <div key={r.rubro} className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
              <span className="capitalize text-[#5c5347]">{r.rubro}</span>
              <span className="font-serif-num font-semibold">
                {formatoCOP(r.gastado)}
                <span className="text-xs text-[var(--color-muted)] font-sans"> / {formatoCOP(r.presupuesto)}</span>
              </span>
            </div>
          ))}
          <button
            onClick={async () => {
              if (resumenJerardith.activa) {
                await api.desactivarJerardith(resumenJerardith.quincenaActual);
              } else {
                await api.activarJerardith(resumenJerardith.quincenaActual);
              }
              await cargarTodo(quincenaIdActual);
            }}
            className={`w-full mt-3 rounded-md py-2.5 font-semibold text-sm ${
              resumenJerardith.activa
                ? "border border-[var(--color-ledger-border)] text-[#5c5347]"
                : "bg-[var(--color-positivo)] text-white"
            }`}
          >
            {resumenJerardith.activa ? "Desactivar para Jerardith" : "Activar quincena para Jerardith"}
          </button>
          {!resumenJerardith.activa && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Ella puede ver sus rubros, pero no podrá registrar gastos hasta que actives.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
