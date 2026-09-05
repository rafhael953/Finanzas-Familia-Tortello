import { Router } from "express";
import { readDB, withDB } from "../db.js";

const router = Router();

// Tipos que aceptan categorias nuevas sobre la marcha: son categorias
// "libres" (sin presupuesto fijo, como jerardith o medicaBucaramanga).
// Las deudas no entran aqui porque necesitan saldo y cuota, no solo un
// nombre -- eso se resuelve como parte de registrar la deuda misma.
const TIPOS_PERSONALIZABLES = ["gasto", "inversion", "ingreso"];

// Paleta de colores mutados para categorias nuevas -- se asigna de forma
// estable segun el nombre, para no repetir siempre el mismo color.
const PALETA = ["#8B5E3C", "#5B7B8C", "#7D8B5A", "#B77B8B", "#4E8380", "#C6A15B", "#7A5C7E", "#8A7F6E", "#C17A56", "#5C8A99"];

function colorPara(categoria) {
  let hash = 0;
  for (let i = 0; i < categoria.length; i++) hash = (hash * 31 + categoria.charCodeAt(i)) >>> 0;
  return PALETA[hash % PALETA.length];
}

const MARCAS_DIACRITICAS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

function slugificar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(MARCAS_DIACRITICAS, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}

router.get("/", async (req, res) => {
  const db = await readDB();
  res.json(db.categoriasPersonalizadas || { gasto: {}, inversion: {}, ingreso: {} });
});

router.post("/", async (req, res) => {
  const { tipo, etiqueta } = req.body || {};
  if (!TIPOS_PERSONALIZABLES.includes(tipo)) {
    return res.status(400).json({ error: "Tipo inválido" });
  }
  const etiquetaLimpia = (etiqueta || "").trim();
  if (!etiquetaLimpia) {
    return res.status(400).json({ error: "Escribe un nombre para la categoría" });
  }
  const categoria = slugificar(etiquetaLimpia);
  if (!categoria) {
    return res.status(400).json({ error: "Nombre inválido" });
  }

  try {
    const nueva = await withDB(async (db) => {
      db.categoriasPersonalizadas = db.categoriasPersonalizadas || { gasto: {}, inversion: {}, ingreso: {} };
      for (const t of TIPOS_PERSONALIZABLES) db.categoriasPersonalizadas[t] = db.categoriasPersonalizadas[t] || {};

      const yaExiste = TIPOS_PERSONALIZABLES.some((t) => categoria in db.categoriasPersonalizadas[t]);
      if (yaExiste) {
        const e = new Error("Ya existe una categoría con ese nombre");
        e.status = 409;
        throw e;
      }

      db.categoriasPersonalizadas[tipo][categoria] = {
        etiqueta: etiquetaLimpia,
        color: colorPara(categoria),
      };
      return { categoria, etiqueta: etiquetaLimpia, color: colorPara(categoria) };
    });
    res.json(nueva);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
