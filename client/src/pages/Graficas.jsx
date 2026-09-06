import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navegacion from "../components/Navegacion";
import { api, formatoCOP, ETIQUETAS_CATEGORIA, CATEGORIA_COLOR } from "../api";
import GraficoDona from "../components/GraficoDona";
import GraficoLinea from "../components/GraficoLinea";
import GraficoEntradaSalida from "../components/GraficoEntradaSalida";

const MESES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function etiquetaMes(prefijo) {
  const [anio, mes] = prefijo.split("-");
  return `${MESES[Number(mes)]} ${anio.slice(2)}`;
}

const RANGOS = [
  { id: 1, etiqueta: "1 mes" },
  { id: 3, etiqueta: "3 meses" },
  { id: 12, etiqueta: "1 año" },
  { id: 0, etiqueta: "Todo" },
];

const TIPOS = [
  { id: "todo", etiqueta: "Todo" },
  { id: "gasto", etiqueta: "Gastos" },
  { id: "deuda", etiqueta: "Deudas" },
  { id: "inversion", etiqueta: "Inversión" },
];

// Barras horizontales de meses: en el celular se leen mejor que un eje X
// apretado, y permiten comparar de un vistazo.
function BarrasMes({ meses, valorDe, color }) {
  const max = Math.max(...meses.map(valorDe), 1);
  return (
    <div>
      {meses.map((m) => {
        const v = valorDe(m);
        return (
          <div key={m.mes} className="py-1.5">
            <div className="flex justify-between items-baseline text-[12.5px] mb-1">
              <span className="text-[var(--color-muted)]">{etiquetaMes(m.mes)}</span>
              <span className="font-serif-num font-semibold">{formatoCOP(v)}</span>
            </div>
            <div className="h-[7px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(v / max) * 100}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Graficas() {
  const [datos, setDatos] = useState(null);
  const [rango, setRango] = useState(3);
  const [tipo, setTipo] = useState("todo");

  useEffect(() => {
    api.getAnalisis().then(setDatos);
  }, []);

  const meses = useMemo(() => {
    if (!datos) return [];
    return rango === 0 ? datos : datos.slice(-rango);
  }, [datos, rango]);

  if (!datos) {
    return <div className="p-6 text-center font-serif-num text-lg">Cargando...</div>;
  }

  const salidaDe = (m) =>
    tipo === "todo" ? m.gasto + m.deuda + m.inversion : m[tipo] || 0;

  const totalSalida = meses.reduce((a, m) => a + salidaDe(m), 0);
  const totalIngreso = meses.reduce((a, m) => a + m.ingreso, 0);
  const balance = totalIngreso - meses.reduce((a, m) => a + m.gasto + m.deuda + m.inversion, 0);
  const promedio = meses.length ? Math.round(totalSalida / meses.length) : 0;

  // Categorias sumadas en el rango elegido, de mayor a menor.
  const porCategoria = {};
  for (const m of meses) {
    for (const [cat, valor] of Object.entries(m.categorias)) {
      if (tipo !== "todo") {
        // Se filtra por tipo comparando contra el total del tipo del mes:
        // no se guarda el tipo por categoria, pero las categorias no se
        // repiten entre tipos, asi que basta con excluir las que no suman.
        const perteneceAlTipo = m[tipo] > 0;
        if (!perteneceAlTipo) continue;
      }
      porCategoria[cat] = (porCategoria[cat] || 0) + valor;
    }
  }

  const segmentos = Object.entries(porCategoria)
    .map(([cat, valor]) => ({
      nombre: ETIQUETAS_CATEGORIA[cat] || cat,
      valor,
      color: CATEGORIA_COLOR[cat],
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  const mesesEnRojo = meses.filter((m) => m.gasto + m.deuda + m.inversion > m.ingreso);

  // La deuda al cerrar cada mes. Solo se dibuja si el servidor la trae y hay
  // mas de un punto: una linea de un solo punto no dice nada.
  const serieDeuda = meses
    .filter((m) => m.deudaTotal !== undefined)
    .map((m) => ({ label: etiquetaMes(m.mes), valor: m.deudaTotal }));
  const bajoLaDeuda =
    serieDeuda.length > 1 && serieDeuda[serieDeuda.length - 1].valor <= serieDeuda[0].valor;

  const mesMasCaro = meses.reduce(
    (peor, m) => (salidaDe(m) > salidaDe(peor) ? m : peor),
    meses[0] || { mes: "", gasto: 0, deuda: 0, inversion: 0, ingreso: 0, categorias: {} }
  );

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col max-w-lg mx-auto">
      <header className="flex justify-between items-baseline mb-1">
        <div>
          <div className="kicker">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[30px] font-semibold tracking-tight">Gráficas</h1>
        </div>
      </header>
      <div className="h-px bg-[var(--color-ledger-rule)] my-5" />
      <Navegacion />

      {/* Filtros */}
      <div className="ledger-card p-5 mb-6">
        <p className="kicker mb-2">Periodo</p>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRango(r.id)}
              className={`rounded-xl py-2 text-xs font-semibold transition-all ${
                rango === r.id
                  ? "bg-[var(--color-acento)] text-white"
                  : "bg-[var(--color-fondo)] text-[var(--color-muted)]"
              }`}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
        <p className="kicker mb-2">Qué mirar</p>
        <div className="grid grid-cols-4 gap-1.5">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTipo(t.id)}
              className={`rounded-xl py-2 text-xs font-semibold transition-all ${
                tipo === t.id
                  ? "bg-[var(--color-acento-vivo)] text-white"
                  : "bg-[var(--color-fondo)] text-[var(--color-muted)]"
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {meses.length === 0 ? (
        <div className="ledger-card p-6 text-center text-sm text-[var(--color-muted)]">
          Todavía no hay movimientos confirmados para analizar.
        </div>
      ) : (
        <>
          {/* Resumen del periodo */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="tile-suave bg-[var(--color-suave-verde)]">
              <div className="text-[11px] font-semibold text-[var(--color-suave-verde-texto)] opacity-80">
                Entró
              </div>
              <div className="font-serif-num text-[17px] font-bold text-[var(--color-suave-verde-texto)] mt-1">
                {formatoCOP(totalIngreso)}
              </div>
            </div>
            <div className="tile-suave bg-[var(--color-suave-rojo)]">
              <div className="text-[11px] font-semibold text-[var(--color-suave-rojo-texto)] opacity-80">
                Salió
              </div>
              <div className="font-serif-num text-[17px] font-bold text-[var(--color-suave-rojo-texto)] mt-1">
                {formatoCOP(totalSalida)}
              </div>
            </div>
          </div>

          <div className="ledger-card ledger-card--hero p-6 mb-6">
            <span className="kicker">Balance del periodo</span>
            <span
              className={`font-serif-num text-[32px] font-bold block leading-tight ${
                balance >= 0 ? "text-[var(--color-positivo-alto)]" : "text-[var(--color-negativo-alto)]"
              }`}
            >
              {formatoCOP(balance)}
            </span>
            <p className="text-xs text-white/50 mt-3">
              {meses.length} {meses.length === 1 ? "mes" : "meses"} · promedio de{" "}
              {formatoCOP(promedio)} de salida al mes
              {mesMasCaro.mes && ` · el más alto fue ${etiquetaMes(mesMasCaro.mes)}`}
            </p>
          </div>

          {/* Lo primero: entrada contra salida. Es la comparación que
              importa, y antes había que hacerla a ojo entre dos gráficas
              separadas. */}
          <div className="ledger-card p-6 mb-6">
            <h2 className="section-title-editorial mb-1">Entró contra salió</h2>
            <p className="text-xs text-[var(--color-muted)] mb-3">
              {mesesEnRojo.length > 0
                ? `${mesesEnRojo.length} de ${meses.length} meses cerraron gastando más de lo que entró`
                : "Todos los meses del periodo cerraron en positivo"}
            </p>
            <GraficoEntradaSalida
              meses={meses.map((m) => ({
                mes: m.mes,
                ingreso: m.ingreso,
                salida: m.gasto + m.deuda + m.inversion,
              }))}
              etiquetaMes={etiquetaMes}
            />
          </div>

          {/* Si la deuda no baja, nada de lo demás sirvió. */}
          {serieDeuda.length > 1 && (
            <div className="ledger-card p-6 mb-6">
              <h2 className="section-title-editorial mb-1">La deuda, mes a mes</h2>
              <p className="text-xs text-[var(--color-muted)] mb-3">
                {bajoLaDeuda
                  ? `Bajó ${formatoCOP(serieDeuda[0].valor - serieDeuda[serieDeuda.length - 1].valor)} en el periodo`
                  : `Subió ${formatoCOP(serieDeuda[serieDeuda.length - 1].valor - serieDeuda[0].valor)} en el periodo`}
              </p>
              <GraficoLinea
                puntos={serieDeuda}
                color={bajoLaDeuda ? "var(--color-positivo)" : "var(--color-negativo)"}
              />
            </div>
          )}

          <div className="ledger-card p-6 mb-6">
            <h2 className="section-title-editorial mb-1">Mes a mes</h2>
            <p className="text-xs text-[var(--color-muted)] mb-3">
              {tipo === "todo" ? "Todo lo que salió" : TIPOS.find((t) => t.id === tipo).etiqueta} por mes
            </p>
            <BarrasMes meses={meses} valorDe={salidaDe} color="var(--color-acento-vivo)" />
          </div>

          <div className="ledger-card p-6 mb-6">
            <h2 className="section-title-editorial mb-1">Por categoría</h2>
            <p className="text-xs text-[var(--color-muted)] mb-3">
              Dónde se fue la plata en todo el periodo
            </p>
            <GraficoDona segmentos={segmentos} />
          </div>

          <Link
            to="/historial"
            className="border border-[var(--color-ledger-border)] rounded-[18px] py-4 text-center font-semibold text-[15px] bg-[var(--color-ledger)] hover:bg-white hover:shadow-sm transition-all"
          >
            Ver el detalle movimiento por movimiento
          </Link>
        </>
      )}
    </div>
  );
}
