import { Router } from "express";
import { readDB } from "../db.js";
import { calcularEvolucionNU } from "../calculos.js";

const router = Router();

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
