import { Router } from "express";
import { readDB } from "../db.js";
import { quincenaId, calcularEstadoQuincena, calcularResumenMensual } from "../calculos.js";

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

// Historial completo: todos los movimientos desde el inicio, mas recientes
// primero -- para ver de un vistazo todo lo que se ha registrado, sin
// tener que ir quincena por quincena.
router.get("/historial", async (req, res) => {
  const db = await readDB();
  const movimientos = [...(db.movimientos || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  res.json(movimientos);
});

export default router;
