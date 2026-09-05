import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { quincenaId, calcularEstadoQuincena } from "../calculos.js";

const router = Router();

// rubro de Jerardith -> tipo/categoria en el modelo unificado de movimientos
const MAPA_RUBRO = {
  mercado: { tipo: "gasto", categoria: "mercado" },
  cuidado: { tipo: "gasto", categoria: "cuidado" },
  esposa: { tipo: "reserva", categoria: "jerardith" },
};

function presupuestoRubro(db, rubro, q) {
  if (rubro === "esposa") return db.config.bolsilloJerardith;
  const key = q === 1 ? "q1" : "q2";
  return db.gastosFijos[key][rubro] || 0;
}

router.get("/gastos", async (req, res) => {
  const db = await readDB();
  const gastos = (db.movimientos || [])
    .filter((m) => m.registradoPor === "jerardith")
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      quincena: m.quincenaId,
      rubro: m.tipo === "reserva" ? "esposa" : m.categoria,
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

  const nuevo = await withDB(async (db) => {
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
});

router.get("/resumen", async (req, res) => {
  const db = await readDB();
  const idActual = quincenaId();
  const estado = calcularEstadoQuincena(db, idActual);
  const q = estado.quincena;

  const rubros = ["mercado", "cuidado", "esposa"];
  const resumen = rubros.map((rubro) => {
    const presupuesto = presupuestoRubro(db, rubro, q);
    let gastado = 0;
    if (rubro === "esposa") {
      gastado = estado.reservas.find((r) => r.categoria === "jerardith")?.confirmado || 0;
    } else {
      gastado = estado.gastos.find((g) => g.categoria === rubro)?.confirmado || 0;
    }
    return { rubro, presupuesto, gastado, disponible: presupuesto - gastado };
  });

  const prefijoMes = idActual.slice(0, 7);
  const historialMes = (db.movimientos || [])
    .filter((m) => m.registradoPor === "jerardith" && m.quincenaId.startsWith(prefijoMes))
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      quincena: m.quincenaId,
      rubro: m.tipo === "reserva" ? "esposa" : m.categoria,
      monto: m.monto,
      descripcion: m.descripcion,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  res.json({
    quincenaActual: idActual,
    balanceGeneral: estado.balanceConfirmado,
    resumen,
    historialMes,
  });
});

export default router;
