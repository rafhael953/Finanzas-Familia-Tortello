// Pruebas de las cuentas de calculos.js. Cada una de estas nace de un bug
// real que se le paso a Rafael en produccion (ver los commits del
// 2026-09-16) -- la idea es que si alguno de estos vuelve a romperse, lo
// agarre esto antes de que llegue al celular.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quincenaId,
  partesQuincena,
  quincenaAnterior,
  quincenaSiguiente,
  ANCLA_ARRASTRE,
  calcularEstadoQuincena,
  calcularSaldoInicial,
  calcularAlertasDeudas,
  calcularEstadoMensual,
} from "./calculos.js";

function dbBase(overrides = {}) {
  return {
    config: { ingresoQ1: 4714000, ingresoQ2: 4441500, prima: 3575000 },
    gastosFijos: { q1: {}, q2: {} },
    cuotasRecomendadas: {},
    deudasIniciales: {},
    repartoCuotas: {},
    movimientos: [],
    ...overrides,
  };
}

test("calcularAlertasDeudas usa el mes calendario real (1-15 + 16-fin), no Q1+Q2 del mismo id", () => {
  const fechaRef = new Date(2026, 9, 16); // 16 de octubre: revisa septiembre real

  const pagadoATiempo = dbBase({
    cuotasRecomendadas: { rappi: 500000 },
    deudasIniciales: { rappi: 2000000 },
    movimientos: [
      // dias 1-15 de septiembre real = id "2026-08-Q2"
      { tipo: "deuda", categoria: "rappi", monto: 500000, confirmado: true, quincenaId: "2026-08-Q2", registradoPor: "rafael" },
    ],
  });
  assert.deepEqual(calcularAlertasDeudas(pagadoATiempo, fechaRef), []);

  const pagoMalUbicado = dbBase({
    cuotasRecomendadas: { rappi: 500000 },
    deudasIniciales: { rappi: 2000000 },
    movimientos: [
      // "2026-09-Q2" son los dias 1-15 de OCTUBRE, no de septiembre -- el
      // agrupamiento viejo (Q1+Q2 del mismo numero de mes del id) los
      // mezclaba con septiembre por error.
      { tipo: "deuda", categoria: "rappi", monto: 500000, confirmado: true, quincenaId: "2026-09-Q2", registradoPor: "rafael" },
    ],
  });
  const alertas = calcularAlertasDeudas(pagoMalUbicado, fechaRef);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].categoria, "rappi");
  assert.equal(alertas[0].faltante, 500000);
});

test("calcularAlertasDeudas no reclama nada si la ventana del mes anterior cae antes del ancla", () => {
  const { anio, mes } = partesQuincena(ANCLA_ARRASTRE);
  const fechaRef = new Date(anio, mes, 16); // un mes despues de la ancla: revisa el mes de la ancla misma
  const db = dbBase({
    cuotasRecomendadas: { rappi: 500000, falabella: 700000 },
    deudasIniciales: { rappi: 2000000, falabella: 3000000 },
  });
  assert.deepEqual(calcularAlertasDeudas(db, fechaRef), []);
});

test("calcularSaldoInicial no se resetea a 0 al saltar dos o mas quincenas al futuro", () => {
  const hoy = quincenaId();
  const dosAdelante = quincenaSiguiente(quincenaSiguiente(hoy));
  const db = dbBase({
    gastosFijos: { q1: { arriendo: 1000000 }, q2: { arriendo: 1000000 } },
    movimientos: [
      { tipo: "ingreso", categoria: "salario", monto: 4714000, confirmado: true, quincenaId: hoy, registradoPor: "rafael" },
      { tipo: "gasto", categoria: "arriendo", monto: 1000000, confirmado: true, quincenaId: hoy, registradoPor: "rafael" },
    ],
  });
  const balanceHoy = calcularEstadoQuincena(db, hoy).balanceConfirmado;
  assert.equal(balanceHoy, 3714000);
  // La quincena intermedia (un paso adelante de hoy) no tiene movimientos
  // todavia -- antes, calcularSaldoInicial se rendia ahi y devolvia 0 en
  // vez de seguir la cadena un paso mas atras hasta hoy.
  assert.equal(calcularSaldoInicial(db, dosAdelante), balanceHoy);
});

