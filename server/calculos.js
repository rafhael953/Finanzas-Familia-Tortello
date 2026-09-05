export function quincenaId(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const q = fecha.getDate() <= 15 ? 1 : 2;
  return `${y}-${m}-Q${q}`;
}

export function partesQuincena(id) {
  const [y, m, qStr] = id.split("-");
  return { anio: Number(y), mes: Number(m), q: Number(qStr.replace("Q", "")) };
}

export function idQuincena(anio, mes, q) {
  return `${anio}-${String(mes).padStart(2, "0")}-Q${q}`;
}

export const NOMBRES_MES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function esConfirmado(m) {
  return m.confirmado !== false;
}

function totales(movs, tipo, categoria) {
  const deCategoria = movs.filter((m) => m.tipo === tipo && m.categoria === categoria);
  const confirmado = deCategoria.filter(esConfirmado).reduce((a, m) => a + Number(m.monto || 0), 0);
  const pendiente = deCategoria.filter((m) => !esConfirmado(m)).reduce((a, m) => a + Number(m.monto || 0), 0);
  return { confirmado, pendiente, total: confirmado + pendiente };
}

// Estado en vivo de una quincena, con separacion confirmado (real, ya paso)
// vs pendiente (planeado/estimado, aun no confirmado item a item).
export function calcularEstadoQuincena(db, id) {
  const { q, mes, anio } = partesQuincena(id);
  const key = q === 1 ? "q1" : "q2";
  const movs = (db.movimientos || []).filter((m) => m.quincenaId === id);

  const presupuestoGastos = db.gastosFijos[key];
  const presupuestoDeudas = db.cuotasRecomendadas;
  const salarioDefault = q === 1 ? db.config.ingresoQ1 : db.config.ingresoQ2;

  const gastos = Object.keys(presupuestoGastos).map((cat) => ({
    categoria: cat,
    presupuesto: presupuestoGastos[cat],
    ...totales(movs, "gasto", cat),
  }));

  // Las cuotas de deuda son mensuales, no por quincena: si ya se pago en la
  // otra quincena del mismo mes, no hay que volver a sugerirla aqui.
  const idHermana = idQuincena(anio, mes, q === 1 ? 2 : 1);
  const movsHermana = (db.movimientos || []).filter((m) => m.quincenaId === idHermana);

  const deudas = Object.keys(presupuestoDeudas).map((cat) => {
    const propios = totales(movs, "deuda", cat);
    const enHermana = totales(movsHermana, "deuda", cat).confirmado;
    return {
      categoria: cat,
      presupuesto: presupuestoDeudas[cat],
      pagadoEnOtraQuincena: enHermana,
      ...propios,
    };
  });

  const categoriasReserva = ["xtb", "medicaBucaramanga", "jerardith"];
  const reservas = categoriasReserva.map((cat) => ({
    categoria: cat,
    presupuesto: 0,
    ...totales(movs, "reserva", cat),
  }));

  // Ingresos: como cualquier otra categoria, arranca en $0 hasta que se
  // confirme (o se agregue como plan) un movimiento real. El salarioDefault
  // solo se usa como sugerencia precargada en la fila de confirmacion rapida.
  const salario = totales(movs, "ingreso", "salario");
  const prima = totales(movs, "ingreso", "prima");
  const extra = totales(movs, "ingreso", "extra");

  const ingresos = [
    { categoria: "salario", presupuesto: salarioDefault, ...salario },
    { categoria: "prima", presupuesto: 0, ...prima },
    { categoria: "extra", presupuesto: 0, ...extra },
  ];

  const sumar = (lista, campo) => lista.reduce((a, x) => a + x[campo], 0);

  const ingresosConfirmado = sumar(ingresos, "confirmado");
  const ingresosTotal = sumar(ingresos, "total");

  const gastosConfirmado = sumar(gastos, "confirmado");
  const gastosTotal = sumar(gastos, "total");
  const deudasConfirmado = sumar(deudas, "confirmado");
  const deudasTotal = sumar(deudas, "total");
  const reservasConfirmado = sumar(reservas, "confirmado");
  const reservasTotal = sumar(reservas, "total");

  const egresoConfirmado = gastosConfirmado + deudasConfirmado + reservasConfirmado;
  const egresoTotal = gastosTotal + deudasTotal + reservasTotal;

  const balanceConfirmado = ingresosConfirmado - egresoConfirmado;
  const balanceProyectado = ingresosTotal - egresoTotal;

  // El sobrante que se reparte a NU/abono-extra NO puede calcularse solo con
  // lo confirmado hasta ahora: eso ignora gastos y cuotas que sabemos que
  // faltan por pagar esta quincena (presupuesto) y sobreestima lo disponible.
  // Se reserva primero lo esperado (lo mayor entre el presupuesto y lo ya
  // gastado, por si algo se paso de presupuesto) y solo el remanente real
  // se considera sobrante seguro para mover a NU.
  const egresoEsperado = (lista) => lista.reduce((a, x) => a + Math.max(x.presupuesto, x.total), 0);
  const egresoEsperadoTotal = egresoEsperado(gastos) + egresoEsperado(deudas) + reservasTotal;
  const sobranteSeguro = ingresosConfirmado - egresoEsperadoTotal;

  const sobrante = sobranteSeguro > 0 ? sobranteSeguro : 0;
  const aNU = Math.round(sobrante * 0.5);
  const aDeuda = sobrante - aNU;

  const confirmada = (db.estadoQuincenas || {})[id] === "confirmada";

  return {
    id,
    mes,
    anio,
    quincena: q,
    confirmada,
    ingresos,
    ingresosConfirmado,
    ingresosTotal,
    gastos,
    gastosConfirmado,
    gastosTotal,
    deudas,
    deudasConfirmado,
    deudasTotal,
    reservas,
    reservasConfirmado,
    reservasTotal,
    egresoConfirmado,
    egresoTotal,
    balanceConfirmado,
    balanceProyectado,
    sobrante,
    aNU,
    aDeuda,
    movimientos: [...movs].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
  };
}

