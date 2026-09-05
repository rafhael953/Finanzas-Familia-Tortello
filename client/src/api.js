// En desarrollo el cliente y el servidor corren en puertos distintos.
// En produccion el servidor sirve el cliente compilado desde su propia
// direccion, asi que las llamadas van al mismo origen (BASE_URL vacio).
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "");

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  whoami: () => request("/api/whoami"),
  login: (usuario, clave) =>
    request("/api/login", { method: "POST", body: JSON.stringify({ usuario, clave }) }),
  logout: () => request("/api/logout", { method: "POST" }),

  getConfig: () => request("/api/config"),

  getQuincenaActual: () => request("/api/registros/actual"),
  getListaQuincenas: () => request("/api/registros/lista"),
  getEstadoQuincena: (id) => request(`/api/registros/estado/${id}`),
  getResumenMensual: (id) => request(`/api/registros/mensual/${id}`),
  getHistorial: () => request(`/api/registros/historial`),
  getAnalisis: () => request(`/api/registros/analisis`),

  agregarMovimiento: (mov) =>
    request("/api/movimientos", { method: "POST", body: JSON.stringify(mov) }),
  editarMovimiento: (id, cambios) =>
    request(`/api/movimientos/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  borrarMovimiento: (id) => request(`/api/movimientos/${id}`, { method: "DELETE" }),

  getDeudas: () => request("/api/deudas"),
  getDeudasProyeccion: () => request("/api/deudas/proyeccion"),
  getAlertasDeudas: () => request("/api/deudas/alertas"),
  getComprasTarjeta: () => request("/api/deudas/compras"),
  registrarCompraTarjeta: (compra) =>
    request("/api/deudas/compra", { method: "POST", body: JSON.stringify(compra) }),
  editarCuotaDeuda: (categoria, valor) =>
    request("/api/deudas/cuota", { method: "PUT", body: JSON.stringify({ categoria, valor }) }),
  editarCompraTarjeta: (id, compra) =>
    request(`/api/deudas/compra/${id}`, { method: "PUT", body: JSON.stringify(compra) }),
  borrarCompraTarjeta: (id) => request(`/api/deudas/compra/${id}`, { method: "DELETE" }),

  editarConfig: (campo, valor) =>
    request("/api/config", { method: "PUT", body: JSON.stringify({ campo, valor }) }),

  getCuentas: () => request("/api/cuentas"),
  getEvolucionNU: () => request("/api/cuentas/evolucion-nu"),
  getEvolucionNUMensual: () => request("/api/cuentas/evolucion-nu-mensual"),
  editarSaldoCuenta: (campo, valor) =>
    request("/api/cuentas/saldo", { method: "PUT", body: JSON.stringify({ campo, valor }) }),

  getCategoriasPersonalizadas: () => request("/api/categorias"),
  crearCategoria: (tipo, etiqueta) =>
    request("/api/categorias", { method: "POST", body: JSON.stringify({ tipo, etiqueta }) }),

  getResumenJerardith: () => request("/api/jerardith/resumen"),
  getGastosJerardith: () => request("/api/jerardith/gastos"),
  postGastoJerardith: (gasto) =>
    request("/api/jerardith/gastos", { method: "POST", body: JSON.stringify(gasto) }),
};

export function formatoCOP(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

export const ETIQUETAS_CATEGORIA = {
  arriendo: "Arriendo",
  servicios: "Servicios",
  mercado: "Mercado",
  cuidado: "Cuidado",
  salud: "Salud",
  combustible: "Combustible",
  ocio: "Ocio",
  efectivo: "Efectivo",
  decameron: "Decamerón",
  falabella: "Falabella",
  rappi: "Rappi",
  auteco: "Auteco (moto)",
  numama: "NU mamá",
  nu: "Ahorro NU",
  xtb: "Inversión XTB",
  binance: "Binance (cripto)",
  medicaBucaramanga: "Reserva médica",
  jerardith: "Bolsillo Jerardith",
  salario: "Salario",
  prima: "Prima",
  extra: "Extra",
};

const NOMBRES_MES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatoQuincena(id) {
  const [anio, mes, qStr] = id.split("-");
  const q = qStr.replace("Q", "");
  return `Quincena ${q} · ${NOMBRES_MES[Number(mes)]} ${anio}`;
}

export function partesQuincena(id) {
  const [anio, mes, qStr] = id.split("-");
  return { anio: Number(anio), mes: Number(mes), q: Number(qStr.replace("Q", "")) };
}

export function idQuincena(anio, mes, q) {
  return `${anio}-${String(mes).padStart(2, "0")}-Q${q}`;
}

// Moverse entre quincenas por calendario, no por la lista de las que ya
// tienen movimientos: si no, no se puede ir a una quincena vacia (que es
// justo lo que se necesita para empezar a registrarla).
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

// Un color distintivo y mutado por categoria (no colores de semaforo — esos
// se reservan para positivo/negativo). Ayuda a reconocer cada rubro de un
// vistazo, como en apps como Copilot Money, pero en tonos tierra acordes
// a la paleta del libro.
export const CATEGORIA_COLOR = {
  arriendo: "#8B5E3C",
  servicios: "#5B7B8C",
  mercado: "#7D8B5A",
  cuidado: "#B77B8B",
  salud: "#4E8380",
  combustible: "#C6A15B",
  ocio: "#7A5C7E",
  efectivo: "#8A7F6E",
  decameron: "#C17A56",
  falabella: "#A8453C",
  rappi: "#C9A227",
  auteco: "#4F6D7A",
  numama: "#6B8E6B",
  nu: "#6B8E6B",
  xtb: "#5C8A99",
  binance: "#C6A15B",
  medicaBucaramanga: "#9C6B4E",
  jerardith: "#B5638C",
  salario: "#3F6B33",
  prima: "#5B8A4A",
  extra: "#7BA36A",
};

// Fusiona las categorias que la familia crea sobre la marcha (ver
// categorias.js en el servidor) dentro de las etiquetas y colores conocidos,
// para que se vean igual de bien que las categorias que ya traia la app.
export function aplicarCategoriasPersonalizadas(porTipo) {
  for (const tipo of Object.keys(porTipo || {})) {
    for (const [categoria, info] of Object.entries(porTipo[tipo] || {})) {
      ETIQUETAS_CATEGORIA[categoria] = info.etiqueta;
      CATEGORIA_COLOR[categoria] = info.color;
    }
  }
}

export const ETIQUETAS_TIPO = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  deuda: "Deuda",
  inversion: "Inversión",
};
