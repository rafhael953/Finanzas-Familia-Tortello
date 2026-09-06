// La quincena "activa" no es la del calendario sino la del sueldo con el
// que se esta viviendo hoy: el pago de la Q2 de un mes llega a fin de mes,
// asi que del 1 al 15 se esta gastando esa Q2 del mes anterior. Del 16 en
// adelante ya entro el pago de la Q1 del mes en curso.
export function quincenaId(fecha = new Date()) {
  let anio = fecha.getFullYear();
  let mes = fecha.getMonth() + 1;

  if (fecha.getDate() <= 15) {
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      anio -= 1;
    }
    return idQuincena(anio, mes, 2);
  }
  return idQuincena(anio, mes, 1);
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

  // Lo que Jerardith registra es el DETALLE de en que se fue la plata que
  // Rafael ya le entrego, no una segunda salida de dinero de la casa: el
  // gasto real ocurrio cuando el le paso el mercado/cuidado/bolsillo. Por
  // eso los totales de la casa se calculan solo con lo que registro el.
  const movsCasa = movs.filter((m) => m.registradoPor !== "jerardith");

  const presupuestoGastos = db.gastosFijos[key];
  const presupuestoDeudas = db.cuotasRecomendadas;
  const salarioDefault = q === 1 ? db.config.ingresoQ1 : db.config.ingresoQ2;

  const gastosPresupuestados = Object.keys(presupuestoGastos).map((cat) => ({
    categoria: cat,
    presupuesto: presupuestoGastos[cat],
    ...totales(movsCasa, "gasto", cat),
  }));

  // Gastos sin presupuesto fijo: no son un monto fijo cada quincena (lo que
  // le des a Jerardith varia, la reserva medica tambien), asi que su
  // presupuesto siempre es 0 -- solo cuentan lo que realmente se registro.
  const categoriasGastoVariable = ["aseo", "medicaBucaramanga", "jerardith"];
  const gastosVariables = categoriasGastoVariable.map((cat) => ({
    categoria: cat,
    presupuesto: 0,
    ...totales(movsCasa, "gasto", cat),
  }));

  // Categorias que la familia crea sobre la marcha (ver routes/categorias.js)
  // -- tambien sin presupuesto fijo, igual que las variables de arriba.
  const categoriasPersonalizadas = db.categoriasPersonalizadas || {};
  const gastosPersonalizados = Object.keys(categoriasPersonalizadas.gasto || {}).map((cat) => ({
    categoria: cat,
    presupuesto: 0,
    ...totales(movsCasa, "gasto", cat),
  }));

  const gastos = [...gastosPresupuestados, ...gastosVariables, ...gastosPersonalizados];

  // Las cuotas de deuda son mensuales, no por quincena: si ya se pago en la
  // otra quincena del mismo mes, no hay que volver a sugerirla aqui.
  const idHermana = idQuincena(anio, mes, q === 1 ? 2 : 1);
  const movsHermana = (db.movimientos || []).filter((m) => m.quincenaId === idHermana);

  const deudas = Object.keys(presupuestoDeudas).map((cat) => {
    const propios = totales(movsCasa, "deuda", cat);
    const enHermana = totales(movsHermana, "deuda", cat).confirmado;

    // Una deuda ya saldada no deberia seguir pidiendo que se confirme una
    // cuota: se marca para que la interfaz la deje de ofrecer.
    const pagadoSiempre = (db.movimientos || [])
      .filter((m) => m.tipo === "deuda" && m.categoria === cat && esConfirmado(m))
      .reduce((a, m) => a + Number(m.monto || 0), 0);
    const saldoPendiente = (db.deudasIniciales?.[cat] || 0) - pagadoSiempre;

    return {
      categoria: cat,
      presupuesto: presupuestoDeudas[cat],
      pagadoEnOtraQuincena: enHermana,
      saldada: saldoPendiente <= 0,
      ...propios,
    };
  });

  const categoriasInversion = ["nu", "xtb", "binance", ...Object.keys(categoriasPersonalizadas.inversion || {})];
  const inversiones = categoriasInversion.map((cat) => ({
    categoria: cat,
    presupuesto: 0,
    ...totales(movsCasa, "inversion", cat),
  }));

  // Ingresos: como cualquier otra categoria, arranca en $0 hasta que se
  // confirme (o se agregue como plan) un movimiento real. El salarioDefault
  // solo se usa como sugerencia precargada en la fila de confirmacion rapida.
  const salario = totales(movsCasa, "ingreso", "salario");
  const prima = totales(movsCasa, "ingreso", "prima");
  const extra = totales(movsCasa, "ingreso", "extra");

  const ingresosPersonalizados = Object.keys(categoriasPersonalizadas.ingreso || {}).map((cat) => ({
    categoria: cat,
    presupuesto: 0,
    ...totales(movsCasa, "ingreso", cat),
  }));

  const ingresos = [
    { categoria: "salario", presupuesto: salarioDefault, ...salario },
    { categoria: "prima", presupuesto: 0, ...prima },
    { categoria: "extra", presupuesto: 0, ...extra },
    ...ingresosPersonalizados,
  ];

  const sumar = (lista, campo) => lista.reduce((a, x) => a + x[campo], 0);

  const ingresosConfirmado = sumar(ingresos, "confirmado");
  const ingresosTotal = sumar(ingresos, "total");

  const gastosConfirmado = sumar(gastos, "confirmado");
  const gastosTotal = sumar(gastos, "total");
  const deudasConfirmado = sumar(deudas, "confirmado");
  const deudasTotal = sumar(deudas, "total");
  const inversionesConfirmado = sumar(inversiones, "confirmado");
  const inversionesTotal = sumar(inversiones, "total");

  const egresoConfirmado = gastosConfirmado + deudasConfirmado + inversionesConfirmado;
  const egresoTotal = gastosTotal + deudasTotal + inversionesTotal;

  const balanceConfirmado = ingresosConfirmado - egresoConfirmado;
  const balanceProyectado = ingresosTotal - egresoTotal;

  // El sobrante que se reparte a NU/abono-extra NO puede calcularse solo con
  // lo confirmado hasta ahora: eso ignora gastos y cuotas que sabemos que
  // faltan por pagar esta quincena (presupuesto) y sobreestima lo disponible.
  // Se reserva primero lo esperado (lo mayor entre el presupuesto y lo ya
  // gastado, por si algo se paso de presupuesto) y solo el remanente real
  // se considera sobrante seguro para mover a NU.
  const egresoEsperado = (lista) => lista.reduce((a, x) => a + Math.max(x.presupuesto, x.total), 0);
  const egresoEsperadoTotal = egresoEsperado(gastos) + egresoEsperado(deudas) + inversionesTotal;
  const sobranteSeguro = ingresosConfirmado - egresoEsperadoTotal;

  const sobrante = sobranteSeguro > 0 ? sobranteSeguro : 0;
  const aNU = Math.round(sobrante * 0.5);
  const aDeuda = sobrante - aNU;

  const confirmada = (db.estadoQuincenas || {})[id] === "confirmada";

  // El plan "ideal" de la hoja de presupuesto: cuanto deberia ir a cada
  // rubro en esta quincena. Sirve para comparar contra lo que de verdad
  // paso, que es donde se ve si el mes se esta saliendo de cauce.
  const ideal = (db.presupuestoIdeal || {})[key] || null;

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
    inversiones,
    inversionesConfirmado,
    inversionesTotal,
    egresoConfirmado,
    egresoTotal,
    balanceConfirmado,
    balanceProyectado,
    sobrante,
    aNU,
    aDeuda,
    ideal,
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

