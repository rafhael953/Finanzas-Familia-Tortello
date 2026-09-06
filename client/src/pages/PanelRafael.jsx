import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  api,
  formatoCOP,
  formatoQuincena,
  partesQuincena,
  quincenaAnterior,
  quincenaSiguiente,
  ETIQUETAS_CATEGORIA,
  CATEGORIA_COLOR,
} from "../api";
import FilaCategoria from "../components/FilaCategoria";
import FormMovimiento from "../components/FormMovimiento";
import ListaMovimientos from "../components/ListaMovimientos";
import GraficoDona from "../components/GraficoDona";
import SelectorQuincena from "../components/SelectorQuincena";
import SeccionPlegable from "../components/SeccionPlegable";
import PlanIdeal from "../components/PlanIdeal";

export default function PanelRafael() {
  const [quincenaIdActual, setQuincenaIdActual] = useState(null);
  const [estado, setEstado] = useState(null);
  const [deudas, setDeudas] = useState([]);
  const [cuentas, setCuentas] = useState(null);
  const [resumenJerardith, setResumenJerardith] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [alertaAbierta, setAlertaAbierta] = useState(false);
  const [cargando, setCargando] = useState(true);
  const inicioDeslizar = useRef(null);

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
      const actual = await api.getQuincenaActual();
      // Siempre abre en la quincena del sueldo con el que se esta viviendo
      // hoy (ver quincenaId en el servidor), para no registrar por error en
      // un periodo que no corresponde.
      const idInicial = actual.id;
      setQuincenaIdActual(idInicial);
      await cargarTodo(idInicial);
      setCargando(false);
    })();
  }, [cargarTodo]);

  async function cambiarQuincena(id) {
    setCargando(true);
    setQuincenaIdActual(id);
    localStorage.setItem("ultimaQuincena", id);
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

  const deudaTotal = deudas.reduce((a, d) => a + d.saldo, 0);
  const faltanteTotal = alertas.reduce((a, x) => a + x.faltante, 0);
  const balanceNegativo = estado.balanceConfirmado < 0;

  // Deslizar la tarjeta de quincena para moverse entre periodos, ademas de
  // las flechas: en el celular es el gesto natural.
  function alEmpezarDeslizar(e) {
    inicioDeslizar.current = e.touches[0].clientX;
  }
  function alSoltarDeslizar(e) {
    if (inicioDeslizar.current == null) return;
    const recorrido = e.changedTouches[0].clientX - inicioDeslizar.current;
    inicioDeslizar.current = null;
    if (Math.abs(recorrido) < 55) return; // un toque, no un deslizamiento
    cambiarQuincena(
      recorrido < 0 ? quincenaSiguiente(quincenaIdActual) : quincenaAnterior(quincenaIdActual)
    );
  }
  const hayPendientes = estado.balanceProyectado !== estado.balanceConfirmado;
  // La prima solo llega en junio y diciembre — el resto del año no tiene
  // sentido ofrecerla para confirmar.
  const mesPrimaHabilitado = [6, 12].includes(partesQuincena(quincenaIdActual).mes);

  // Distribucion por categoria real, no por los tres grandes grupos: decir
  // "gastos 100%" no informa nada, lo util es ver en QUE se fue la plata.
  // Se muestran las 6 mas grandes y el resto se agrupa en "Otros".
  const TOPE_SEGMENTOS = 6;
  const porCategoria = [...estado.gastos, ...estado.deudas, ...estado.inversiones]
    .filter((x) => x.confirmado > 0)
    .sort((a, b) => b.confirmado - a.confirmado);

  const segmentosDistribucion = porCategoria.slice(0, TOPE_SEGMENTOS).map((x) => ({
    nombre: ETIQUETAS_CATEGORIA[x.categoria] || x.categoria,
    valor: x.confirmado,
    color: CATEGORIA_COLOR[x.categoria],
  }));

  const resto = porCategoria.slice(TOPE_SEGMENTOS).reduce((a, x) => a + x.confirmado, 0);
  if (resto > 0) {
    segmentosDistribucion.push({ nombre: "Otros", valor: resto, color: "#B8AC98" });
  }

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
        <div className="tile-suave bg-[var(--color-suave-ambar)] mb-4">
          <button
            onClick={() => setAlertaAbierta((v) => !v)}
            className="flex gap-3 items-start w-full text-left"
          >
            <div className="w-[34px] h-[34px] rounded-xl bg-[#e0a93e] text-white font-bold text-[15px] flex items-center justify-center flex-shrink-0">
              !
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold text-[var(--color-suave-ambar-texto)]">
                {alertas.length} {alertas.length === 1 ? "cuota atrasada" : "cuotas atrasadas"}
              </p>
              <p className="text-[11.5px] text-[#9a7434] mt-0.5">
                Faltan {formatoCOP(faltanteTotal)} en total ·{" "}
                <span className="underline">{alertaAbierta ? "ocultar" : "ver cuáles"}</span>
              </p>
            </div>
          </button>

          {alertaAbierta && (
            <div className="mt-3 pt-3 border-t border-[#e7c98f]">
              {alertas.map((a) => (
                <div
                  key={a.categoria}
                  className="flex justify-between items-baseline py-1.5 text-[12.5px]"
                >
                  <span className="text-[var(--color-suave-ambar-texto)] font-semibold">
                    {ETIQUETAS_CATEGORIA[a.categoria] || a.categoria}
                  </span>
                  <span className="font-serif-num font-bold text-[var(--color-suave-ambar-texto)]">
                    {formatoCOP(a.faltante)}
                  </span>
                </div>
              ))}
              <Link
                to="/rafael/deudas"
                className="text-[11.5px] text-[#9a7434] underline block mt-2"
              >
                Ir a deudas para pagarlas →
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link
          to="/rafael/deudas"
          className="tile-suave bg-[var(--color-suave-rojo)] hover:brightness-[0.97] active:scale-[0.98] transition-all"
        >
          <div className="text-[11px] font-semibold text-[var(--color-suave-rojo-texto)] opacity-80">
            Deuda total ›
          </div>
          <div className="font-serif-num text-[19px] font-bold text-[var(--color-suave-rojo-texto)] mt-1">
            {formatoCOP(deudaTotal)}
          </div>
        </Link>
        <Link
          to="/ahorro"
          className="tile-suave bg-[var(--color-suave-verde)] hover:brightness-[0.97] active:scale-[0.98] transition-all"
        >
          <div className="text-[11px] font-semibold text-[var(--color-suave-verde-texto)] opacity-80">
            Ahorro NU ›
          </div>
          <div className="font-serif-num text-[19px] font-bold text-[var(--color-suave-verde-texto)] mt-1">
            {formatoCOP(cuentas.nu)}
          </div>
        </Link>
      </div>

      {/* Tarjeta de quincena / ledger -- es el "titular" de la pagina */}
      <div
        className="ledger-card ledger-card--hero p-6 mb-6"
        onTouchStart={alEmpezarDeslizar}
        onTouchEnd={alSoltarDeslizar}
      >
        <div className="dashed-row pb-3 mb-3">
          <div className="flex justify-between items-center">
            <button
              onClick={() => cambiarQuincena(quincenaAnterior(quincenaIdActual))}
              className="text-white/70 hover:text-white text-2xl leading-none px-3 py-1 -my-1"
              aria-label="Quincena anterior"
            >
              ‹
            </button>
            <button
              onClick={() => setMostrarSelector((v) => !v)}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="text-[15px] font-bold tracking-tight text-center">
                {formatoQuincena(quincenaIdActual)}
              </span>
              <span className="text-[10px] text-white/60 underline">
                ▾ cambiar · desliza ←→
              </span>
            </button>
            <button
              onClick={() => cambiarQuincena(quincenaSiguiente(quincenaIdActual))}
              className="text-white/70 hover:text-white text-2xl leading-none px-3 py-1 -my-1"
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
            Sugerencia con lo confirmado: {formatoCOP(estado.aNU)} al NU ·{" "}
            {formatoCOP(estado.aDeuda)} a abono extra de deuda. Confírmalo abajo en Inversiones
            cuando de verdad muevas la plata.
          </div>
        )}

        <Link
          to="/historial"
          className="text-xs text-white/50 underline hover:text-white mt-3 block text-center"
        >
          ver historial completo desde el inicio →
        </Link>
      </div>

      <Link to="/graficas" className="ledger-card p-6 mb-6 block hover:shadow-md transition-shadow">
        <div className="flex justify-between items-baseline mb-1">
          <h2 className="section-title-editorial">En qué se ha ido</h2>
          <span className="text-xs text-[var(--color-muted)] underline">ver gráficas →</span>
        </div>
        <p className="text-xs text-[var(--color-muted)] mb-3">
          De {formatoCOP(estado.egresoConfirmado)} confirmados esta quincena
        </p>
        <GraficoDona segmentos={segmentosDistribucion} />
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
          className="bg-[var(--color-acento-vivo)] text-white rounded-[18px] py-4 text-center font-semibold text-[15px] mb-6 shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
        >
          + Agregar movimiento
        </button>
      )}

      {/* Lista editable de movimientos: confirmar/editar/borrar item a item */}
      <SeccionPlegable
        titulo={`Movimientos de la quincena (${estado.movimientos.length})`}
        descripcion="Toca el monto o la fecha para editarlo, el círculo para confirmar."
        abiertaPorDefecto={false}
      >
        <ListaMovimientos
          movimientos={estado.movimientos}
          onCambio={() => cargarTodo(quincenaIdActual)}
        />
      </SeccionPlegable>

      <SeccionPlegable
        titulo="Tu plan ideal vs lo real"
        descripcion="Lo que planeaste destinar a cada rubro contra lo que llevas."
        abiertaPorDefecto={false}
      >
        <PlanIdeal estado={estado} />
      </SeccionPlegable>

      {/* Categorias — cada una con confirmacion rapida si aun esta en $0 */}
      <SeccionPlegable
        titulo="Ingresos"
        descripcion="Confirma cada uno apenas te llegue."
        resumen={formatoCOP(estado.ingresosConfirmado)}
      >
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
      </SeccionPlegable>

      <SeccionPlegable
        titulo="Gastos de la quincena"
        descripcion="Confirma cada uno a medida que lo pagas."
        resumen={formatoCOP(estado.gastosConfirmado)}
      >
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
      </SeccionPlegable>

      <SeccionPlegable
        titulo="Estado de las deudas"
        descripcion="Confirma cada cuota cuando la pagues."
        resumen={formatoCOP(estado.deudasConfirmado)}
      >
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
      </SeccionPlegable>

      <SeccionPlegable
        titulo="Inversiones y ahorro"
        descripcion="El saldo de NU sube solo con lo que confirmes aquí."
        resumen={formatoCOP(estado.inversionesConfirmado)}
      >
        {estado.inversiones.map((r) => (
          <FilaCategoria
            key={r.categoria}
            categoria={r.categoria}
            tipo="inversion"
            confirmado={r.confirmado}
            pendiente={r.pendiente}
            presupuesto={r.categoria === "nu" ? estado.aNU : 0}
            quincenaId={quincenaIdActual}
            onCambio={() => cargarTodo(quincenaIdActual)}
          />
        ))}
      </SeccionPlegable>

      <Link
        to="/rafael/deudas"
        className="border border-[var(--color-ledger-border)] rounded-[18px] py-4 text-center font-semibold text-[15px] mb-6 bg-[var(--color-ledger)] hover:bg-white hover:border-[var(--color-muted)] hover:shadow-sm transition-all"
      >
        Ver deudas y plan de pagos
      </Link>

      {resumenJerardith && (
        <div className="ledger-card p-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="section-title-editorial">Resumen de Jerardith (esta quincena)</h2>
            <span
              className={`text-[11px] font-semibold ${
                resumenJerardith.activa ? "text-[var(--color-positivo)]" : "text-[#B0842A]"
              }`}
            >
              {resumenJerardith.activa ? "✓ Activa" : "● Inactiva"}
            </span>
          </div>
          {resumenJerardith.resumen.map((r) => (
            <div key={r.rubro} className="flex justify-between items-baseline dashed-row py-2 text-[13.5px]">
              <span className="capitalize text-[var(--color-texto)]">{r.rubro}</span>
              <span className="font-serif-num font-semibold">
                {formatoCOP(r.gastado)}
                <span className="text-xs text-[var(--color-muted)] font-sans"> / {formatoCOP(r.presupuesto)}</span>
              </span>
            </div>
          ))}
          <p className="text-xs text-[var(--color-muted)] mt-3">
            {resumenJerardith.activa
              ? "Ya puede registrar en los rubros que le entregaste."
              : "Se habilita sola: en cuanto confirmes mercado, cuidado o su bolsillo, ella puede registrar en ese rubro."}
          </p>
        </div>
      )}
    </div>
  );
}
