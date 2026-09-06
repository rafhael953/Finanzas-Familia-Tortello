# Cómo funciona esto (y por qué)

Notas para retomar el proyecto sin tener que reconstruir el razonamiento.
Lo que se puede leer en el código no se repite aquí; esto es lo que el
código no explica solo.

## Las quincenas no son las del calendario

La quincena "activa" es **la del sueldo con el que se está viviendo hoy**,
no la del calendario:

- **Del 1 al 15** de un mes → se está gastando la **Q2 del mes anterior**
  (ese pago llegó a fin de mes).
- **Del 16 en adelante** → la **Q1 del mes en curso**.

Por eso el 5 de septiembre la app abre en "Quincena 2 · Agosto". Está en
`quincenaId()` en `server/calculos.js`.

Los sueldos son distintos: Q1 ≈ 4.714.000, Q2 ≈ 4.350.500.

## Cómo funciona lo de Jerardith

Ella no maneja plata aparte: Rafael le **entrega** dinero para ciertos
rubros y ella registra **en qué se lo fue gastando**.

- Lo que registra **Rafael** en mercado/cuidado/aseo/ocio/bolsillo = lo que
  le entregó.
- Lo que registra **ella** = lo que gastó de eso.
- Lo disponible es la resta.

**Los registros de ella no cuentan en el balance de la casa.** La plata ya
salió cuando él se la entregó; contarla otra vez sería doble conteo (ver
`movsCasa` en `calculos.js`).

Cada rubro se habilita solo cuando él confirma que le entregó plata para
ese rubro. No hay botón de "activar".

## Las tarjetas rotativas no son préstamos

Rappi y Falabella se pagan y se vuelven a usar, así que **la suma de pagos
del año no dice nada del saldo inicial**. El modelo `saldo = inicial −
pagos` solo sirve para deudas que únicamente bajan (Auteco, NU mamá,
Decamerón).

Por eso los pagos históricos a tarjetas están como gasto ("Pago de
tarjetas", 20.200.000 en 2026) y no como abonos a la deuda. Si se importa
más historia de tarjetas, hay que hacer lo mismo o el saldo inicial se
infla hasta un número sin sentido.

## Confirmado vs pendiente

- `confirmado: true` → ya pasó de verdad.
- `confirmado: false` → es plan.

Los saldos y las gráficas solo cuentan lo confirmado. Registrar el plan
del mes como confirmado hace que la app muestre deuda de menos: pasó en
septiembre de 2026 y mostraba 15.880.000 cuando lo real era 19.100.000.

## Dos bases de datos separadas

Esto es lo que más confusión ha causado:

| | Dónde vive | Para qué |
|---|---|---|
| **Producción** (celular) | Volumen de Railway en `/app/server/data` | Los datos de verdad |
| **Local** (computador) | `server/data/finanzas.json` | Taller de desarrollo |

El volumen **sobrevive a los despliegues**, así que subir código NO sube
datos. La semilla (`server/seed/`) solo se aplica sola si el archivo no
existe.

**Producción es la fuente de la verdad.** Rafael registra desde el celular.

### Llevar datos al celular

Variables de entorno en Railway (poner, esperar el despliegue, **quitar**):

- `IMPORTAR_HISTORIA=1` → **agrega** los movimientos de la semilla que
  falten, comparando por id. No pisa nada. Ajusta los saldos iniciales de
  deuda según los pagos que agrega.
- `REEMPLAZAR_DATOS=1` → **reemplaza** todo con la semilla. Solo cuando la
  copia local es la buena y en producción no hay nada que falte acá.

Ambas guardan copia de lo anterior antes de tocar nada.

### Traer datos del celular

`GET /api/respaldo` descarga todo el archivo. Sirve de copia de seguridad
y para trabajar con los datos reales.

## El plan ideal

Viene de la hoja "Ideal" del Excel de presupuesto. Sus columnas
"D1-D15" y "D15-D30" corresponden a la **Q2 del mes anterior** y a la
**Q1 del mes en curso** (cada una es el sueldo que financia esos días).

Meta: ahorrar **39,2%** al mes (3.000.000 al NU + 550.000 a XTB).

Lo que los datos de 2026 muestran: el día a día está bastante cerca del
plan, pero **las tarjetas se llevan 4 o 5 veces lo presupuestado** y eso
se come justo lo que iba para el ahorro.

## Fuente de la historia

`C:\Users\PC\OneDrive\Documentos\Rafhael T\Presupuesto Familia Tortello
Garcia 2026.xlsx`, hoja "Estado de Cuenta 2026".

Enero–agosto es historia real (los montos varían). De septiembre en
adelante es proyección (se repite idéntica mes a mes) y **no se importó**.