// Cual era la cuota recomendada de una deuda durante un mes en particular.
// Si la cuota cambio despues (una compra nueva, un ajuste manual), un mes
// pasado no se le puede juzgar con el valor de hoy -- se usa el que
// realmente aplicaba entonces (ver historialCuotas en routes/deudas.js).
function cuotaVigenteEnMes(db, categoria, prefijoMes) {
  const historial = (db.historialCuotas || {})[categoria];
  if (!historial || historial.length === 0) return db.cuotasRecomendadas[categoria];
  let valor = db.cuotasRecomendadas[categoria];
  for (const entrada of historial) {
    if (entrada.desde <= prefijoMes) valor = entrada.valor;
  }
  return valor;
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
  const prefijoActual = `${anio}-${String(mes).padStart(2, "0")}`;

  const alertas = [];
  for (const categoria of Object.keys(db.cuotasRecomendadas || {})) {
    // Si ya se pago por completo, no hay cuota que reclamar -- sin este
    // chequeo, una deuda saldada hace meses sigue apareciendo "atrasada"
    // para siempre (se detecto probando el historial con un año de datos).
    const saldoInicial = (db.deudasIniciales || {})[categoria] || 0;
    const pagadoTotal = (db.movimientos || [])
      .filter((m) => m.tipo === "deuda" && m.categoria === categoria && esConfirmado(m))
      .reduce((a, m) => a + Number(m.monto || 0), 0);
    if (saldoInicial - pagadoTotal <= 0) continue;

    // Si la deuda se registro este mismo mes (recien agregada al sistema),
    // no tiene sentido reclamarle una cuota de un mes anterior en el que
    // todavia no se le hacia seguimiento como deuda.
    const fechaCreacion = (db.deudasFechaCreacion || {})[categoria];
    if (fechaCreacion && fechaCreacion >= prefijoActual) continue;

    const prefijoMesAnt = `${anioAnt}-${String(mesAnt).padStart(2, "0")}`;
    const cuota = cuotaVigenteEnMes(db, categoria, prefijoMesAnt);
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

// Evolucion de lo que realmente se ha aportado al NU, quincena a quincena.
// Antes esto acumulaba el sobrante *sugerido* (aNU), asi que el saldo subia
// solo aunque el dinero nunca se hubiera movido. Ahora cuenta unicamente
// los aportes confirmados de verdad (tipo inversion, categoria nu).
export function calcularEvolucionNU(db) {
  const ids = listaQuincenasConDatos(db);
  let acumulado = 0;
  return ids.map((id) => {
    const aporte = (db.movimientos || [])
      .filter(
        (m) =>
          m.quincenaId === id && m.tipo === "inversion" && m.categoria === "nu" && esConfirmado(m)
      )
      .reduce((a, m) => a + Number(m.monto || 0), 0);
    acumulado += aporte;
    return { quincenaId: id, aNU: aporte, acumulado };
  });
}

// Acumulado del NU agrupado por mes calendario, para ver la tendencia sin
// el ruido de dos puntos por mes.
export function calcularEvolucionNUMensual(db) {
  const porQuincena = calcularEvolucionNU(db);
  const meses = [];
  const indice = {};
  for (const p of porQuincena) {
    const mes = p.quincenaId.slice(0, 7);
    if (!(mes in indice)) {
      indice[mes] = meses.length;
      meses.push({ mes, aporte: 0, acumulado: 0 });
    }
    const fila = meses[indice[mes]];
    fila.aporte += p.aNU;
    fila.acumulado = p.acumulado;
  }
  return meses;
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
    inversiones: totalPorCategoria("inversion"),
  };
}
