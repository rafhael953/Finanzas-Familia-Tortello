import { Router } from "express";
import { withDB } from "../db.js";
import { quincenaId } from "../calculos.js";

const router = Router();

const CATEGORIAS_POR_TIPO = {
  gasto: ["arriendo", "servicios", "mercado", "cuidado", "salud", "combustible", "ocio", "efectivo", "medicaBucaramanga", "jerardith"],
  deuda: ["falabella", "rappi", "auteco", "numama", "decameron"],
  inversion: ["xtb"],
  ingreso: ["salario", "prima", "extra"],
};

router.post("/", async (req, res) => {
  const mov = req.body;

  if (!CATEGORIAS_POR_TIPO[mov.tipo]) {
    return res.status(400).json({ error: "Tipo inválido" });
  }
  if (!CATEGORIAS_POR_TIPO[mov.tipo].includes(mov.categoria)) {
    return res.status(400).json({ error: "Categoría inválida para ese tipo" });
  }
  if (!mov.monto || Number(mov.monto) <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  try {
    const nuevo = await withDB(async (db) => {
      const item = {
        id: `mov-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        quincenaId: mov.quincenaId || quincenaId(),
        tipo: mov.tipo,
        categoria: mov.categoria,
        monto: Number(mov.monto),
        descripcion: mov.descripcion || "",
        fecha: mov.fecha || new Date().toISOString().slice(0, 10),
        registradoPor: mov.registradoPor || "rafael",
        confirmado: mov.confirmado !== false,
      };
      db.movimientos = db.movimientos || [];
      db.movimientos.push(item);
      return item;
    });
    res.json(nuevo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const actualizado = await withDB(async (db) => {
      const idx = (db.movimientos || []).findIndex((m) => m.id === req.params.id);
      if (idx < 0) {
        const e = new Error("No encontrado");
        e.status = 404;
        throw e;
      }
      const actual = db.movimientos[idx];
      const cambios = req.body || {};
      if (cambios.monto !== undefined) {
        if (!cambios.monto || Number(cambios.monto) <= 0) {
          const e = new Error("Monto inválido");
          e.status = 400;
          throw e;
        }
        actual.monto = Number(cambios.monto);
      }
      if (cambios.descripcion !== undefined) actual.descripcion = cambios.descripcion;
      if (cambios.fecha !== undefined) actual.fecha = cambios.fecha;
      if (cambios.confirmado !== undefined) actual.confirmado = !!cambios.confirmado;
      db.movimientos[idx] = actual;
      return actual;
    });
    res.json(actualizado);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await withDB(async (db) => {
      const existe = (db.movimientos || []).some((m) => m.id === req.params.id);
      if (!existe) {
        const e = new Error("No encontrado");
        e.status = 404;
        throw e;
      }
      db.movimientos = db.movimientos.filter((m) => m.id !== req.params.id);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
