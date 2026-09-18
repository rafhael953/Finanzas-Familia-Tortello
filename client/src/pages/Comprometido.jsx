import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navegacion from "../components/Navegacion";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, NOMBRES_MES } from "../api";

// Desglosa "a que se comprometio la plata este mes": por cada rubro, lo
// reservado (presupuesto o lo real, lo mayor), lo ya pagado, y lo que
// falta. Nace de que "balance esperado" (Panel Rafael) por si solo no
// explica POR QUE el margen quedo chico -- Rafael pidio ver este detalle
// en su propia pantalla en vez de que se le arme a mano cada vez que
// pregunta (2026-09-18).
export default function Comprometido() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const actual = await api.getQuincenaActual();
      const d = await api.getComprometidoMensual(actual.id);
      setDatos(d);
      setCargando(false);
    })();
  }, []);

  if (cargando || !datos) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }

  const [, mesNum] = datos.mes.split("-");
  const nombreMes = NOMBRES_MES[Number(mesNum)];

  const filas1a15 = datos.filas.filter((f) => f.etiqueta === "1-15");
  const filas16fin = datos.filas.filter((f) => f.etiqueta === "16-fin");

  function Mitad({ titulo, filas }) {
    if (filas.length === 0) return null;
    return (
      <div className="ledger-card p-6 mb-6">
        <h2 className="section-title-editorial mb-3">{titulo}</h2>
        {filas.map((f) => (
          <div key={f.categoria} className="dashed-row py-2.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[13.5px] font-medium">
                {ETIQUETAS_CATEGORIA[f.categoria] || f.categoria}
              </span>
              <span className="font-serif-num text-[13.5px]">
                <span className="font-bold">{formatoCOP(f.pagado)}</span>
                <span className="text-[var(--color-muted)]"> / {formatoCOP(f.reservado)}</span>
              </span>
            </div>
            {f.falta > 0 ? (
              <span className="text-[11px] text-[#E8C468] mt-0.5 block">
                Falta pagar {formatoCOP(f.falta)}
              </span>
            ) : (
              <span className="text-[11px] text-[var(--color-positivo)] mt-0.5 block">
                ✓ Ya está cubierto
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Comprometido</h1>
        </div>
      </header>
      <div className="flex justify-end">
        <Link to="/" className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-texto)]">
          cambiar perfil
        </Link>
      </div>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />
      <Navegacion />

      <div className="ledger-card ledger-card--hero p-6 mb-6">
        <span className="kicker">{nombreMes} · lo que falta por pagar</span>
        <span className="font-serif-num text-[32px] font-bold block leading-tight mt-1">
          {formatoCOP(datos.totalFalta)}
        </span>
        <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-white/15 text-xs">
          <span className="text-white/55">Reservado: {formatoCOP(datos.totalReservado)}</span>
          <span className="text-white/55">Ya pagado: {formatoCOP(datos.totalPagado)}</span>
        </div>
        <p className="text-xs text-white/50 mt-3">
          Esta es la diferencia entre "Balance al día" y "Balance esperado" del Panel Rafael:
          plata que ya tiene dueño, aunque todavía no salga de la cuenta.
        </p>
      </div>

      <Mitad titulo="Días 1-15" filas={filas1a15} />
      <Mitad titulo="Días 16-fin" filas={filas16fin} />

      {datos.filas.length === 0 && (
        <p className="text-sm text-[var(--color-muted)] py-3 text-center">
          Nada comprometido todavía este mes.
        </p>
      )}
    </div>
  );
}
