import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { calcularAsesor } from "../asesor.js";

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

// Todo lo que responde "me alcanza o no": meta realista, cupo de tarjetas,
// reparto de cuotas por quincena y semaforo mes a mes.
router.get("/asesor", async (req, res) => {
  res.json(calcularAsesor(await readDB()));
});


// Mover una cuota a la otra quincena. Queda fijada a mano: el reparto
// automatico ya no la toca, pero sigue acomodando las demas alrededor.
router.put("/reparto", async (req, res) => {
  const { categoria, quincena } = req.body || {};
  const q = Number(quincena);
  if (q !== 1 && q !== 2) {
    return res.status(400).json({ error: "La quincena tiene que ser 1 o 2" });
  }
  try {
    await withDB(async (db) => {
      if (!(categoria in (db.cuotasRecomendadas || {}))) {
        const e = new Error("Esa deuda no existe");
        e.status = 400;
        throw e;
      }
      db.repartoCuotas = db.repartoCuotas || {};
      db.repartoCuotas[categoria] = q;
    });
    res.json(calcularAsesor(await readDB()));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Soltar una cuota que estaba fijada, para que vuelva al reparto automatico.
router.delete("/reparto/:categoria", async (req, res) => {
  await withDB(async (db) => {
    if (db.repartoCuotas) delete db.repartoCuotas[req.params.categoria];
  });
  res.json(calcularAsesor(await readDB()));
});

// Editar un gasto fijo puntual (arriendo, servicios, etc) en una quincena.
// Esto es lo que de verdad usa calcularEstadoQuincena/asesor para decidir
// si alcanza o no -- distinto del presupuestoIdeal de abajo, que es solo
// comparativo. No habia forma de tocar esto desde el celular: quedaba fijo
// en lo que trajo la importacion original del Excel, y ahi quedaban cosas
// mal ubicadas (ej. arriendo en la quincena que no es).
router.put("/gasto-fijo", async (req, res) => {
  const { quincena, categoria, valor } = req.body || {};
  if (quincena !== "q1" && quincena !== "q2") {
    return res.status(400).json({ error: "Quincena inválida" });
  }
  if (!categoria) {
    return res.status(400).json({ error: "Falta la categoría" });
  }
  const num = Number(valor);
  if (!Number.isFinite(num) || num < 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }
  await withDB(async (db) => {
    db.gastosFijos = db.gastosFijos || { q1: {}, q2: {} };
    db.gastosFijos[quincena] = db.gastosFijos[quincena] || {};
    db.gastosFijos[quincena][categoria] = num;
  });
  res.json(calcularAsesor(await readDB()));
});

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
