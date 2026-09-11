// Todo lo que responde a la pregunta "¿me alcanza?": cuánto se puede
// ahorrar de verdad, cuánto se puede usar de tarjeta, qué cuota va en cuál
// quincena, y en qué meses hay riesgo de no cerrar.
//
// Se separó del resto porque son cuentas de planeación, no de registro: no
// miran solo lo que pasó, sino lo que va a pasar si nada cambia.

import {
  quincenaId,
  partesQuincena,
  quincenaAnterior,
  quincenaSiguiente,
  calcularEstadoQuincena,
  ANCLA_ARRASTRE,
} from "./calculos.js";
import { saldosActuales } from "./routes/deudas.js";

const CUPO_TARJETAS_POR_DEFECTO = 500000;

// Cupo REAL que da el banco por cada tarjeta -- no confundir con
// cupoTarjetasMensual de arriba, que es un tope de disciplina que Rafael se
// pone a si mismo sobre cuanto comprar al mes. Este es el limite de credito
// de verdad: si el saldo de la tarjeta se le acerca o se lo pasa, la tarjeta
// deja de servir sin importar si viene o no dentro del tope de disciplina.
const CUPOS_CREDITO_POR_DEFECTO = { rappi: 10000000, falabella: 16000000 };

function suma(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + Number(b || 0), 0);
}

