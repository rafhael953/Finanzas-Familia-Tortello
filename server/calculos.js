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

export function quincenaAnterior(id) {
  const { anio, mes, q } = partesQuincena(id);
  if (q === 2) return idQuincena(anio, mes, 1);
  return mes === 1 ? idQuincena(anio - 1, 12, 2) : idQuincena(anio, mes - 1, 2);
}

export function quincenaSiguiente(id) {
  const { anio, mes, q } = partesQuincena(id);
  if (q === 1) return idQuincena(anio, mes, 2);
  return mes === 12 ? idQuincena(anio + 1, 1, 1) : idQuincena(anio, mes + 1, 1);
}

export const NOMBRES_MES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function esConfirmado(m) {
  return m.confirmado !== false;
}

function sumaValores(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + Number(b || 0), 0);
}

// A que quincena le toca la cuota de cada deuda. Es la misma logica que
// arma el reparto en server/asesor.js (repartoQuincenas) -- se repite aca
// porque calcularEstadoQuincena tambien la necesita: sin esto, la pantalla
// de Quincena ofrecia confirmar las cinco deudas completas en las dos
// quincenas del mes, en vez de solo la mitad que a cada una le toca, e
// inflaba el balance proyectado con cuotas que en realidad salen del
// sueldo de la otra quincena (paso el 2026-09-07 con Rappi y NU mama
// contando de mas en la Q1). Si cambia el algoritmo de reparto, hay que
// cambiarlo en los dos lados.
export function asignacionDeudas(db) {
  const ingresos = { q1: Number(db.config.ingresoQ1 || 0), q2: Number(db.config.ingresoQ2 || 0) };
  const fijos = { q1: sumaValores(db.gastosFijos?.q1), q2: sumaValores(db.gastosFijos?.q2) };

  const saldos = saldosDeuda(db);

  const cuotas = Object.entries(db.cuotasRecomendadas || {})
    .filter(([cat, valor]) => Number(valor) > 0 && (saldos[cat] || 0) > 0)
    .map(([categoria, valor]) => ({ categoria, valor: Number(valor) }))
    .sort((a, b) => b.valor - a.valor);

  const margen = { q1: ingresos.q1 - fijos.q1, q2: ingresos.q2 - fijos.q2 };
  const asignacion = {};

  const aMano = db.repartoCuotas || {};
  const fijadas = cuotas.filter((c) => aMano[c.categoria]);
  const libres = cuotas.filter((c) => !aMano[c.categoria]);

  for (const cuota of fijadas) {
    const donde = Number(aMano[cuota.categoria]) === 1 ? "q1" : "q2";
    asignacion[cuota.categoria] = donde;
    margen[donde] -= cuota.valor;
  }
  for (const cuota of libres) {
    const donde = margen.q1 >= margen.q2 ? "q1" : "q2";
    asignacion[cuota.categoria] = donde;
    margen[donde] -= cuota.valor;
  }

  return asignacion;
}

function totales(movs, tipo, categoria) {
  const deCategoria = movs.filter((m) => m.tipo === tipo && m.categoria === categoria);
  const confirmado = deCategoria.filter(esConfirmado).reduce((a, m) => a + Number(m.monto || 0), 0);
  const pendiente = deCategoria.filter((m) => !esConfirmado(m)).reduce((a, m) => a + Number(m.monto || 0), 0);
  return { confirmado, pendiente, total: confirmado + pendiente };
}

// Antes de esta quincena el arrastre en vivo no cuenta: enero-julio de 2026
// se importo del Excel del presupuesto (ver commit "Importar la historia
// real de enero a agosto"), y ese historial refleja que lo que sobraba de
// una quincena se terminaba gastando en la siguiente -- no habia disciplina
// de ahorro todavia, asi que encadenar el arrastre hasta ahi solo arrastra
// numeros que ya se sabe que no se conservaron. Ademas nunca se registro
// cuanta plata en mano habia realmente al inicio de esa historia (diciembre
// 2025), asi que cualquier arrastre desde antes de aqui seria un numero
// inventado, no uno real.
//
// La Q2 de agosto es el ancla porque es la que Rafael ya habia registrado a
// mano cuando se hizo esa importacion, y la propia importacion la trato
// como el punto seguro (no la toco). De aqui en adelante el arrastre es en
// vivo; antes de aqui, enero-julio sigue existiendo para graficas,
// promedios y el semaforo de meses, pero como historia, no como saldo que
// se siga acumulando.
export const ANCLA_ARRASTRE = "2026-08-Q2";

