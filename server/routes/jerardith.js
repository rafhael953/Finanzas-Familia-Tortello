import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { quincenaId, calcularEstadoQuincena } from "../calculos.js";

const router = Router();

// rubro de Jerardith -> tipo/categoria en el modelo unificado de movimientos
const MAPA_RUBRO = {
  mercado: { tipo: "gasto", categoria: "mercado" },
  cuidado: { tipo: "gasto", categoria: "cuidado" },
  aseo: { tipo: "gasto", categoria: "aseo" },
  ocio: { tipo: "gasto", categoria: "ocio" },
  esposa: { tipo: "gasto", categoria: "jerardith" },
};

// A los rubros fijos se suman las categorias que ella misma haya creado
// (las marcadas como deJerardith). Asi puede organizar sus gastos a su
// manera sin que se le mezclen categorias de la casa.
function mapaDe(db) {
  const mapa = { ...MAPA_RUBRO };
  const propias = (db.categoriasPersonalizadas || {}).gasto || {};
  for (const [cat, info] of Object.entries(propias)) {
    if (info?.deJerardith) mapa[cat] = { tipo: "gasto", categoria: cat };
  }
  return mapa;
}

// Rubros que por naturaleza son una entrega: confirmar el mercado ES
// pasarle la plata del mercado. Los demas (ocio, aseo, los que ella cree)
// son rubros donde ella puede gastar, pero donde Rafael tambien gasta por su
// cuenta, asi que un gasto suyo ahi no significa que se lo haya entregado.
const RUBROS_DE_ENTREGA = ["mercado", "cuidado", "esposa"];

function esEntrega(rubro) {
  return RUBROS_DE_ENTREGA.includes(rubro);
}

// Solo de referencia: cuanto se suele destinar a ese rubro por quincena,
// segun el plan. No todos los rubros tienen un valor planeado.
function presupuestoRubro(db, rubro, q) {
  const key = q === 1 ? "q1" : "q2";
  const categoria = mapaDe(db)[rubro]?.categoria || rubro;
  const ideal = (db.presupuestoIdeal || {})[key]?.categorias || {};
  return ideal[categoria] ?? db.gastosFijos[key][categoria] ?? 0;
}

// Un rubro queda habilitado para ella en el momento en que Rafael le
// entrega plata para ese rubro. No hace falta un boton aparte de
// "activar": confirmar el mercado ES entregarselo.
function rubroActivo(db, id, categoria) {
  return (db.movimientos || []).some(
    (m) =>
      m.quincenaId === id &&
      m.tipo === "gasto" &&
      m.categoria === categoria &&
      m.confirmado !== false &&
      m.registradoPor !== "jerardith"
  );
}

// La quincena esta "activa" para ella si ya recibio algo en cualquiera de
// sus rubros.
function estaActiva(db, id) {
  const mapa = mapaDe(db);
  return RUBROS_DE_ENTREGA.some((r) => mapa[r] && rubroActivo(db, id, mapa[r].categoria));
}

router.get("/gastos", async (req, res) => {
  const db = await readDB();
  const gastos = (db.movimientos || [])
    .filter((m) => m.registradoPor === "jerardith")
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      quincena: m.quincenaId,
      rubro: m.categoria === "jerardith" ? "esposa" : m.categoria,
      monto: m.monto,
      descripcion: m.descripcion,
      registradoPor: "jerardith",
    }));
  res.json(gastos);
});

