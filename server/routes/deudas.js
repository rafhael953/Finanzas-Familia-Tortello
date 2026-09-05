import { Router } from "express";
import { readDB } from "../db.js";
import { calcularAlertasDeudas } from "../calculos.js";

const router = Router();

router.get("/alertas", async (req, res) => {
  const db = await readDB();
  res.json(calcularAlertasDeudas(db));
});

const ORDEN_ABONO_EXTRA = ["rappi", "falabella", "auteco"];

function tasaMensual(tasaEA) {
  return Math.pow(1 + tasaEA, 1 / 12) - 1;
}

function tasasPorDeuda(config) {
  return {
    falabella: tasaMensual(config.tasaTC),
    rappi: tasaMensual(config.tasaTC),
    auteco: tasaMensual(config.tasaAuteco),
    numama: 0,
  };
}

// Saldo actual = saldo inicial - suma de TODOS los abonos ya registrados
// (movimientos en vivo, sin esperar a que se confirme la quincena)
router.get("/", async (req, res) => {
  const db = await readDB();
  const saldos = { ...db.deudasIniciales };
  for (const m of db.movimientos || []) {
    if (m.tipo === "deuda" && m.confirmado !== false && saldos[m.categoria] !== undefined) {
      saldos[m.categoria] -= Number(m.monto || 0);
    }
  }
  const detalle = Object.keys(saldos).map((nombre) => ({
    nombre,
    saldo: Math.max(0, Math.round(saldos[nombre])),
    saldoInicial: db.deudasIniciales[nombre],
    cuotaRecomendada: db.cuotasRecomendadas[nombre],
  }));
  res.json(detalle);
});

// Proyeccion mensual sep-2026 a dic-2028
router.get("/proyeccion", async (req, res) => {
  const db = await readDB();
  const tasas = tasasPorDeuda(db.config);

  // saldos actuales reales (con abonos ya hechos) como punto de partida
  const saldosActuales = { ...db.deudasIniciales };
  for (const m of db.movimientos || []) {
    if (m.tipo === "deuda" && m.confirmado !== false && saldosActuales[m.categoria] !== undefined) {
      saldosActuales[m.categoria] -= Number(m.monto || 0);
    }
  }
  let saldos = {};
  for (const k of Object.keys(saldosActuales)) saldos[k] = Math.max(0, saldosActuales[k]);

  const gastosQ1 = Object.values(db.gastosFijos.q1).reduce((a, b) => a + b, 0);
  const gastosQ2 = Object.values(db.gastosFijos.q2).reduce((a, b) => a + b, 0);
  const cuotasTotal = Object.values(db.cuotasRecomendadas).reduce((a, b) => a + b, 0);
  const ingresosMes = db.config.ingresoQ1 + db.config.ingresoQ2;
  const sobranteMensualBase = Math.max(0, ingresosMes - gastosQ1 - gastosQ2 - cuotasTotal);

  const proyeccion = [];
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = new Date(2028, 11, 1);

  for (let d = new Date(inicio); d <= fin; d.setMonth(d.getMonth() + 1)) {
    const mesLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    for (const nombre of Object.keys(saldos)) {
      if (saldos[nombre] <= 0) continue;
      const interes = saldos[nombre] * tasas[nombre];
      const cuota = Math.min(db.cuotasRecomendadas[nombre], saldos[nombre] + interes);
      saldos[nombre] = saldos[nombre] + interes - cuota;
    }

    let abonoExtraDisponible = sobranteMensualBase * 0.5;
    for (const nombre of ORDEN_ABONO_EXTRA) {
      if (abonoExtraDisponible <= 0) break;
      if (saldos[nombre] <= 0) continue;
      const abono = Math.min(saldos[nombre], abonoExtraDisponible);
      saldos[nombre] -= abono;
      abonoExtraDisponible -= abono;
    }

    for (const nombre of Object.keys(saldos)) {
      saldos[nombre] = Math.max(0, Math.round(saldos[nombre]));
    }

    proyeccion.push({ mes: mesLabel, saldos: { ...saldos } });
    if (Object.values(saldos).every((s) => s <= 0)) break;
  }

  res.json({ sobranteMensualBase: Math.round(sobranteMensualBase), proyeccion });
});

export default router;
