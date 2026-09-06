import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";

// Un monto del plan que se puede tocar para cambiarlo. Es la pieza con la
// que se mueve carga de una quincena a la otra.
function Monto({ valor, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(String(valor));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (texto === "" || Number(texto) < 0) return;
    setGuardando(true);
    try {
      await onGuardar(Number(texto));
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          className="font-serif-num w-[86px] text-right border border-[var(--color-ledger-border)] rounded-lg px-1.5 py-1 text-[12px] bg-[var(--color-fondo)]"
          autoFocus
        />
        <button
          onClick={guardar}
          disabled={guardando}
          className="text-[10px] font-bold text-[var(--color-positivo)]"
        >
          ✓
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        setTexto(String(valor));
        setEditando(true);
      }}
      className={`font-serif-num text-[12.5px] ${
        valor > 0 ? "font-semibold underline decoration-dotted" : "text-[var(--color-muted)]"
      }`}
    >
      {valor > 0 ? formatoCOP(valor) : "—"}
    </button>
  );
}

function ResumenQuincena({ titulo, datos }) {
  const alcanza = datos.libre >= 0;
  return (
    <div
      className={`tile-suave ${
        alcanza ? "bg-[var(--color-suave-verde)]" : "bg-[var(--color-suave-rojo)]"
      }`}
    >
      <div
        className={`text-[11px] font-semibold opacity-80 ${
          alcanza ? "text-[var(--color-suave-verde-texto)]" : "text-[var(--color-suave-rojo-texto)]"
        }`}
      >
        {titulo}
      </div>
      <div
        className={`font-serif-num text-[17px] font-bold mt-1 ${
          alcanza ? "text-[var(--color-suave-verde-texto)]" : "text-[var(--color-suave-rojo-texto)]"
        }`}
      >
        {alcanza ? `Libre ${formatoCOP(datos.libre)}` : `Faltan ${formatoCOP(-datos.libre)}`}
      </div>
      <div
        className={`text-[10.5px] mt-1 ${
          alcanza ? "text-[var(--color-suave-verde-texto)]" : "text-[var(--color-suave-rojo-texto)]"
        }`}
      >
        Entra {formatoCOP(datos.ingreso)} · sale {formatoCOP(datos.comprometido)}
      </div>
    </div>
  );
}

export default function Reparto() {
  const [plan, setPlan] = useState(undefined);

  useEffect(() => {
    api.getPlan().then(setPlan);
  }, []);

  if (plan === undefined) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }
  if (plan === null) {
    return (
      <div className="min-h-screen px-5 py-6 max-w-lg mx-auto">
        <p className="ledger-card p-6 text-sm text-[var(--color-muted)]">
          Todavía no hay un plan cargado.
        </p>
      </div>
    );
  }

  async function cambiar(quincena, categoria, valor) {
    setPlan(await api.editarPlan(quincena, categoria, valor));
  }

  // Todos los rubros que aparecen en cualquiera de las dos quincenas.
  const rubros = [...new Set([
    ...Object.keys(plan.q1.categorias || {}),
    ...Object.keys(plan.q2.categorias || {}),
  ])].sort((a, b) => {
    const t = (k) => (plan.q1.categorias[k] || 0) + (plan.q2.categorias[k] || 0);
    return t(b) - t(a);
  });

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Reparto</h1>
        </div>
      </header>
      <div className="flex justify-end">
        <Link to="/rafael" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          volver
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-6" />

      <p className="text-[13px] text-[var(--color-muted)] mb-4 leading-relaxed">
        Con qué sueldo se paga cada cosa. Toca un monto para moverlo de una
        quincena a la otra y equilibrar la carga.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <ResumenQuincena titulo="Q1 · del 16 al 30" datos={plan.q1} />
        <ResumenQuincena titulo="Q2 · del 1 al 15" datos={plan.q2} />
      </div>

      <div className="ledger-card p-6 mb-6">
        <div className="flex justify-between items-baseline dashed-row pb-2 mb-1">
          <h2 className="section-title-editorial">Qué se paga con cada una</h2>
          <span className="text-[10px] text-[var(--color-muted)] flex gap-4">
            <span className="w-[86px] text-right">Q1</span>
            <span className="w-[86px] text-right">Q2</span>
          </span>
        </div>

        <div className="flex justify-between items-center py-2.5 dashed-row">
          <span className="text-[13px] font-bold">Entra (sueldo)</span>
          <span className="flex gap-4">
            <span className="w-[86px] text-right">
              <Monto valor={plan.q1.ingreso} onGuardar={(v) => cambiar("q1", "_ingreso", v)} />
            </span>
            <span className="w-[86px] text-right">
              <Monto valor={plan.q2.ingreso} onGuardar={(v) => cambiar("q2", "_ingreso", v)} />
            </span>
          </span>
        </div>

        {rubros.map((cat) => (
          <div key={cat} className="flex justify-between items-center py-2.5 dashed-row">
            <span className="text-[13px] flex items-center gap-2 min-w-0">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: CATEGORIA_COLOR[cat] || "#8A7F6E" }}
              />
              <span className="truncate">{ETIQUETAS_CATEGORIA[cat] || cat}</span>
            </span>
            <span className="flex gap-4 flex-shrink-0">
              <span className="w-[86px] text-right">
                <Monto
                  valor={plan.q1.categorias[cat] || 0}
                  onGuardar={(v) => cambiar("q1", cat, v)}
                />
              </span>
              <span className="w-[86px] text-right">
                <Monto
                  valor={plan.q2.categorias[cat] || 0}
                  onGuardar={(v) => cambiar("q2", cat, v)}
                />
              </span>
            </span>
          </div>
        ))}

        <div className="flex justify-between items-center py-2.5 dashed-row">
          <span className="text-[13px] flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: "#A8453C" }}
            />
            Deudas y tarjetas
          </span>
          <span className="flex gap-4">
            <span className="w-[86px] text-right">
              <Monto valor={plan.q1.deudas} onGuardar={(v) => cambiar("q1", "_deudas", v)} />
            </span>
            <span className="w-[86px] text-right">
              <Monto valor={plan.q2.deudas} onGuardar={(v) => cambiar("q2", "_deudas", v)} />
            </span>
          </span>
        </div>

        <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-[var(--color-texto)]">
          <span className="text-[11px] uppercase tracking-wide font-bold">Sale</span>
          <span className="flex gap-4">
            <span className="w-[86px] text-right font-serif-num text-[13px] font-bold">
              {formatoCOP(plan.q1.comprometido)}
            </span>
            <span className="w-[86px] text-right font-serif-num text-[13px] font-bold">
              {formatoCOP(plan.q2.comprometido)}
            </span>
          </span>
        </div>
      </div>

      <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
        Si una quincena queda en rojo es que le pusiste más de lo que entra:
        mueve algo a la otra. Recuerda que la Q2 de un mes es la que financia
        del 1 al 15 del mes siguiente.
      </p>
    </div>
  );
}
