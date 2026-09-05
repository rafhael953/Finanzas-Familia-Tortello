import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { calcularEvolucionNU } from "../calculos.js";

const router = Router();

// Cuentas cuyo saldo se actualiza a mano porque viven fuera de esta app
// (el banco, el exchange) -- no se pueden derivar de los movimientos.
const CAMPOS_EDITABLES = ["bancolombia", "binanceUSD"];

router.get("/", async (req, res) => {
  const db = await readDB();
  const evolucion = calcularEvolucionNU(db);
  const totalAlNU = evolucion.reduce((a, e) => a + e.aNU, 0);
  let nu = db.saldosIniciales.nu + totalAlNU;

  let xtbUSD = db.saldosIniciales.xtbUSD;
  for (const m of db.movimientos || []) {
    if (m.tipo === "inversion" && m.categoria === "xtb" && m.confirmado !== false) {
      xtbUSD += Number(m.monto || 0) / (db.config.trm || 1);
    }
  }

  res.json({
    nu: Math.round(nu),
    bancolombia: db.saldosIniciales.bancolombia,
    xtbUSD: Number(xtbUSD.toFixed(2)),
    binanceUSD: db.saldosIniciales.binanceUSD,
    rendNU: db.config.rendNU,
    trm: db.config.trm,
  });
});

// Actualizar el saldo real de una cuenta manual (Bancolombia, Binance) --
// ej. cuando se revisa la app del banco/exchange y el numero cambio.
router.put("/saldo", async (req, res) => {
  const { campo, valor } = req.body;
  if (!CAMPOS_EDITABLES.includes(campo)) {
    return res.status(400).json({ error: "Campo inválido" });
  }
  if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }
  await withDB(async (db) => {
    db.saldosIniciales[campo] = valor;
  });
  res.json({ ok: true, campo, valor });
});

router.get("/evolucion-nu", async (req, res) => {
  const db = await readDB();
  const evolucion = calcularEvolucionNU(db);
  const conBase = evolucion.map((e) => ({
    ...e,
    saldo: db.saldosIniciales.nu + e.acumulado,
  }));
  res.json(conBase);
});

export default router;
