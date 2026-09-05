import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { quincenaId, calcularEstadoQuincena } from "../calculos.js";

const router = Router();

// rubro de Jerardith -> tipo/categoria en el modelo unificado de movimientos
const MAPA_RUBRO = {
  mercado: { tipo: "gasto", categoria: "mercado" },
  cuidado: { tipo: "gasto", categoria: "cuidado" },
  esposa: { tipo: "gasto", categoria: "jerardith" },
};

function presupuestoRubro(db, rubro, q) {
  const key = q === 1 ? "q1" : "q2";
  return db.gastosFijos[key][rubro] || 0;
}

function estaActiva(db, id) {
  return !!(db.activacionesJerardith || {})[id];
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
  const mapa = MAPA_RUBRO[gasto.rubro];
  if (!mapa) return res.status(400).json({ error: "Rubro inválido" });
  if (!gasto.monto || Number(gasto.monto) <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  const id = gasto.quincena || quincenaId();

  try {
    const nuevo = await withDB(async (db) => {
      if (!estaActiva(db, id)) {
        const e = new Error("Rafael todavía no ha activado esta quincena para ti.");
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

router.post("/activar", async (req, res) => {
  const id = req.body.quincenaId || quincenaId();
  await withDB(async (db) => {
    db.activacionesJerardith = db.activacionesJerardith || {};
    db.activacionesJerardith[id] = true;
  });
  res.json({ ok: true, quincenaId: id, activa: true });
});

router.post("/desactivar", async (req, res) => {
  const id = req.body.quincenaId || quincenaId();
  await withDB(async (db) => {
    db.activacionesJerardith = db.activacionesJerardith || {};
    db.activacionesJerardith[id] = false;
  });
  res.json({ ok: true, quincenaId: id, activa: false });
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

  const rubros = ["mercado", "cuidado", "esposa"];
  const resumen = rubros.map((rubro) => {
    const categoria = MAPA_RUBRO[rubro].categoria;
    const recibido = sumar(categoria, false);
    const gastado = sumar(categoria, true);
    return {
      rubro,
      presupuesto: recibido,
      gastado,
      disponible: recibido - gastado,
      // Referencia de cuanto se suele destinar a ese rubro por quincena.
      planeado: presupuestoRubro(db, rubro, q),
    };
  });

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

  const disponibleTotal = resumen.reduce((a, r) => a + r.disponible, 0);
  const asignadoTotal = resumen.reduce((a, r) => a + r.presupuesto, 0);
  const gastadoTotal = resumen.reduce((a, r) => a + r.gastado, 0);

  res.json({
    quincenaActual: idActual,
    activa: estaActiva(db, idActual),
    balanceGeneral: estado.balanceConfirmado,
    disponibleTotal,
    asignadoTotal,
    gastadoTotal,
    resumen,
    historialMes,
  });
});

export default router;
