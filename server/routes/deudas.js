import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { calcularAlertasDeudas } from "../calculos.js";

const router = Router();

// Tarjetas de credito reales, donde tiene sentido registrar una compra
// nueva y prorratearla en cuotas. Las demas deudas (moto, prestamos) no
// funcionan como una tarjeta que se puede volver a usar.
const TARJETAS = ["falabella", "rappi"];

router.get("/alertas", async (req, res) => {
  const db = await readDB();
  res.json(calcularAlertasDeudas(db));
});

router.get("/compras", async (req, res) => {
  const db = await readDB();
  res.json(db.comprasTarjeta || []);
});

function mesActualPrefijo() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
}

// Deja constancia de que la cuota de una deuda cambio, para que las alertas
// de mora puedan saber cual era el valor vigente en un mes pasado en vez de
// juzgarlo con el valor de hoy (ej. si subes la cuota este mes, no se le
// puede exigir esa cuota mas alta al mes pasado).
function registrarCambioCuota(db, categoria, valorAnterior, valorNuevo) {
  if (valorAnterior === valorNuevo) return;
  db.historialCuotas = db.historialCuotas || {};
  const historial = (db.historialCuotas[categoria] = db.historialCuotas[categoria] || []);
  if (historial.length === 0) {
    // Primer cambio que se registra para esta deuda: deja constancia de
    // cual era el valor "de siempre" antes de este cambio.
    historial.push({ desde: "0000-00", valor: valorAnterior });
  }
  // Si ya se cambio la cuota este mismo mes, se reemplaza esa entrada en
  // vez de apilar otra: solo importa con que valor termina el mes.
  const mes = mesActualPrefijo();
  const existente = historial.find((h) => h.desde === mes);
  if (existente) existente.valor = valorNuevo;
  else historial.push({ desde: mes, valor: valorNuevo });
}

