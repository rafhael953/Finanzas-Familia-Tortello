import { Router } from "express";
import { readDB, withDB } from "../db.js";

const router = Router();

// El reparto: que se paga con el sueldo de cada quincena. Sirve para que
// la carga quede equilibrada y no llegue una quincena en la que no
// alcance. Devuelve tambien cuanto queda libre en cada una.
function conTotales(plan) {
  const salidaDe = (q) =>
    Object.values(q?.categorias || {}).reduce((a, b) => a + b, 0) + (q?.deudas || 0);

  return {
    q1: {
      ...plan.q1,
      comprometido: salidaDe(plan.q1),
      libre: (plan.q1?.ingreso || 0) - salidaDe(plan.q1),
    },
    q2: {
      ...plan.q2,
      comprometido: salidaDe(plan.q2),
      libre: (plan.q2?.ingreso || 0) - salidaDe(plan.q2),
    },
  };
}

router.get("/", async (req, res) => {
  const db = await readDB();
  if (!db.presupuestoIdeal) return res.json(null);
  res.json(conTotales(db.presupuestoIdeal));
});

// Mover un monto de un rubro entre quincenas, o cambiarlo. Se guarda solo
// el valor puntual que se toco para no pisar el resto del plan.
router.put("/", async (req, res) => {
  const { quincena, categoria, valor } = req.body || {};
  if (quincena !== "q1" && quincena !== "q2") {
    return res.status(400).json({ error: "Quincena inválida" });
  }
  const num = Number(valor);
  if (!Number.isFinite(num) || num < 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  try {
    const plan = await withDB(async (db) => {
      if (!db.presupuestoIdeal) {
        const e = new Error("Todavía no hay un plan cargado");
        e.status = 400;
        throw e;
      }
      const q = db.presupuestoIdeal[quincena];
      if (categoria === "_ingreso") q.ingreso = num;
      else if (categoria === "_deudas") q.deudas = num;
      else q.categorias[categoria] = num;
      return db.presupuestoIdeal;
    });
    res.json(conTotales(plan));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
