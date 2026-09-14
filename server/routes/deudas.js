import { Router } from "express";
import { readDB, withDB } from "../db.js";
import { calcularAlertasDeudas, quincenaId, saldosDeuda } from "../calculos.js";

const router = Router();

// Tarjetas de credito reales, donde tiene sentido registrar una compra
// nueva y prorratearla en cuotas. Las demas deudas (moto, prestamos) no
// funcionan como una tarjeta que se puede volver a usar.
const TARJETAS = ["falabella", "rappi"];

router.get("/alertas", async (req, res) => {
  const db = await readDB();
  res.json(calcularAlertasDeudas(db));
});

// Una compra con tarjeta es un movimiento mas, igual que un gasto o una
// cuota. Antes vivia en un arreglo aparte (db.comprasTarjeta) y eso tenia
// dos problemas graves: no salia en el historial, y sobre todo las
// sincronizaciones entre el celular y el computador solo copian
// "movimientos", asi que cualquier compra registrada se perdia sin dejar
// rastro en el primer reemplazo de datos. Aca se traduce al formato que
// espera la app.
function comoCompra(m) {
  return {
    id: m.id,
    tarjeta: m.categoria,
    monto: m.monto,
    cuotas: m.cuotas,
    cuotaMensual: m.cuotaMensual,
    fecha: m.fecha,
    descripcion: m.descripcion || "",
  };
}

function comprasDe(db) {
  return (db.movimientos || []).filter((m) => m.tipo === "compraTarjeta");
}