export function quincenaAntes(a, b) {
  const pa = partesQuincena(a);
  const pb = partesQuincena(b);
  if (pa.anio !== pb.anio) return pa.anio < pb.anio;
  if (pa.mes !== pb.mes) return pa.mes < pb.mes;
  return pa.q < pb.q;
}

// Saldo de hoy de cada deuda: el punto de partida (deudasIniciales) menos
// los pagos y mas las compras, pero solo desde el ancla del arrastre en
// adelante -- mismo criterio que el arrastre de balance. deudasIniciales
// se trata como "lo que se debia ese dia", no "lo que se debia al
// principio de los tiempos": si tambien se restaran los pagos de antes
// del ancla, un pago ya reflejado en ese numero se restaria de nuevo (paso
// el 2026-09-13 al reconstruir la contabilidad desde 2026-08-Q2: Auteco y
// Numama quedaron con saldo de menos porque sus pagos viejos, que seguian
// en el historial, se contaban otra vez).
export function saldosDeuda(db) {
  const saldos = { ...db.deudasIniciales };
  for (const m of db.movimientos || []) {
    if (saldos[m.categoria] === undefined || m.confirmado === false) continue;
    if (quincenaAntes(m.quincenaId, ANCLA_ARRASTRE)) continue;
    if (m.tipo === "deuda") saldos[m.categoria] -= Number(m.monto || 0);
    else if (m.tipo === "compraTarjeta") saldos[m.categoria] += Number(m.monto || 0);
  }
  return saldos;
}

// Cuanto se trae de la quincena anterior. Se arrastra completo, en los dos
// sentidos: ni el rojo ni el sobrante desaparecen solos. Un hueco hay que
// taparlo con lo que entra despues, y un sobrante sigue siendo plata real
// disponible HASTA que de verdad se registre un movimiento moviendola (ej.
// un aporte confirmado a NU) -- no se asume por defecto que ya se fue al
// fondo de emergencia, porque el ahorro solo cuenta cuando se confirma (ver
// calcularEvolucionNU, que ya solo mira aportes confirmados). Asumirlo por
// defecto haria que la plata se "perdiera" de la contabilidad sin que
// realmente se hubiera movido.
//
// Sin este arrastre cada quincena se calculaba aislada y una quincena podia
// mostrarse "bien" aunque viniera arrastrando un hueco de la anterior sin
// taparse -- eso paso el 2026-09-10 con la Q2 de septiembre, que seguia
// mostrando el mismo numero en rojo.
export function calcularSaldoInicial(db, id) {
  // Antes de la ancla no hay arrastre en vivo (ver el comentario de
  // ANCLA_ARRASTRE arriba) -- cortar aqui con "<=" y no solo "===" importa:
  // sin el "<=", pedir el saldo de un mes de ANTES del ancla (ej. navegar
  // al historial de enero-julio 2026) nunca llega a igualar el ancla
  // exactamente yendo hacia atras, y la recursion de abajo se vuelve
  // infinita hasta tumbar el servidor (RangeError: Maximum call stack
  // size exceeded, se detecto escribiendo las pruebas el 2026-09-16).
  if (id === ANCLA_ARRASTRE || quincenaAntes(id, ANCLA_ARRASTRE)) return 0;

  const idAnterior = quincenaAnterior(id);

  // Antes se cortaba aqui si la quincena INMEDIATAMENTE anterior no tenia
  // movimientos todavia (ej. al navegar dos o mas quincenas hacia el
  // futuro, saltando una que aun no empieza), devolviendo 0 en vez de
  // seguir la cadena un paso mas atras -- eso hacia que una quincena futura
  // se viera sin arrastre, contradiciendo el balance del mes y la
  // trayectoria de arriba, que si encadenan sin ese corte (paso el
  // 2026-09-16 al mirar octubre Q1 desde hoy, 16 de septiembre: octubre Q1
  // caia dos pasos adelante y su saldo se mostraba en $0). Ahora siempre se
  // recorre hacia atras -- termina si o si en ANCLA_ARRASTRE, que es el
  // unico punto real de partida.
  const estadoAnterior = calcularEstadoQuincena(db, idAnterior);
  return estadoAnterior.balanceConfirmado;
}