// Cuanto se pago (confirmado) de una deuda en un mes calendario completo
// (sumando sus dos quincenas).
function pagadoDeudaEnMes(db, categoria, anio, mes) {
  const q1 = idQuincena(anio, mes, 1);
  const q2 = idQuincena(anio, mes, 2);
  return (db.movimientos || [])
    .filter(
      (m) =>
        m.tipo === "deuda" &&
        m.categoria === categoria &&
        esConfirmado(m) &&
        (m.quincenaId === q1 || m.quincenaId === q2)
    )
    .reduce((a, m) => a + Number(m.monto || 0), 0);
}

// Alertas de cuotas atrasadas: una deuda se paga UNA vez al mes (no dos).
// Si el mes anterior se cerro sin completar la cuota, se avisa aqui con
// fecha limite el 15 del mes en curso, para no pagarla dos veces ni
// olvidarla.
export function calcularAlertasDeudas(db, fechaRef = new Date()) {
  const anio = fechaRef.getFullYear();
  const mes = fechaRef.getMonth() + 1;
  let mesAnt = mes - 1;
  let anioAnt = anio;
  if (mesAnt === 0) {
    mesAnt = 12;
    anioAnt -= 1;
  }

  const alertas = [];
  for (const categoria of Object.keys(db.cuotasRecomendadas || {})) {
    const cuota = db.cuotasRecomendadas[categoria];
    const pagadoMesAnterior = pagadoDeudaEnMes(db, categoria, anioAnt, mesAnt);
    if (pagadoMesAnterior < cuota) {
      const faltante = cuota - pagadoMesAnterior;
      alertas.push({
        categoria,
        tipo: "atrasada",
        faltante,
        mensaje: `No quedó completa la cuota de ${NOMBRES_MES[mesAnt]}. Faltan ${faltante.toLocaleString("es-CO")} — págalo antes del 15 de ${NOMBRES_MES[mes]} para no atrasarte más.`,
      });
    }
  }
  return alertas;
}

// Lista de quincenas con al menos un movimiento, ordenadas cronologicamente.
export function listaQuincenasConDatos(db) {
  const ids = new Set((db.movimientos || []).map((m) => m.quincenaId));
  return [...ids].sort();
}

// Evolucion del sobrante que se va acumulando al NU, quincena a quincena,
// calculado en vivo (sin necesitar ningun paso de "cierre").
export function calcularEvolucionNU(db) {
  const ids = listaQuincenasConDatos(db);
  let acumulado = 0;
  return ids.map((id) => {
    const estado = calcularEstadoQuincena(db, id);
    acumulado += estado.aNU;
    return { quincenaId: id, aNU: estado.aNU, acumulado };
  });
}

// Resumen del mismo mes calendario (ambas quincenas), por categoria de gasto.
export function calcularResumenMensual(db, id) {
  const { mes, anio } = partesQuincena(id);
  const prefijo = `${anio}-${String(mes).padStart(2, "0")}`;
  const movs = (db.movimientos || []).filter((m) => m.quincenaId.startsWith(prefijo));

  function totalPorCategoria(tipo) {
    const mapa = {};
    for (const m of movs) {
      if (m.tipo !== tipo || !esConfirmado(m)) continue;
      mapa[m.categoria] = (mapa[m.categoria] || 0) + Number(m.monto || 0);
    }
    return mapa;
  }

  return {
    mes: prefijo,
    gastos: totalPorCategoria("gasto"),
    deudas: totalPorCategoria("deuda"),
    reservas: totalPorCategoria("reserva"),
  };
}