test("el atraso de una cuota vencida se suma al presupuesto solo en la quincena viva", () => {
  const { anio, mes } = partesQuincena(ANCLA_ARRASTRE);
  const fechaRef = new Date(anio, mes + 1, 16); // dos meses despues de la ancla: zona confiable
  const hoy = quincenaId(fechaRef);
  const db = dbBase({
    cuotasRecomendadas: { auteco: 400000 },
    deudasIniciales: { auteco: 2000000 },
  });

  const estadoHoy = calcularEstadoQuincena(db, hoy, fechaRef);
  assert.equal(estadoHoy.atrasoTotal, 400000);
  assert.equal(estadoHoy.deudas.find((d) => d.categoria === "auteco").atraso, 400000);

  const estadoOtra = calcularEstadoQuincena(db, quincenaAnterior(hoy), fechaRef);
  assert.equal(estadoOtra.atrasoTotal, 0);
});

test("sobranteSeguro exige lo confirmado en la quincena viva pero asume el sueldo esperado en una futura", () => {
  const hoy = quincenaId();
  const futura = quincenaSiguiente(quincenaSiguiente(hoy));
  const db = dbBase({
    gastosFijos: { q1: { arriendo: 1000000 }, q2: { arriendo: 1000000 } },
  });

  assert.equal(calcularEstadoQuincena(db, hoy).riesgoGasto, true);
  assert.equal(calcularEstadoQuincena(db, futura).riesgoGasto, false);
});

test("calcularEstadoMensual cuenta un ingreso extra ya confirmado, no solo el sueldo por defecto", () => {
  const hoy = quincenaId();
  const { q } = partesQuincena(hoy);
  // El salario "normal" tiene que estar confirmado y coincidir con el
  // default, para que la unica diferencia entre los dos casos sea el
  // extra -- si no, el max(confirmado, default) del propio salario ya
  // tapa cualquier diferencia sin que el extra tenga que ver.
  const salarioNormal = { tipo: "ingreso", categoria: "salario", monto: q === 1 ? 4714000 : 4441500, confirmado: true, quincenaId: hoy, registradoPor: "rafael" };
  const extra = { tipo: "ingreso", categoria: "extra", monto: 900000, confirmado: true, quincenaId: hoy, registradoPor: "rafael" };

  const sinExtra = calcularEstadoMensual(dbBase({ movimientos: [salarioNormal] }), hoy).sobranteSeguro;
  const conExtra = calcularEstadoMensual(dbBase({ movimientos: [salarioNormal, extra] }), hoy).sobranteSeguro;
  assert.equal(conExtra - sinExtra, 900000);
});

test("una cuota pagada en la quincena hermana real no se reserva dos veces", () => {
  // La cuota de rappi se asigna a la quincena "2026-08-Q2" (1-15 de
  // septiembre), pero se paga de verdad en "2026-09-Q1" (16-30, la hermana
  // real del mismo mes calendario) -- antes, la reserva de la primera
  // quedaba fantasma (nunca se cancelaba) y se sumaba encima del pago real.
  const db = dbBase({
    cuotasRecomendadas: { rappi: 700000 },
    deudasIniciales: { rappi: 3000000 },
    repartoCuotas: { rappi: 2 },
    movimientos: [
      { tipo: "deuda", categoria: "rappi", monto: 1300000, confirmado: true, quincenaId: "2026-09-Q1", registradoPor: "rafael" },
    ],
  });
  const q1 = calcularEstadoQuincena(db, "2026-08-Q2");
  const q2 = calcularEstadoQuincena(db, "2026-09-Q1");
  assert.equal(q1.deudas.find((d) => d.categoria === "rappi").presupuesto, 0);
  assert.equal(q2.deudas.find((d) => d.categoria === "rappi").total, 1300000);
});

test("calcularEstadoMensual no duplica la prima ya confirmada", () => {
  const idJunio = "2026-06-Q1"; // real junio = 2026-05-Q2 + 2026-06-Q1
  const db = dbBase({
    config: { ingresoQ1: 1000000, ingresoQ2: 1000000, prima: 500000 },
    movimientos: [
      { tipo: "ingreso", categoria: "prima", monto: 500000, confirmado: true, quincenaId: idJunio, registradoPor: "rafael" },
      { tipo: "ingreso", categoria: "salario", monto: 1000000, confirmado: true, quincenaId: idJunio, registradoPor: "rafael" },
    ],
  });
  const em = calcularEstadoMensual(db, idJunio);
  assert.equal(em.ingresoEsperadoTotal, 2500000);
});