function prefijoMes(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function mesSiguiente(prefijo, n = 1) {
  const [anio, mes] = prefijo.split("-").map(Number);
  const d = new Date(anio, mes - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Lo que de verdad quedó cada mes. No cuenta lo que registra Jerardith:
// eso es el detalle de plata que ya salió cuando Rafael se la entregó.
export function netoRealPorMes(db) {
  const meses = {};
  for (const m of db.movimientos || []) {
    if (m.confirmado === false) continue;
    if (m.registradoPor === "jerardith") continue;
    const k = (m.quincenaId || "").slice(0, 7);
    if (!k) continue;
    meses[k] = meses[k] || { mes: k, ingreso: 0, salida: 0 };
    if (m.tipo === "ingreso") meses[k].ingreso += Number(m.monto || 0);
    else if (m.tipo === "gasto" || m.tipo === "deuda" || m.tipo === "inversion") {
      meses[k].salida += Number(m.monto || 0);
    }
    // Las compras con tarjeta no son salida de plata: crean deuda, no
    // mueven la caja del mes. Por eso no suman aquí.
  }
  return Object.values(meses)
    .map((m) => ({ ...m, neto: m.ingreso - m.salida }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1));
}

// La meta no se fija a dedo: sale de lo que de verdad ha sobrado en los
// ultimos meses cerrados. Asi es alcanzable, y si mejora, sube sola.
export function metaSugerida(db) {
  const mesActual = prefijoMes();
  const cerrados = netoRealPorMes(db).filter((m) => m.mes < mesActual && m.ingreso > 0);
  const ultimos = cerrados.slice(-3);
  if (ultimos.length === 0) {
    return { valor: 0, porcentaje: 0, mesesMirados: 0, base: [] };
  }
  const promedioNeto = ultimos.reduce((a, m) => a + m.neto, 0) / ultimos.length;
  const promedioIngreso = ultimos.reduce((a, m) => a + m.ingreso, 0) / ultimos.length;

  // Nunca se propone una meta negativa: si los ultimos meses cerraron en
  // rojo, la meta es simplemente no cerrar en rojo.
  const valor = Math.max(0, Math.round(promedioNeto));
  return {
    valor,
    porcentaje: promedioIngreso > 0 ? Number(((valor / promedioIngreso) * 100).toFixed(1)) : 0,
    mesesMirados: ultimos.length,
    base: ultimos.map((m) => ({ mes: m.mes, neto: Math.round(m.neto) })),
  };
}

// Cuanto se ha comprado con tarjeta este mes, contra el tope acordado.
export function estadoTarjetas(db, mes = prefijoMes()) {
  const cupo = Number(db.config?.cupoTarjetasMensual ?? CUPO_TARJETAS_POR_DEFECTO);
  const compras = (db.movimientos || []).filter(
    (m) => m.tipo === "compraTarjeta" && (m.fecha || "").startsWith(mes)
  );
  const usado = compras.reduce((a, m) => a + Number(m.monto || 0), 0);
  return {
    cupo,
    usado,
    disponible: cupo - usado,
    excedido: usado > cupo,
    compras: compras.length,
  };
}

// Que tan cerca esta cada tarjeta de su cupo real de credito (el que da el
// banco), no del tope de disciplina. Se calcula sobre el saldo actual
// (rotativo: sube con compras, baja con abonos), igual que en /api/deudas.
export function estadoCupoCredito(db) {
  const cupos = { ...CUPOS_CREDITO_POR_DEFECTO, ...(db.config?.cupoCreditoTarjetas || {}) };
  const saldos = saldosActuales(db);
  return Object.keys(cupos).map((categoria) => {
    const saldo = Math.max(0, saldos[categoria] || 0);
    const cupo = Number(cupos[categoria]);
    return {
      categoria,
      saldo,
      cupo,
      disponible: cupo - saldo,
      excedido: saldo > cupo,
    };
  });
}

// Reparte las cuotas entre las dos quincenas buscando que las dos queden
// con un margen parecido. Se ordenan de mayor a menor y cada una cae en la
// quincena que en ese momento tenga mas espacio: es lo que uno haria a
// mano, pero sin equivocarse.
export function repartoQuincenas(db) {
  const ingresos = { q1: Number(db.config.ingresoQ1 || 0), q2: Number(db.config.ingresoQ2 || 0) };
  const fijos = { q1: suma(db.gastosFijos?.q1), q2: suma(db.gastosFijos?.q2) };

  // Solo las deudas que todavia se deben algo.
  const saldos = { ...db.deudasIniciales };
  for (const m of db.movimientos || []) {
    if (saldos[m.categoria] === undefined || m.confirmado === false) continue;
    if (m.tipo === "deuda") saldos[m.categoria] -= Number(m.monto || 0);
    else if (m.tipo === "compraTarjeta") saldos[m.categoria] += Number(m.monto || 0);
  }

  const cuotas = Object.entries(db.cuotasRecomendadas || {})
    .filter(([cat, valor]) => Number(valor) > 0 && (saldos[cat] || 0) > 0)
    .map(([categoria, valor]) => ({ categoria, valor: Number(valor) }))
    .sort((a, b) => b.valor - a.valor);

  const asignadas = { q1: [], q2: [] };
  const margen = { q1: ingresos.q1 - fijos.q1, q2: ingresos.q2 - fijos.q2 };

  // Lo que Rafael haya movido a mano manda sobre el reparto automatico: el
  // solo sabe cuando le cobran cada cuota. Lo que no haya tocado se sigue
  // repartiendo buscando que las dos quincenas queden parejas.
  const aMano = db.repartoCuotas || {};
  const fijadas = cuotas.filter((c) => aMano[c.categoria]);
  const libres = cuotas.filter((c) => !aMano[c.categoria]);

  for (const cuota of fijadas) {
    const donde = Number(aMano[cuota.categoria]) === 1 ? "q1" : "q2";
    asignadas[donde].push({ ...cuota, aMano: true });
    margen[donde] -= cuota.valor;
  }

  for (const cuota of libres) {
    const donde = margen.q1 >= margen.q2 ? "q1" : "q2";
    asignadas[donde].push({ ...cuota, aMano: false });
    margen[donde] -= cuota.valor;
  }

  const armar = (q) => ({
    ingreso: ingresos[q],
    fijos: fijos[q],
    cuotas: asignadas[q].sort((a, b) => b.valor - a.valor),
    totalCuotas: asignadas[q].reduce((a, c) => a + c.valor, 0),
    libre: margen[q],
    alcanza: margen[q] >= 0,
  });

  return {
    q1: armar("q1"),
    q2: armar("q2"),
    libreMes: margen.q1 + margen.q2,
    // Que tan disparejas quedaron. Sirve para avisar cuando un cambio a mano
    // deja una quincena muy apretada frente a la otra.
    desbalance: Math.abs(margen.q1 - margen.q2),
  };
}

// Semaforo mes a mes hacia adelante: con los ingresos, los gastos fijos y
// las cuotas de hoy, ¿que meses no cierran? Un mes en rojo aqui no es un
// error de la app: es un aviso de que algo hay que cambiar antes de que
// llegue.
export function semaforoMeses(db, cuantos = 12) {
  const reparto = repartoQuincenas(db);
  const ingresoMes = reparto.q1.ingreso + reparto.q2.ingreso;
  const fijosMes = reparto.q1.fijos + reparto.q2.fijos;
  const cuotasMes = reparto.q1.totalCuotas + reparto.q2.totalCuotas;

  const reales = Object.fromEntries(netoRealPorMes(db).map((m) => [m.mes, m]));
  const mesActual = prefijoMes();
  const meses = [];

  for (let i = 0; i < cuantos; i++) {
    const mes = mesSiguiente(mesActual, i);
    const real = reales[mes];

    // La prima solo llega en junio y en diciembre.
    const numeroMes = Number(mes.split("-")[1]);
    const prima = numeroMes === 6 || numeroMes === 12 ? Number(db.config.prima || 0) : 0;

    const proyectado = ingresoMes + prima - fijosMes - cuotasMes;
    const yaPasado = real && real.ingreso > 0 && mes < mesActual;

    meses.push({
      mes,
      prima,
      ingreso: ingresoMes + prima,
      fijos: fijosMes,
      cuotas: cuotasMes,
      proyectado: Math.round(proyectado),
      real: real ? Math.round(real.neto) : null,
      // "pasado" = ya cerró y quedó en rojo. "riesgo" = todavía no llega
      // pero con las cuentas de hoy no cuadra.
      estado: yaPasado
        ? real.neto < 0
          ? "pasado"
          : "bien"
        : proyectado < 0
        ? "riesgo"
        : "bien",
    });
  }

  return meses;
}

// Como va la quincena que se esta viviendo: lo que entro contra lo que ya
// salio y lo que todavia falta por pagar de lo planeado.
export function estadoQuincenaActual(db) {
  const id = quincenaId();
  const { q: quincena } = partesQuincena(id);
  const q = quincena === 1 ? "q1" : "q2";
  const reparto = repartoQuincenas(db);
  const plan = reparto[q];

  const movs = (db.movimientos || []).filter(
    (m) => m.quincenaId === id && m.registradoPor !== "jerardith" && m.confirmado !== false
  );
  const entro = movs.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto), 0);
  const salio = movs
    .filter((m) => m.tipo === "gasto" || m.tipo === "deuda" || m.tipo === "inversion")
    .reduce((a, m) => a + Number(m.monto), 0);

  const comprometido = plan.fijos + plan.totalCuotas;
  const faltaPorPagar = Math.max(0, comprometido - salio);
  const disponibleReal = entro - salio;

  return {
    quincenaId: id,
    quincena,
    entro,
    salio,
    comprometido,
    faltaPorPagar,
    disponibleReal,
    // Ya se paso: gasto mas de lo que entro.
    excedido: disponibleReal < 0,
    // Riesgo: todavia no se pasa, pero lo que falta por pagar no cabe en
    // lo que queda.
    enRiesgo: disponibleReal >= 0 && faltaPorPagar > disponibleReal,
  };
}

// Trayectoria de balance encadenada a lo largo de un semestre: unas
// quincenas atras (reales, ya con su arrastre) mas la actual, y varias
// adelante proyectadas con el plan de hoy repetido "si nada cambia" --
// pero SIN reiniciar en cada quincena. Nace de que Rafael noto que ver
// agosto "bien" y septiembre "critico" como dos cuadros sueltos no tiene
// sentido: lo que sobra en una quincena es justo lo que sostiene (o no) la
// siguiente, asi que hay que verlo como una sola linea, no como meses
// aislados. Ver semaforoMeses arriba para el semaforo por mes calendario
// (que si evalua cada mes contra si mismo); esto es el complemento
// encadenado que faltaba.
export function trayectoriaBalance(db, atras = 3, adelante = 9) {
  const idHoy = quincenaId();
  const reparto = repartoQuincenas(db);

  // No se retrocede antes del ancla: de ahi para atras es historia
  // importada del Excel base, que Rafael confirmo incompleta (gastos que
  // nunca registro ahi, antes de pasarse a esta app) -- encadenarla como si
  // fuera un balance real inflaba quincenas como agosto Q1 con plata que
  // en la practica nunca tuvo en la mano. Mostrar esos puntos como "real"
  // en la trayectoria viciaba la lectura de como esta hoy.
  const idsAtras = [];
  let cursor = idHoy;
  for (let i = 0; i < atras; i++) {
    const anterior = quincenaAnterior(cursor);
    if (anterior < ANCLA_ARRASTRE) break;
    cursor = anterior;
    idsAtras.unshift(cursor);
  }

  const puntos = idsAtras.map((id) => {
    const estado = calcularEstadoQuincena(db, id);
    return {
      quincenaId: id,
      balance: Math.round(estado.balanceConfirmado),
      tipo: "real",
      enRiesgo: estado.balanceConfirmado < 0,
    };
  });

  const estadoHoy = calcularEstadoQuincena(db, idHoy);
  puntos.push({
    quincenaId: idHoy,
    balance: Math.round(estadoHoy.balanceConfirmado),
    tipo: "actual",
    enRiesgo: estadoHoy.balanceConfirmado < 0 || estadoHoy.riesgoGasto,
  });

  // No hay movimientos todavia en el futuro: se proyecta con el mismo plan
  // de fijos y cuotas de hoy (repartoQuincenas), encadenando el resultado
  // de una quincena como punto de partida real de la siguiente.
  let saldo = estadoHoy.balanceProyectado;
  let cursorAdelante = idHoy;
  for (let i = 0; i < adelante; i++) {
    cursorAdelante = quincenaSiguiente(cursorAdelante);
    const { q, mes } = partesQuincena(cursorAdelante);
    const plan = reparto[q === 1 ? "q1" : "q2"];
    const prima = [6, 12].includes(mes) ? Number(db.config.prima || 0) : 0;
    saldo = saldo + plan.ingreso + prima - plan.fijos - plan.totalCuotas;
    puntos.push({
      quincenaId: cursorAdelante,
      balance: Math.round(saldo),
      tipo: "proyectado",
      enRiesgo: saldo < 0,
    });
  }

  const primerRiesgo = puntos.find((p) => p.tipo !== "real" && p.enRiesgo);

  return {
    puntos,
    primerRiesgoId: primerRiesgo ? primerRiesgo.quincenaId : null,
  };
}

export function calcularAsesor(db) {
  return {
    meta: metaSugerida(db),
    tarjetas: estadoTarjetas(db),
    cupoCredito: estadoCupoCredito(db),
    reparto: repartoQuincenas(db),
    meses: semaforoMeses(db),
    quincenaActual: estadoQuincenaActual(db),
    trayectoria: trayectoriaBalance(db),
    gastosFijos: db.gastosFijos || { q1: {}, q2: {} },
  };
}