// Estado en vivo de una quincena, con separacion confirmado (real, ya paso)
// vs pendiente (planeado/estimado, aun no confirmado item a item).
export function calcularEstadoQuincena(db, id, fechaRef = new Date()) {
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
  // otra quincena del mismo MES CALENDARIO REAL, no hay que volver a
  // sugerirla aqui. Ojo: la hermana real NO es "el otro Q del mismo numero
  // de mes del id" (eso junta el 16 de este mes con el 1-15 del SIGUIENTE,
  // el mismo error ya corregido en otros lados -- ver mesCalendarioDeQuincena).
  // Sin este fix, una cuota pagada en la quincena de hoy pero reservada sin
  // pagar en la quincena real-hermana (ya pasada) se contaba DOBLE en el
  // balance del mes: la reserva vieja (nunca se cancelaba) mas el pago real
  // (paso el 2026-09-18 con Rappi: $700.000 reservados en 1-15 de sept +
  // $1.300.000 pagados de verdad el 16-30, sin que el sistema los cruzara).
  const idHermana = q === 1 ? quincenaAnterior(id) : quincenaSiguiente(id);
  const movsHermana = (db.movimientos || []).filter((m) => m.quincenaId === idHermana);

  // Cada deuda tiene una sola cuota al mes: solo cuenta como presupuesto de
  // ESTA quincena si el reparto se la asigno a ella. Si no, el presupuesto
  // es 0 aca aunque la cuota exista, porque le toca a la otra quincena.
  const asignacion = asignacionDeudas(db);

  // Una deuda ya saldada no deberia seguir pidiendo que se confirme una
  // cuota: se marca para que la interfaz la deje de ofrecer.
  const saldosDeHoy = saldosDeuda(db);

  // Si esta es la quincena que se esta viviendo hoy, lo que quedo atrasado
  // de un mes anterior (calcularAlertasDeudas) se suma al presupuesto
  // esperado de esa deuda, sin importar a cual quincena le toque su cuota
  // normal -- la alerta ya avisa que hay que ponerse al dia "antes del 15",
  // dentro de este mismo ciclo. Sin esto, sobranteSeguro/riesgoGasto y la
  // sugerencia de aNU/aDeuda ignoraban el atraso por completo y podian
  // sugerir mover a ahorro la misma plata que hacia falta para pagarlo.
  const esQuincenaViva = id === quincenaId(fechaRef);
  const atrasos = esQuincenaViva
    ? Object.fromEntries(calcularAlertasDeudas(db, fechaRef).map((a) => [a.categoria, a.faltante]))
    : {};

  const deudas = Object.keys(presupuestoDeudas).map((cat) => {
    const propios = totales(movsCasa, "deuda", cat);
    const enHermana = totales(movsHermana, "deuda", cat).confirmado;
    const atraso = atrasos[cat] || 0;

    // Si la cuota asignada a esta quincena ya se pago (total o
    // parcialmente) en la hermana real del mes, lo que falta reservar aqui
    // baja en esa misma medida -- si no, egresoEsperado la contaba dos
    // veces: la reserva que nunca se cancelaba en la quincena vieja, mas el
    // pago real en la que de verdad se hizo.
    const presupuestoAsignado = asignacion[cat] === key ? presupuestoDeudas[cat] : 0;
    const presupuesto = Math.max(0, presupuestoAsignado - enHermana) + atraso;

    return {
      categoria: cat,
      presupuesto,
      atraso,
      pagadoEnOtraQuincena: enHermana,
      saldada: (saldosDeHoy[cat] ?? 0) <= 0,
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

  const saldoInicial = calcularSaldoInicial(db, id);
  const balanceConfirmado = saldoInicial + ingresosConfirmado - egresoConfirmado;
  const balanceProyectado = saldoInicial + ingresosTotal - egresoTotal;

  // El sobrante que se reparte a NU/abono-extra NO puede calcularse solo con
  // lo confirmado hasta ahora: eso ignora gastos y cuotas que sabemos que
  // faltan por pagar esta quincena (presupuesto) y sobreestima lo disponible.
  // Se reserva primero lo esperado (lo mayor entre el presupuesto y lo ya
  // gastado, por si algo se paso de presupuesto) y solo el remanente real
  // se considera sobrante seguro para mover a NU.
  const egresoEsperado = (lista) => lista.reduce((a, x) => a + Math.max(x.presupuesto, x.total), 0);
  const egresoEsperadoTotal = egresoEsperado(gastos) + egresoEsperado(deudas) + inversionesTotal;

  // Si esta NO es la quincena que se esta viviendo hoy (se esta
  // previsualizando una futura), medir "lo seguro" solo contra lo ya
  // confirmado no tiene sentido: en una quincena que ni siquiera ha
  // empezado, ingresosConfirmado SIEMPRE es 0 porque nada de ahi ha
  // pasado todavia -- este aviso saldria en rojo por estructura sin
  // importar que tan sano este el plan, contradiciendo la trayectoria y
  // el balance del mes de arriba (que si asumen el sueldo esperado cuando
  // el dia no ha llegado). Solo en la quincena viva "lo confirmado" es la
  // pregunta correcta: ahi si importa no gastar mas alla de lo que de
  // verdad hay en la mano.
  const ingresoParaSobranteSeguro = esQuincenaViva
    ? ingresosConfirmado
    : Math.max(ingresosConfirmado, salarioDefault);
  const sobranteSeguro = saldoInicial + ingresoParaSobranteSeguro - egresoEsperadoTotal;

  const sobranteBruto = sobranteSeguro > 0 ? sobranteSeguro : 0;

  // Antes de repartir el sobrante a NU/abono-extra, hay que revisar si la
  // SIGUIENTE quincena (misma logica de reparto, pero el otro bloque)
  // alcanza por si sola con su propio sueldo. Si no alcanza, ese hueco hay
  // que taparlo con lo que sobra aqui -- si no, "sugerir" mover plata a NU
  // ahora mismo deja a la siguiente quincena sin con que cubrir lo suyo, y
  // el arrastre real (calcularSaldoInicial) terminaria en rojo apenas se
  // confirmara el movimiento sugerido.
  const keySiguiente = key === "q1" ? "q2" : "q1";
  const fijosSiguiente = sumaValores(db.gastosFijos[keySiguiente]);
  const cuotasSiguiente = Object.entries(db.cuotasRecomendadas || {})
    .filter(([cat]) => asignacion[cat] === keySiguiente)
    .reduce((a, [, valor]) => a + Number(valor || 0), 0);
  const comprometidoSiguiente = fijosSiguiente + cuotasSiguiente;
  const ingresoSiguienteDefault = Number(
    (keySiguiente === "q1" ? db.config.ingresoQ1 : db.config.ingresoQ2) || 0
  );
  const margenSiguiente = ingresoSiguienteDefault - comprometidoSiguiente;
  const reservaSiguiente = margenSiguiente < 0 ? Math.round(-margenSiguiente) : 0;

  const sobrante = Math.max(0, sobranteBruto - reservaSiguiente);
  const aNU = Math.round(sobrante * 0.5);
  const aDeuda = sobrante - aNU;

  const atrasoTotal = sumaValores(atrasos);

  // Advertencia activa de "no gastes mas": si sobranteSeguro ya esta en
  // negativo, ni siquiera reservando solo lo comprometido (presupuesto y lo
  // que ya se registro) alcanza con lo que de verdad ha entrado. No es una
  // proyeccion a futuro (eso es balanceProyectado) -- es que ahora mismo
  // cualquier gasto extra pone en riesgo lo fijo del mes.
  const riesgoGasto = sobranteSeguro < 0;

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
    saldoInicial,
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
    sobranteBruto,
    reservaSiguiente,
    sobranteSeguro,
    riesgoGasto,
    aNU,
    aDeuda,
    atrasoTotal,
    ideal,
    movimientos: [...movs].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
  };
}

// Cuanto se pago (confirmado) de una deuda en un mes calendario completo
// (sumando sus dos quincenas).
// El mes calendario real de "anio-mes" se vive en dos quincenas: los dias
// 1-15 (que llevan el id del mes ANTERIOR, Q2 -- ver quincenaId) y los dias
// 16-fin (Q1 de este mismo id de mes). Sumar Q1+Q2 del MISMO numero de mes
// del id (como se hacia antes) junta el 16 de este mes con el 1-15 del
// SIGUIENTE -- el mismo error que ya se habia corregido en
// calcularEstadoMensual (ver mesCalendarioDeQuincena). Sin este fix, un pago
// hecho el 15 (ej. Rappi/Falabella, que pagan ese dia) se contaba para el
// mes anterior en vez del que en verdad le corresponde, y el 1-15 real del
// mes nunca se miraba.
function quincenasDelMesReal(anio, mes) {
  let anioPrev = anio;
  let mesPrev = mes - 1;
  if (mesPrev === 0) {
    mesPrev = 12;
    anioPrev -= 1;
  }
  return [idQuincena(anioPrev, mesPrev, 2), idQuincena(anio, mes, 1)]; // dias 1-15, dias 16-fin
}

function pagadoDeudaEnMes(db, categoria, anio, mes) {
  const [primeraMitad, segundaMitad] = quincenasDelMesReal(anio, mes);
  return (db.movimientos || [])
    .filter(
      (m) =>
        m.tipo === "deuda" &&
        m.categoria === categoria &&
        esConfirmado(m) &&
        (m.quincenaId === primeraMitad || m.quincenaId === segundaMitad)
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

  // Si la ventana del mes anterior cae (total o parcialmente) antes del
  // ancla del arrastre, es historia importada del Excel que Rafael mismo
  // confirmo incompleta (pagos que nunca quedaron registrados ahi) -- no
  // hay forma confiable de distinguir "no se pago" de "no quedo importado".
  // Sin este corte, cualquier mes pegado al ancla (como agosto 2026, justo
  // el que la toca) reportaba TODAS las deudas como atrasadas por completo
  // así estuvieran pagadas al dia, y esa cuota fantasma se sumaba encima de
  // la real (paso el 2026-09-16 con Auteco, NU mama, Rappi y Falabella).
  const [primeraMitadMesAnt] = quincenasDelMesReal(anioAnt, mesAnt);
  if (quincenaAntes(primeraMitadMesAnt, ANCLA_ARRASTRE)) return [];

  const alertas = [];
  const saldosDeHoy = saldosDeuda(db);
  for (const categoria of Object.keys(db.cuotasRecomendadas || {})) {
    // Si ya se pago por completo, no hay cuota que reclamar -- sin este
    // chequeo, una deuda saldada hace meses sigue apareciendo "atrasada"
    // para siempre (se detecto probando el historial con un año de datos).
    if ((saldosDeHoy[categoria] ?? 0) <= 0) continue;

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
        mensaje: `No quedó completa la cuota de ${NOMBRES_MES[mesAnt]} — págalo antes del 15 de ${NOMBRES_MES[mes]} para no atrasarte más.`,
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

// A que mes CALENDARIO pertenecen los dias que en verdad se viven en una
// quincena. Ojo: no es el mismo "mes" que trae el id de la quincena --
// quincenaId() ya etiqueta la Q2 con el mes ANTERIOR precisamente porque
// esos dias (1 al 15) se viven del sueldo de esa Q2 (ver el comentario de
// quincenaId arriba). Entonces el mes calendario real de una Q1 es el mismo
// de su id, pero el de una Q2 es el mes SIGUIENTE al de su id.
function mesCalendarioDeQuincena(anio, mes, q) {
  if (q === 1) return { anio, mes };
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
}

// Veredicto crudo del MES CALENDARIO completo, pensado para verse ANTES de
// entrar a registrar nada: "vamos a alcanzar con lo estimado, estamos
// bien, o toca frenar" -- sin obligar a sumar dos quincenas en la cabeza
// para saberlo.
//
// Las dos mitades que de verdad viven un mes calendario NO son la Q1 y la
// Q2 del mismo id (esas serian del 16 de este mes al 15 del siguiente): son
// la Q2 del id del mes anterior (dias 1-15, sueldo que llego a fin del mes
// pasado) y la Q1 de este id (dias 16-fin, sueldo que llega a mitad de
// mes). Rafael lo describio el 2026-09-14: "el mes inicia con la segunda
// quincena de agosto... y llega la primera de septiembre y rematamos" --
// eso es exactamente septiembre completo (dias 1 a 30). Agruparlas por el
// mismo numero de mes del id (como se hacia antes) mostraba un "mes" que en
// realidad eran los ultimos 15 dias de un mes calendario mas los primeros
// 15 del siguiente, y por eso un mes podia verse "bien" y el que le seguia
// "critico" sin que calzara con como se vive el dinero de verdad.
export function calcularEstadoMensual(db, id) {
  const partes = partesQuincena(id);
  const { anio, mes } = mesCalendarioDeQuincena(partes.anio, partes.mes, partes.q);

  let anioAnt = anio;
  let mesAnt = mes - 1;
  if (mesAnt === 0) {
    mesAnt = 12;
    anioAnt -= 1;
  }
  const idQ1 = idQuincena(anioAnt, mesAnt, 2); // dias 1-15 del mes calendario
  const idQ2 = idQuincena(anio, mes, 1); // dias 16-fin del mes calendario
  const q1 = calcularEstadoQuincena(db, idQ1);
  const q2 = calcularEstadoQuincena(db, idQ2);

  // El arrastre de ENTRADA al mes es el de la primera mitad (lo que traia
  // de antes); el resto se suma quincena a quincena, no se reusa el
  // balance de cada una para no arrastrar dos veces el mismo saldo inicial.
  const saldoInicial = q1.saldoInicial;
  const ingresosConfirmado = q1.ingresosConfirmado + q2.ingresosConfirmado;
  const ingresosTotal = q1.ingresosTotal + q2.ingresosTotal;
  const egresoConfirmado = q1.egresoConfirmado + q2.egresoConfirmado;
  const egresoTotal = q1.egresoTotal + q2.egresoTotal;

  const balanceConfirmado = saldoInicial + ingresosConfirmado - egresoConfirmado;
  const balanceProyectado = saldoInicial + ingresosTotal - egresoTotal;

  // Mismo criterio que "riesgoGasto" por quincena (ver calcularEstadoQuincena):
  // se reserva lo comprometido de las DOS quincenas (mayor entre presupuesto
  // y lo real) y se compara contra lo que de verdad ha entrado en el mes.
  const egresoEsperadoQuincena = (estado) => {
    const egresoEsperado = (lista) => lista.reduce((a, x) => a + Math.max(x.presupuesto, x.total), 0);
    return egresoEsperado(estado.gastos) + egresoEsperado(estado.deudas) + estado.inversionesTotal;
  };
  const egresoEsperadoTotal = egresoEsperadoQuincena(q1) + egresoEsperadoQuincena(q2);

  // A diferencia de calcularEstadoQuincena (donde "solo lo confirmado"
  // tiene sentido porque es plata que hay que tener EN LA MANO ahora
  // mismo), un mes completo siempre incluye un pago de sueldo que, al
  // principio del mes, todavia no se ha confirmado en la app -- no porque
  // sea incierto, sino porque el dia simplemente no ha llegado. Medir el
  // mes contra solo lo confirmado hace que CUALQUIER mes se vea en rojo
  // profundo hasta que ya paso su segunda quincena, sin importar que tan
  // bien este el presupuesto: no es una señal de riesgo real, es un efecto
  // de que el mes no ha terminado. Por eso aca se usa el sueldo por
  // defecto de las dos quincenas (mas la prima si el mes la trae), no solo
  // lo confirmado -- para responder "si este mes va como se espera, alcanza
  // o no", que es la pregunta que se esta haciendo.
  // Pero "el sueldo por defecto de las dos quincenas" a secas ignoraba
  // cualquier ingreso extra que YA de verdad entro (ej. un extra
  // confirmado en la primera mitad del mes) -- ese dinero es tan real como
  // el sueldo, y no contarlo hacia ver un mes "corto" que en la practica
  // ya tenia con que cubrirse (paso el 2026-09-16: $900.000 de extra
  // confirmados en la Q2 de agosto desaparecian del balance esperado de
  // septiembre). Se usa lo mayor entre el sueldo por defecto y lo
  // confirmado (sin la prima, que se trata aparte para no duplicarla si
  // ya se registro un movimiento de esa categoria).
  const primaConfirmada = (estado) => {
    const p = estado.ingresos.find((i) => i.categoria === "prima");
    return p ? p.confirmado : 0;
  };
  const ingresoEsperadoQuincena = (estado, salarioDefault) =>
    Math.max(estado.ingresosConfirmado - primaConfirmada(estado), salarioDefault);

  const primaDelMes = [6, 12].includes(mes) ? Number(db.config.prima || 0) : 0;
  const primaEsperada = Math.max(primaConfirmada(q1) + primaConfirmada(q2), primaDelMes);
  const ingresoEsperadoTotal =
    ingresoEsperadoQuincena(q1, Number(db.config.ingresoQ2 || 0)) +
    ingresoEsperadoQuincena(q2, Number(db.config.ingresoQ1 || 0)) +
    primaEsperada;

  // sobranteSeguro YA es un balance (no solo un "cuanto sobra"): saldo
  // inicial mas el sueldo esperado del mes, menos TODO lo comprometido
  // aunque todavia no se haya registrado como movimiento. Es la cifra que
  // hay que mostrar como "balance esperado", no balanceProyectado (que
  // solo suma lo que ya quedo registrado como pendiente, y por eso al
  // principio del mes se ve mas optimista de lo real: la mayoria de los
  // gastos fijos y cuotas del mes todavia no se han registrado como
  // movimiento, aunque ya se sabe que van a caer).
  const sobranteSeguro = saldoInicial + ingresoEsperadoTotal - egresoEsperadoTotal;
  const sobrante = sobranteSeguro > 0 ? sobranteSeguro : 0;
  const riesgoGasto = sobranteSeguro < 0;

  const idHoy = quincenaId();

  return {
    mes: `${anio}-${String(mes).padStart(2, "0")}`,
    idQ1,
    idQ2,
    quincenaActivaId: idHoy === idQ1 || idHoy === idQ2 ? idHoy : null,
    saldoInicial,
    ingresosConfirmado,
    ingresosTotal,
    egresoConfirmado,
    egresoTotal,
    balanceConfirmado,
    balanceProyectado,
    egresoEsperadoTotal,
    ingresoEsperadoTotal,
    sobrante,
    sobranteSeguro,
    riesgoGasto,
    q1: {
      id: idQ1,
      balanceConfirmado: q1.balanceConfirmado,
      balanceProyectado: q1.balanceProyectado,
      riesgoGasto: q1.riesgoGasto,
    },
    q2: {
      id: idQ2,
      balanceConfirmado: q2.balanceConfirmado,
      balanceProyectado: q2.balanceProyectado,
      riesgoGasto: q2.riesgoGasto,
    },
  };
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
