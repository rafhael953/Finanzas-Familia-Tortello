import { Router } from "express";
import { readDB } from "../db.js";
import {
  quincenaId,
  calcularEstadoQuincena,
  calcularEstadoMensual,
  calcularComprometidoMensual,
  calcularResumenMensual,
} from "../calculos.js";

const router = Router();

router.get("/actual", async (req, res) => {
  res.json({ id: quincenaId() });
});

router.get("/lista", async (req, res) => {
  const db = await readDB();
  const ids = new Set([quincenaId()]);
  for (const m of db.movimientos || []) ids.add(m.quincenaId);
  const lista = [...ids].sort();
  res.json(lista);
});

router.get("/estado/:id", async (req, res) => {
  const db = await readDB();
  res.json(calcularEstadoQuincena(db, req.params.id));
});

router.get("/mensual/:id", async (req, res) => {
  const db = await readDB();
  res.json(calcularResumenMensual(db, req.params.id));
});

// Veredicto crudo del mes completo (ver calcularEstadoMensual): esto es lo
// que Rafael quiere ver PRIMERO, antes de entrar a registrar nada.
router.get("/estado-mensual/:id", async (req, res) => {
  const db = await readDB();
  res.json(calcularEstadoMensual(db, req.params.id));
});

// Desglose de "a que se comprometio la plata este mes" (ver
// calcularComprometidoMensual): lo reservado, lo pagado y lo que falta,
// categoria por categoria y quincena por quincena.
router.get("/comprometido/:id", async (req, res) => {
  const db = await readDB();
  res.json(calcularComprometidoMensual(db, req.params.id));
});

// Historial completo: todos los movimientos desde el inicio, mas recientes
// primero -- para ver de un vistazo todo lo que se ha registrado, sin
// tener que ir quincena por quincena.
router.get("/historial", async (req, res) => {
  const db = await readDB();
  const movimientos = [...(db.movimientos || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  res.json(movimientos);
});

// Serie por mes y por categoria, para las graficas. Se devuelve crudo y
// el cliente arma los cortes: asi se pueden cambiar filtros sin volver a
// pedir datos al servidor.
router.get("/analisis", async (req, res) => {
  const db = await readDB();
  const movs = (db.movimientos || []).filter((m) => m.confirmado !== false);

  const porMes = {};
  for (const m of movs) {
    // Lo que registra Jerardith es el detalle de plata ya entregada: si se
    // contara, cada gasto suyo aparecería dos veces en las graficas.
    if (m.registradoPor === "jerardith") continue;

    const mes = m.quincenaId.slice(0, 7);
    porMes[mes] = porMes[mes] || {
      mes,
      ingreso: 0,
      gasto: 0,
      deuda: 0,
      inversion: 0,
      compras: 0,
      categorias: {},
    };
    const monto = Number(m.monto || 0);

    // Una compra con tarjeta no es plata que salio: crea deuda. Va en su
    // propia serie y NO entra en las categorias, o se sumaria junto con los
    // abonos a esa misma tarjeta y el mismo peso apareceria dos veces.
    if (m.tipo === "compraTarjeta") {
      porMes[mes].compras += monto;
      continue;
    }

    porMes[mes][m.tipo] = (porMes[mes][m.tipo] || 0) + monto;
    if (m.tipo !== "ingreso") {
      porMes[mes].categorias[m.categoria] = (porMes[mes].categorias[m.categoria] || 0) + monto;
    }
  }

  // Cuanta deuda quedaba al cerrar cada mes, para poder ver si de verdad
  // esta bajando. Se arranca del saldo inicial y se va moviendo mes a mes.
  const meses = Object.values(porMes).sort((a, b) => (a.mes < b.mes ? -1 : 1));
  let saldoDeuda = Object.values(db.deudasIniciales || {}).reduce((a, b) => a + Number(b || 0), 0);
  for (const m of meses) {
    saldoDeuda = saldoDeuda + m.compras - m.deuda;
    m.deudaTotal = Math.max(0, Math.round(saldoDeuda));
  }

  res.json(meses);
});

export default router;
