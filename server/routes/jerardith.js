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

  // El bolsillo de Jerardith ("amor") no es un monto fijo por quincena: solo
  // cuenta lo que Rafael realmente le asigno (reserva/jerardith confirmada,
  // registrada por el) como presupuesto, y lo que ella misma registro haber
  // gastado de eso como "gastado". Si el aun no se lo ha entregado, es 0.
  const movsJerardith = (db.movimientos || []).filter(
    (m) => m.quincenaId === idActual && m.tipo === "gasto" && m.categoria === "jerardith" && m.confirmado !== false
  );
  const asignadoPorRafael = movsJerardith
    .filter((m) => m.registradoPor !== "jerardith")
    .reduce((a, m) => a + m.monto, 0);
  const gastadoPorJerardith = movsJerardith
    .filter((m) => m.registradoPor === "jerardith")
    .reduce((a, m) => a + m.monto, 0);

  const rubros = ["mercado", "cuidado", "esposa"];
  const resumen = rubros.map((rubro) => {
    if (rubro === "esposa") {
      return {
        rubro,
        presupuesto: asignadoPorRafael,
        gastado: gastadoPorJerardith,
        disponible: asignadoPorRafael - gastadoPorJerardith,
      };
    }
    const presupuesto = presupuestoRubro(db, rubro, q);
    const gastado = estado.gastos.find((g) => g.categoria === rubro)?.confirmado || 0;
    return { rubro, presupuesto, gastado, disponible: presupuesto - gastado };
  });

  const prefijoMes = idActual.slice(0, 7);
  const historialMes = (db.movimientos || [])
    .filter((m) => m.registradoPor === "jerardith" && m.quincenaId.startsWith(prefijoMes))
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      quincena: m.quincenaId,
      rubro: m.categoria === "jerardith" ? "esposa" : m.categoria,
      monto: m.monto,
      descripcion: m.descripcion,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  res.json({
    quincenaActual: idActual,
    activa: estaActiva(db, idActual),
    balanceGeneral: estado.balanceConfirmado,
    resumen,
    historialMes,
  });
});

export default router;
