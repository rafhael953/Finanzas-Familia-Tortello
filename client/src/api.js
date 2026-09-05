const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  getConfig: () => request("/api/config"),

  getQuincenaActual: () => request("/api/registros/actual"),
  getListaQuincenas: () => request("/api/registros/lista"),
  getEstadoQuincena: (id) => request(`/api/registros/estado/${id}`),
  getResumenMensual: (id) => request(`/api/registros/mensual/${id}`),

  agregarMovimiento: (mov) =>
    request("/api/movimientos", { method: "POST", body: JSON.stringify(mov) }),
  editarMovimiento: (id, cambios) =>
    request(`/api/movimientos/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  borrarMovimiento: (id) => request(`/api/movimientos/${id}`, { method: "DELETE" }),

  getDeudas: () => request("/api/deudas"),
  getDeudasProyeccion: () => request("/api/deudas/proyeccion"),
  getAlertasDeudas: () => request("/api/deudas/alertas"),

  getCuentas: () => request("/api/cuentas"),
  getEvolucionNU: () => request("/api/cuentas/evolucion-nu"),

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
  xtb: "Inversión XTB",
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

export const ETIQUETAS_TIPO = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  deuda: "Deuda",
  reserva: "Reserva",
};