router.get("/compras", async (req, res) => {
  const db = await readDB();
  res.json(
    comprasDe(db)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .map(comoCompra)
  );
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

// Cupo REAL de credito que da el banco por tarjeta (no el tope de disciplina
// de gasto, ese es /api/config con cupoTarjetasMensual). Sirve para avisar
// cuando el saldo rotativo de una tarjeta se le acerca o se le pasa al
// limite de verdad.
router.put("/cupo-credito", async (req, res) => {
  const { categoria, valor } = req.body || {};
  const valorNum = Number(valor);
  if (!TARJETAS.includes(categoria)) {
    return res.status(400).json({ error: "Esa tarjeta no existe" });
  }
  if (!valorNum || valorNum <= 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }
  await withDB(async (db) => {
    db.config.cupoCreditoTarjetas = db.config.cupoCreditoTarjetas || {};
    db.config.cupoCreditoTarjetas[categoria] = valorNum;
  });
  res.json({ ok: true, categoria, valor: valorNum });
});

// Ajustar el saldo de HOY de una tarjeta cuando no cuadra con el extracto
// real del banco (ej. algo quedo mal importado o se le escapo un movimiento).
// No se toca el historial de compras/pagos ya registrado: en vez de eso se
// corrige `deudasIniciales`, el punto de partida, en lo que haga falta para
// que inicial + compras - pagos ya confirmados vuelva a dar el saldo de hoy
// que Rafael acaba de confirmar contra el extracto.
router.put("/ajustar-saldo", async (req, res) => {
  const { categoria, saldoHoy } = req.body || {};
  const saldoHoyNum = Number(saldoHoy);
  if (!Number.isFinite(saldoHoyNum) || saldoHoyNum < 0) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  try {
    const resultado = await withDB(async (db) => {
      if (!(categoria in (db.deudasIniciales || {}))) {
        const e = new Error("Esa deuda no existe");
        e.status = 400;
        throw e;
      }
      const actual = saldosActuales(db)[categoria] || 0;
      const diferencia = saldoHoyNum - actual;
      db.deudasIniciales[categoria] = (db.deudasIniciales[categoria] || 0) + diferencia;
      return { saldoAnterior: actual, saldoInicial: db.deudasIniciales[categoria] };
    });
    res.json({ ok: true, categoria, saldoHoy: saldoHoyNum, ...resultado });
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
    // El saldo inicial NO se toca: significa "lo que se debia al empezar" y
    // si se le suman las compras deja de querer decir nada (el "% pagado"
    // cambiaria hacia atras cada vez que se usa la tarjeta). El saldo de hoy
    // se calcula: inicial + compras - pagos.
    registrarCambioCuota(db, tarjeta, db.cuotasRecomendadas[tarjeta], db.cuotasRecomendadas[tarjeta] + cuotaMensual);
    db.cuotasRecomendadas[tarjeta] += cuotaMensual;

    const cuando = fecha || new Date().toISOString().slice(0, 10);
    const registro = {
      id: `compra-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      quincenaId: quincenaId(new Date(`${cuando}T12:00:00`)),
      tipo: "compraTarjeta",
      categoria: tarjeta,
      monto: montoNum,
      cuotas: cuotasNum,
      cuotaMensual,
      descripcion: descripcion || "",
      fecha: cuando,
      confirmado: true,
    };
    db.movimientos = db.movimientos || [];
    db.movimientos.push(registro);
    return registro;
  });

  res.json(comoCompra(compra));
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
      const compra = comprasDe(db).find((c) => c.id === req.params.id);
      if (!compra) {
        const e = new Error("No encontrada");
        e.status = 404;
        throw e;
      }
      const nuevaCuota = Math.round(montoNum / cuotasNum);

      const cuotaAntes = db.cuotasRecomendadas[compra.categoria];
      const cuotaDespues = cuotaAntes - compra.cuotaMensual + nuevaCuota;
      registrarCambioCuota(db, compra.categoria, cuotaAntes, cuotaDespues);
      db.cuotasRecomendadas[compra.categoria] = cuotaDespues;

      compra.monto = montoNum;
      compra.cuotas = cuotasNum;
      compra.cuotaMensual = nuevaCuota;
      if (fecha !== undefined) {
        compra.fecha = fecha;
        compra.quincenaId = quincenaId(new Date(`${fecha}T12:00:00`));
      }
      if (descripcion !== undefined) compra.descripcion = descripcion;
      return compra;
    });
    res.json(comoCompra(actualizada));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Borrar una compra registrada por error: deshace por completo lo que
// habia sumado al saldo y a la cuota mensual de esa tarjeta.
router.delete("/compra/:id", async (req, res) => {
  try {
    await withDB(async (db) => {
      const idx = (db.movimientos || []).findIndex(
        (m) => m.tipo === "compraTarjeta" && m.id === req.params.id
      );
      if (idx < 0) {
        const e = new Error("No encontrada");
        e.status = 404;
        throw e;
      }
      const [compra] = db.movimientos.splice(idx, 1);
      const cuotaAntes = db.cuotasRecomendadas[compra.categoria];
      const cuotaDespues = Math.max(0, cuotaAntes - compra.cuotaMensual);
      registrarCambioCuota(db, compra.categoria, cuotaAntes, cuotaDespues);
      db.cuotasRecomendadas[compra.categoria] = cuotaDespues;
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});


// Saldo de hoy = lo que se debia al empezar + lo que se ha comprado con la
// tarjeta - lo que se ha abonado. Antes las compras se sumaban al saldo
// inicial, lo que borraba el sentido de ese numero y del "% pagado".
export function saldosActuales(db) {
  return saldosDeuda(db);
}

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
  const saldos = saldosActuales(db);
  // Cuanto se ha comprado con cada tarjeta despues del saldo inicial: hace
  // falta para que el "% pagado" se calcule sobre el total real y no sobre
  // un punto de partida que quedo viejo.
  const comprado = {};
  for (const m of comprasDe(db)) {
    comprado[m.categoria] = (comprado[m.categoria] || 0) + Number(m.monto || 0);
  }

  const detalle = Object.keys(saldos).map((nombre) => ({
    nombre,
    saldo: Math.max(0, Math.round(saldos[nombre])),
    saldoInicial: db.deudasIniciales[nombre],
    comprado: comprado[nombre] || 0,
    cuotaRecomendada: db.cuotasRecomendadas[nombre],
  }));
  res.json(detalle);
});

// Radiografia de una deuda: saldo inicial mas cada compra y cada pago que
// se le ha registrado, en orden, con el saldo que iba quedando despues de
// cada uno. Nace de que Rafael no tenia como ver por que el saldo total de
// Rappi no le cuadraba -- con la lista completa a la vista se puede
// comparar contra lo que el recuerda haber hecho y encontrar donde esta el
// hueco (una compra que no se borro bien, un pago que no quedo, etc).
router.get("/:categoria/detalle", async (req, res) => {
  const { categoria } = req.params;
  const db = await readDB();
  if (!(categoria in (db.deudasIniciales || {}))) {
    return res.status(404).json({ error: "Esa deuda no existe" });
  }

  const eventos = (db.movimientos || [])
    .filter((m) => m.categoria === categoria && (m.tipo === "deuda" || m.tipo === "compraTarjeta"))
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo === "deuda" ? "pago" : "compra",
      monto: Number(m.monto || 0),
      descripcion: m.descripcion || "",
      cuotas: m.cuotas || null,
      cuotaMensual: m.cuotaMensual || null,
      confirmado: m.confirmado !== false,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  // El saldo corrido solo cuenta lo firme (confirmado): un pago o una
  // compra pendiente todavia no movio la plata de verdad.
  let saldo = db.deudasIniciales[categoria] || 0;
  const saldoInicial = saldo;
  const detalle = eventos.map((e) => {
    if (e.confirmado) {
      saldo += e.tipo === "compra" ? e.monto : -e.monto;
    }
    return { ...e, saldoDespues: Math.round(saldo) };
  });

  res.json({ categoria, saldoInicial, eventos: detalle, saldoFinal: Math.round(saldo) });
});

// Proyeccion mensual sep-2026 a dic-2028
router.get("/proyeccion", async (req, res) => {
  const db = await readDB();
  const tasas = tasasPorDeuda(db.config);

  // saldos actuales reales (con abonos ya hechos) como punto de partida
  const actuales = saldosActuales(db);
  let saldos = {};
  for (const k of Object.keys(actuales)) saldos[k] = Math.max(0, actuales[k]);

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
