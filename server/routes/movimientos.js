import { Router } from "express";
import { withDB } from "../db.js";
import { quincenaId } from "../calculos.js";

// La quincena de un movimiento la decide su FECHA, no la pantalla en la
// que se estaba parado al crearlo -- quincenaId(fecha) es la definicion
// oficial de a cual quincena pertenece cada dia (ver el comentario en
// calculos.js). Antes se confiaba en el quincenaId que mandaba el cliente
// (la quincena que tenia abierta en el Panel), que puede no coincidir con
// la fecha real que se escribio: asi quedaron pagos de Rappi con fecha
// 2026-09-04 y 2026-09-11 (que por fecha son de la Q2 de agosto) archivados
// en la Q1 de septiembre, porque esa era la pantalla abierta al
// registrarlos. Eso inflaba una quincena y vaciaba la otra sin que se
// notara, hasta que los totales dejaron de cuadrar.
function quincenaDeFecha(fechaStr) {
  if (!fechaStr) return quincenaId();
  return quincenaId(new Date(`${fechaStr}T12:00:00`));
}

const router = Router();

const CATEGORIAS_POR_TIPO = {
  gasto: ["arriendo", "servicios", "mercado", "cuidado", "salud", "combustible", "ocio", "efectivo", "aseo", "medicaBucaramanga", "jerardith"],
  deuda: ["falabella", "rappi", "auteco", "numama", "decameron", "nohora", "bancolombia"],
  inversion: ["nu", "xtb", "binance"],
  ingreso: ["salario", "prima", "extra"],
};

function categoriaValida(db, tipo, categoria) {
  if (!CATEGORIAS_POR_TIPO[tipo]) return false;
  if (CATEGORIAS_POR_TIPO[tipo].includes(categoria)) return true;
  const personalizadas = (db.categoriasPersonalizadas || {})[tipo] || {};
  return categoria in personalizadas;
}

router.post("/", async (req, res) => {
  const mov = req.body;

  if (!mov.monto || Number(mov.monto) <= 0) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  try {
    const nuevo = await withDB(async (db) => {
      if (!categoriaValida(db, mov.tipo, mov.categoria)) {
        const e = new Error("Categoría inválida para ese tipo");
        e.status = 400;
        throw e;
      }
      const fecha = mov.fecha || new Date().toISOString().slice(0, 10);
      const quincena = quincenaDeFecha(fecha);
      // El salario llega una sola vez por quincena. Sin este aviso, un doble
      // toque o volver a registrar el mismo pago por error se suma sin que
      // nada lo note -- paso real en 2026-08-Q2 y 2026-09-Q1, donde el
      // balance quedo inflado hasta que alguien se dio cuenta a mano.
      if (mov.tipo === "ingreso" && mov.categoria === "salario" && !mov.forzar) {
        const yaExiste = (db.movimientos || []).some(
          (m) => m.tipo === "ingreso" && m.categoria === "salario" && m.quincenaId === quincena
        );
        if (yaExiste) {
          const e = new Error("Ya hay un salario registrado en esta quincena. ¿Seguro que quieres agregar otro?");
          e.status = 409;
          e.duplicado = true;
          throw e;
        }
      }
      const item = {
        id: `mov-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        quincenaId: quincena,
        tipo: mov.tipo,
        categoria: mov.categoria,
        monto: Number(mov.monto),
        descripcion: mov.descripcion || "",
        fecha,
        registradoPor: mov.registradoPor || "rafael",
        confirmado: mov.confirmado !== false,
      };
      db.movimientos = db.movimientos || [];
      db.movimientos.push(item);
      return item;
    });
    res.json(nuevo);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, duplicado: err.duplicado });
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
      // Las compras con tarjeta tambien ajustan la cuota mensual de esa
      // tarjeta, asi que no se pueden tocar desde aca: quedarian el saldo y
      // la cuota diciendo cosas distintas. Se editan en Deudas.
      if (actual.tipo === "compraTarjeta") {
        const e = new Error("Las compras con tarjeta se corrigen en la sección de Deudas");
        e.status = 400;
        throw e;
      }
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
      // Recalcula siempre, no solo cuando se toca la fecha explicitamente:
      // asi cualquier edicion (incluido solo tocar el circulo de confirmar)
      // autocorrige un quincenaId que haya quedado mal -- por ejemplo de
      // antes de este arreglo, cuando se guardaba la quincena de la
      // pantalla abierta en vez de la que le toca a la fecha. Es barato y
      // siempre da el mismo resultado si la fecha no cambio, asi que no
      // hay riesgo de mover algo que ya estaba bien.
      actual.quincenaId = quincenaDeFecha(actual.fecha);
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
      const esCompra = (db.movimientos || []).some(
        (m) => m.id === req.params.id && m.tipo === "compraTarjeta"
      );
      if (esCompra) {
        const e = new Error("Las compras con tarjeta se borran en la sección de Deudas");
        e.status = 400;
        throw e;
      }
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