router.post("/gastos", async (req, res) => {
  const gasto = req.body;
  const mapa = mapaDe(await readDB())[gasto.rubro];
  if (!mapa) return res.status(400).json({ error: "Rubro inválido" });
  if (!gasto.monto || Number(gasto.monto) <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  const id = gasto.quincena || quincenaId();

  try {
    const nuevo = await withDB(async (db) => {
      // Lo que recibe es una bolsa, no sobres cerrados: puede gastar en
      // cualquier rubro mientras haya recibido algo en la quincena. El
      // rubro sirve para saber en que se fue, no para bloquear.
      if (!estaActiva(db, id)) {
        const e = new Error("Todavía no has recibido nada en esta quincena.");
        e.status = 409;
        throw e;
      }
      const item = {
        id: `mov-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        quincenaId: id,
        tipo: mapa.tipo,
        categoria: mapa.categoria,
        monto: Number(gasto.monto),
        descripcion: gasto.descripcion || "",
        fecha: gasto.fecha || new Date().toISOString().slice(0, 10),
        registradoPor: "jerardith",
        confirmado: true,
      };
      db.movimientos = db.movimientos || [];
      db.movimientos.push(item);
      return item;
    });
    res.json({ ...nuevo, rubro: gasto.rubro, quincena: id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get("/resumen", async (req, res) => {
  const db = await readDB();
  const idActual = quincenaId();
  const estado = calcularEstadoQuincena(db, idActual);
  const q = estado.quincena;

  // Los tres rubros funcionan igual: lo que Rafael registra es la plata que
  // le ENTREGA para ese rubro, y lo que ella registra es en que la fue
  // gastando. Lo disponible es la resta. Antes el mercado y el cuidado
  // mezclaban las dos cosas y sumaban ambas como gasto, asi que apenas el
  // le entregaba los 500.000 ella ya veia el rubro agotado, y cada compra
  // suya lo dejaba en negativo.
  const movsDeLaQuincena = (db.movimientos || []).filter(
    (m) => m.quincenaId === idActual && m.tipo === "gasto" && m.confirmado !== false
  );
  const sumar = (categoria, esDeElla) =>
    movsDeLaQuincena
      .filter(
        (m) => m.categoria === categoria && (m.registradoPor === "jerardith") === esDeElla
      )
      .reduce((a, m) => a + Number(m.monto || 0), 0);

  const rubrosActuales = mapaDe(db);

  // Todo lo que recibe va a una sola bolsa. Se separa por rubro solo para
  // saber para que se lo dieron y en que lo fue gastando, pero lo
  // disponible es uno solo: la resta de los dos totales.
  // OJO: no todo gasto de la casa en un rubro suyo es plata que se le
  // entrego. El mercado y el cuidado si: cuando Rafael los confirma, se los
  // esta pasando a ella. Pero el ocio o el aseo tambien los gasta el
  // directamente, y contarlos como entrega inflaba lo que ella supuestamente
  // recibio (una salida a comer de Rafael aparecia como plata en manos de
  // ella). Solo cuentan como entrega los rubros que por naturaleza lo son,
  // mas lo que se marque a proposito.
  const recibido = Object.keys(rubrosActuales)
    .map((rubro) => ({
      rubro,
      categoria: rubrosActuales[rubro].categoria,
      monto: esEntrega(rubro) ? sumar(rubrosActuales[rubro].categoria, false) : 0,
      planeado: esEntrega(rubro) ? presupuestoRubro(db, rubro, q) : 0,
    }))
    .filter((x) => x.monto > 0 || x.planeado > 0);

  const gastos = Object.keys(rubrosActuales)
    .map((rubro) => ({
      rubro,
      categoria: rubrosActuales[rubro].categoria,
      monto: sumar(rubrosActuales[rubro].categoria, true),
    }))
    .filter((x) => x.monto > 0);

  // Las opciones del formulario: puede registrar en cualquiera.
  const rubros = Object.keys(rubrosActuales);

  // Se devuelven tipo/categoria ademas del rubro para que el cliente pueda
  // reusar la misma lista editable que usa Rafael (editar monto y fecha,
  // o borrar) sin tener que traducir de vuelta.
  const prefijoMes = idActual.slice(0, 7);
  const historialMes = (db.movimientos || [])
    .filter((m) => m.registradoPor === "jerardith" && m.quincenaId.startsWith(prefijoMes))
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      quincena: m.quincenaId,
      quincenaId: m.quincenaId,
      tipo: m.tipo,
      categoria: m.categoria,
      confirmado: m.confirmado,
      registradoPor: m.registradoPor,
      rubro: m.categoria === "jerardith" ? "esposa" : m.categoria,
      monto: m.monto,
      descripcion: m.descripcion,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const asignadoTotal = recibido.reduce((a, r) => a + r.monto, 0);
  const gastadoTotal = gastos.reduce((a, r) => a + r.monto, 0);

  res.json({
    quincenaActual: idActual,
    activa: estaActiva(db, idActual),
    balanceGeneral: estado.balanceConfirmado,
    disponibleTotal: asignadoTotal - gastadoTotal,
    asignadoTotal,
    gastadoTotal,
    recibido,
    gastos,
    rubros,
    historialMes,
  });
});

export default router;