// Ajustar directamente la cuota mensual recomendada de una deuda -- es una
// linea base, no un valor fijo para siempre: se puede subir o bajar cuando
// haga falta, sin que tenga que ser por una compra nueva.
router.put("/cuota", async (req, res) => {
  const { categoria, valor } = req.body || {};
  const valorNum = Number(valor);
  if (!valorNum || valorNum <= 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  try {
    await withDB(async (db) => {
      if (!(categoria in (db.cuotasRecomendadas || {}))) {
        const e = new Error("Esa deuda no existe");
        e.status = 400;
        throw e;
      }
      registrarCambioCuota(db, categoria, db.cuotasRecomendadas[categoria], valorNum);
      db.cuotasRecomendadas[categoria] = valorNum;
    });
    res.json({ ok: true, categoria, valor: valorNum });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Registrar una compra nueva con tarjeta: se suma al saldo pendiente de esa
// tarjeta, y la cuota mensual recomendada sube lo necesario para pagarla en
// el numero de cuotas elegido (ademas de lo que ya se venia pagando).
router.post("/compra", async (req, res) => {
  const { tarjeta, monto, cuotas, fecha, descripcion } = req.body || {};
  if (!TARJETAS.includes(tarjeta)) {
    return res.status(400).json({ error: "Esa deuda no admite compras nuevas a cuotas" });
  }
  const montoNum = Number(monto);
  const cuotasNum = Number(cuotas);
  if (!montoNum || montoNum <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }
  if (!cuotasNum || cuotasNum <= 0 || !Number.isInteger(cuotasNum)) {
    return res.status(400).json({ error: "Número de cuotas inválido" });
  }

  const cuotaMensual = Math.round(montoNum / cuotasNum);

  const compra = await withDB(async (db) => {
    db.deudasIniciales[tarjeta] += montoNum;
    registrarCambioCuota(db, tarjeta, db.cuotasRecomendadas[tarjeta], db.cuotasRecomendadas[tarjeta] + cuotaMensual);
    db.cuotasRecomendadas[tarjeta] += cuotaMensual;

    db.comprasTarjeta = db.comprasTarjeta || [];
    const registro = {
      id: `compra-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      tarjeta,
      monto: montoNum,
      cuotas: cuotasNum,
      cuotaMensual,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      descripcion: descripcion || "",
    };
    db.comprasTarjeta.push(registro);
    return registro;
  });

  res.json(compra);
});

// Corregir una compra ya registrada (se equivoco en el monto o le
// cambiaron las cuotas): se revierte el efecto anterior y se aplica el
// nuevo, para que el saldo y la cuota mensual queden consistentes.
router.put("/compra/:id", async (req, res) => {
  const { monto, cuotas, fecha, descripcion } = req.body || {};
  const montoNum = Number(monto);
  const cuotasNum = Number(cuotas);
  if (!montoNum || montoNum <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }
  if (!cuotasNum || cuotasNum <= 0 || !Number.isInteger(cuotasNum)) {
    return res.status(400).json({ error: "Número de cuotas inválido" });
  }

  try {
    const actualizada = await withDB(async (db) => {
      const compra = (db.comprasTarjeta || []).find((c) => c.id === req.params.id);
      if (!compra) {
        const e = new Error("No encontrada");
        e.status = 404;
        throw e;
      }
      const nuevaCuota = Math.round(montoNum / cuotasNum);

      db.deudasIniciales[compra.tarjeta] += montoNum - compra.monto;
      const cuotaAntes = db.cuotasRecomendadas[compra.tarjeta];
      const cuotaDespues = cuotaAntes - compra.cuotaMensual + nuevaCuota;
      registrarCambioCuota(db, compra.tarjeta, cuotaAntes, cuotaDespues);
      db.cuotasRecomendadas[compra.tarjeta] = cuotaDespues;

      compra.monto = montoNum;
      compra.cuotas = cuotasNum;
      compra.cuotaMensual = nuevaCuota;
      if (fecha !== undefined) compra.fecha = fecha;
      if (descripcion !== undefined) compra.descripcion = descripcion;
      return compra;
    });
    res.json(actualizada);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Borrar una compra registrada por error: deshace por completo lo que
// habia sumado al saldo y a la cuota mensual de esa tarjeta.
router.delete("/compra/:id", async (req, res) => {
  try {
    await withDB(async (db) => {
      const idx = (db.comprasTarjeta || []).findIndex((c) => c.id === req.params.id);
      if (idx < 0) {
        const e = new Error("No encontrada");
        e.status = 404;
        throw e;
      }
      const [compra] = db.comprasTarjeta.splice(idx, 1);
      db.deudasIniciales[compra.tarjeta] -= compra.monto;
      const cuotaAntes = db.cuotasRecomendadas[compra.tarjeta];
      const cuotaDespues = Math.max(0, cuotaAntes - compra.cuotaMensual);
      registrarCambioCuota(db, compra.tarjeta, cuotaAntes, cuotaDespues);
      db.cuotasRecomendadas[compra.tarjeta] = cuotaDespues;
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
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
    decameron: 0,
    nohora: 0,
    bancolombia: 0,
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

  // El abono extra es un valor que se define a mano, NO uno que se asume.
  // Antes se calculaba como la mitad del sobrante teorico del presupuesto,
  // lo que daba una proyeccion irreal (las deudas desaparecian en meses)
  // porque supone que cada quincena cierra exactamente segun lo planeado.
  // Por defecto es 0: la proyeccion muestra solo lo que dan las cuotas.
  const abonoExtraMensual = Math.max(0, Number(db.config.abonoExtraMensual) || 0);

  // Referencia informativa: cuanto sobraria al mes si todo saliera segun
  // el presupuesto. Sirve para sugerir un abono extra, no para asumirlo.
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

    let abonoExtraDisponible = abonoExtraMensual;
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

  res.json({
    sobranteMensualBase: Math.round(sobranteMensualBase),
    abonoExtraMensual,
    proyeccion,
  });
});

export default router;
