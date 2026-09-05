import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { calcularEvolucionNU, calcularEvolucionNUMensual } from "../calculos.js";

const router = Router();

// Cuentas cuyo saldo se actualiza a mano porque viven fuera de esta app
// (el exchange) -- no se pueden derivar de los movimientos.
const CAMPOS_EDITABLES = ["binanceUSD", "xtbUSD", "nu"];

// Cuanto se aporto (confirmado) a una categoria de inversion.
function aportesA(db, categoria) {
  return (db.movimientos || [])
    .filter(
      (m) => m.tipo === "inversion" && m.categoria === categoria && m.confirmado !== false
    )
    .reduce((a, m) => a + Number(m.monto || 0), 0);
}

router.get("/", async (req, res) => {
  const db = await readDB();
  const trm = db.config.trm || 1;

  // Cada saldo = punto de partida + lo que se ha aportado de verdad.
  const nu = db.saldosIniciales.nu + aportesA(db, "nu");
  const xtbUSD = db.saldosIniciales.xtbUSD + aportesA(db, "xtb") / trm;
  const binanceUSD = db.saldosIniciales.binanceUSD + aportesA(db, "binance") / trm;

  res.json({
    nu: Math.round(nu),
    xtbUSD: Number(xtbUSD.toFixed(2)),
    binanceUSD: Number(binanceUSD.toFixed(2)),
    rendNU: db.config.rendNU,
    trm: db.config.trm,
  });
});

// Corregir a mano el punto de partida de una cuenta (ej. cuando se revisa
// la app del exchange y el numero real no coincide con lo calculado).
router.put("/saldo", async (req, res) => {
  const { campo, valor } = req.body || {};
  if (!CAMPOS_EDITABLES.includes(campo)) {
    return res.status(400).json({ error: "Campo inválido" });
  }
  const num = Number(valor);
  if (!Number.isFinite(num) || num < 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  // El usuario escribe el saldo que ve hoy; aqui se guarda como punto de
  // partida descontando lo ya aportado, para que el total vuelva a cuadrar.
  await withDB(async (db) => {
    const trm = db.config.trm || 1;
    if (campo === "nu") {
      db.saldosIniciales.nu = num - aportesA(db, "nu");
    } else if (campo === "xtbUSD") {
      db.saldosIniciales.xtbUSD = num - aportesA(db, "xtb") / trm;
    } else {
      db.saldosIniciales.binanceUSD = num - aportesA(db, "binance") / trm;
    }
  });
  res.json({ ok: true, campo, valor: num });
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

router.get("/evolucion-nu-mensual", async (req, res) => {
  const db = await readDB();
  const meses = calcularEvolucionNUMensual(db).map((m) => ({
    ...m,
    saldo: db.saldosIniciales.nu + m.acumulado,
  }));
  res.json(meses);
});

export default router;
