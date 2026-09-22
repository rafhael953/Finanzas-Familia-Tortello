# Tortello Finanzas — Estructura completa de la app

App de finanzas familiares para Rafael y Jerardith Tortello. Corre en
Railway, la usan desde el celular. Este documento reúne TODO lo necesario
para que otra herramienta (o una IA) entienda qué es esta app y pueda
reconstruirla o rediseñarla.

---

## 1. Stack técnico

- **Backend:** Node 20 + Express 4, ES modules (`type: "module"`). Sin
  framework de base de datos: persiste todo en **un solo archivo JSON**
  (`server/data/finanzas.json`), leído/escrito con locking en cola
  (`server/db.js`).
- **Frontend:** React 19 + React Router 7 + Vite 5 + Tailwind CSS 4
  (via `@tailwindcss/postcss`). SPA servida como estático por el mismo
  Express en producción (`client/dist`).
- **Auth:** cookie de sesión simple hecha a mano (`server/auth.js`), sin
  librería externa.
- **Despliegue:** Railway, builder Nixpacks (`nixpacks.toml`,
  `railway.json`), Node 20. `npm run build` compila el cliente e instala
  el server; `npm start` arranca el server, que sirve la SPA.
- **Sin ORM, sin SQL, sin Docker propio.** Todo el "modelo de datos" es un
  único JSON con arrays y objetos anidados.
- **Testing:** `server/calculos.test.js` con el test runner nativo de
  Node (`node --test`), cubre la lógica de cálculo financiero.
- **Lint:** oxlint en el cliente.

## 2. Árbol de archivos

```
tortello-finanzas/
├── package.json              # scripts raíz: build (client+server), start
├── railway.json               # config Railway (Nixpacks, build/start command)
├── nixpacks.toml               # fuerza Node 20
├── README.md
├── CONTEXTO.md                 # notas de negocio/decisiones (ver sección 6)
├── design-demos/                # 3 mockups HTML de dirección visual + PNGs
│
├── server/
│   ├── index.js                 # entrypoint Express: rutas, sesión, estáticos, config
│   ├── db.js                    # lectura/escritura JSON, semilla, respaldos, cola de escritura
│   ├── auth.js                  # login por cookie simple
│   ├── calculos.js              # el corazón: 824 líneas de lógica financiera (quincenas, arrastre, alertas)
│   ├── asesor.js                # reparto de cuotas, cupos, metas, sugerencias (354 líneas)
│   ├── calculos.test.js         # tests de calculos.js
│   ├── data/
│   │   ├── finanzas.json        # LA base de datos (local; en prod vive en volumen Railway)
│   │   └── finanzas.json.bak    # respaldo automático pre-escritura
│   ├── seed/
│   │   └── finanzas-seed.json   # semilla inicial / para IMPORTAR_HISTORIA
│   └── routes/
│       ├── registros.js         # estado de quincena actual, histórico, análisis
│       ├── movimientos.js       # CRUD de movimientos (ingreso/gasto/deuda/inversión)
│       ├── deudas.js             # alertas, compras a crédito, saldos, proyección
│       ├── cuentas.js            # saldos de cuentas (NU, Bancolombia, XTB, Binance), evolución NU
│       ├── jerardith.js          # gastos que ella registra + resumen de lo entregado
│       ├── categorias.js         # categorías personalizadas (gasto/inversión/ingreso)
│       └── plan.js                # plan ideal, reparto de cuotas, gastos fijos por quincena
│
└── client/
    ├── vite.config.js
    ├── index.html
    ├── public/ (favicon, icons.svg)
    └── src/
        ├── main.jsx
        ├── App.jsx               # rutas de la SPA (ver sección 4)
        ├── api.js                 # cliente fetch hacia /api/*
        ├── index.css               # Tailwind + estilos base
        ├── pages/
        │   ├── Login.jsx
        │   ├── Inicio.jsx           # selector de quién entra (Rafael/Jerardith)
        │   ├── PanelRafael.jsx      # panel principal: trayectoria, alertas, "no gastes más"
        │   ├── PanelJerardith.jsx   # panel de ella: qué le entregaron / qué ha gastado
        │   ├── Deudas.jsx            # detalle de deudas/tarjetas, compras, cuotas
        │   ├── Dashboard.jsx
        │   ├── Historial.jsx         # histórico de movimientos y quincenas
        │   ├── Ahorro.jsx             # evolución NU/XTB
        │   ├── Graficas.jsx           # donas, línea, entrada/salida
        │   ├── Reparto.jsx            # cuotas por quincena, gastos fijos editables, cupos
        │   └── Comprometido.jsx      # cuánto ya está comprometido (fijos+cuotas) por quincena
        └── components/
            ├── Navegacion.jsx, Deslizable.jsx (nav por swipe entre pantallas)
            ├── TarjetaSaldo.jsx, BarraDeuda.jsx, DetalleDeuda.jsx
            ├── EstadoMensual.jsx, TrayectoriaBalance.jsx   # la vista de balance encadenado
            ├── FilaCategoria.jsx, FilaValorEditable.jsx, SeccionPlegable.jsx
            ├── FormGasto.jsx, FormMovimiento.jsx
            ├── GraficoDona.jsx, GraficoLinea.jsx, GraficoEntradaSalida.jsx
            ├── ListaMovimientos.jsx, SelectorQuincena.jsx
            └── SiAlgoFalla.jsx (error boundary)
```

## 3. Modelo de datos (forma real de `finanzas.json`)

Un único documento JSON, forma (tipos, no valores reales):

```jsonc
{
  "config": {
    "ingresoQ1": "number", "ingresoQ2": "number", "prima": "number",
    "tasaTC": "number", "tasaAuteco": "number", "rendNU": "number",
    "trm": "number", "bolsilloJerardith": "number", "abonoExtraMensual": "number"
    // + editables por API: cupoTarjetasMensual, saldoInicialReal
  },
  "saldosIniciales": { "nu": "number", "bancolombia": "number", "xtbUSD": "number", "binanceUSD": "number" },
  "deudasIniciales": { "falabella": "number", "rappi": "number", "auteco": "number", "numama": "number", "decameron": "number", "nohora": "number", "bancolombia": "number" },
  "cuotasRecomendadas": { "<categoríaDeuda>": "number" },
  "gastosFijos": {
    "q1": { "arriendo": "n", "servicios": "n", "mercado": "n", "cuidado": "n", "salud": "n", "combustible": "n", "ocio": "n", "efectivo": "n" },
    "q2": { /* mismas claves */ }
  },
  "reservasMes": { "q1": { "xtb": "n", "medicaBucaramanga": "n" }, "q2": { /* igual */ } },
  "decameronMesesRestantes": "number",
  "movimientos": [
    {
      "id": "string", "quincenaId": "string (ej. '2026-09-Q1')",
      "tipo": "ingreso | gasto | deuda | inversion",
      "categoria": "string", "monto": "number", "descripcion": "string",
      "fecha": "ISO date", "registradoPor": "rafael | jerardith",
      "confirmado": "boolean  // true = ya pasó; false = plan"
    }
  ],
  "registros": [],
  "gastosJerardith": [],
  "activacionesJerardith": { "<quincenaId>": "boolean" },
  "categoriasPersonalizadas": { "gasto": {}, "inversion": {}, "ingreso": {} },
  "comprasTarjeta": [ "objeto de compra a crédito, con cuotas" ],
  "deudasFechaCreacion": { "<categoríaDeuda>": "string mes" },
  "historialCuotas": { "<categoríaDeuda>": [ "objeto" ] },
  "presupuestoIdeal": {
    "q1": { "ingreso": "n", "categorias": "object", "deudas": "n" },
    "q2": { /* igual */ }
  },
  "repartoCuotas": { "<categoríaDeuda>": "number (0..1, fijado a mano)" }
}
```

Notas clave del modelo:
- **No hay tablas relacionales.** Todo vive en arrays/objetos dentro de un
  JSON gigante, mutado con lectura→modificación→escritura en cola
  (`withDB` en `db.js`) para evitar carreras entre requests.
- **`quincenaId`** es la unidad de tiempo central, formato `AAAA-MM-Qn`,
  pero **no corresponde al mes calendario** (ver sección 6).
- **`confirmado`** separa lo real de lo planeado; toda agregación de
  saldos filtra por `confirmado: true`.
- Cada escritura hace `git commit` + `git push` silencioso del JSON
  (historial de versiones como base de datos temporal).

## 4. Rutas del frontend (SPA, `App.jsx`)

| Ruta | Página | Para qué |
|---|---|---|
| `/` | Inicio | Selector de usuario |
| `/rafael` | PanelRafael | Panel principal: trayectoria de balance, alertas, "no gastes más" |
| `/rafael/deudas` | Deudas | Detalle de tarjetas/deudas, compras, cuotas |
| `/dashboard` | Dashboard | Vista general |
| `/historial` | Historial | Movimientos e histórico de quincenas |
| `/ahorro` | Ahorro | Evolución NU / XTB |
| `/graficas` | Graficas | Donas, línea, entrada/salida |
| `/reparto` | Reparto | Reparto de cuotas por quincena, gastos fijos editables, cupos de tarjeta |
| `/comprometido` | Comprometido | Cuánto ya está comprometido (fijos + cuotas) por quincena |
| `/jerardith` | PanelJerardith | Lo que le entregaron vs. lo que ha gastado |

Sin `/login` explícita: `App.jsx` decide entre `Login` o las rutas según
`api.whoami()`. Navegación entre pantallas también por swipe
(`Deslizable.jsx`).

## 5. API (Express, todo bajo `/api`, con sesión por cookie salvo login/health)

**Sesión / sistema**
- `GET /api/health`
- `GET /api/whoami`
- `POST /api/login` `{ usuario, clave }`
- `POST /api/logout`
- `GET /api/respaldo` — descarga el JSON completo
- `GET /api/respaldos` / `GET /api/respaldos/:nombre` — copias de seguridad en el volumen
- `GET /api/config` / `PUT /api/config` `{ campo, valor }` (campos editables: `trm`, `abonoExtraMensual`, `rendNU`, `cupoTarjetasMensual`, `saldoInicialReal`)

**`/api/registros`** (estado de quincenas)
- `GET /actual`, `GET /lista`, `GET /estado/:id`, `GET /mensual/:id`,
  `GET /estado-mensual/:id`, `GET /comprometido/:id`, `GET /historial`,
  `GET /analisis`

**`/api/movimientos`**
- `POST /`, `PUT /:id`, `DELETE /:id`

**`/api/deudas`**
- `GET /alertas`, `GET /compras`, `PUT /cuota`, `PUT /cupo-credito`,
  `PUT /ajustar-saldo`, `POST /compra`, `PUT /compra/:id`,
  `DELETE /compra/:id`, `GET /`, `GET /:categoria/detalle`,
  `GET /proyeccion`

**`/api/cuentas`**
- `GET /`, `PUT /saldo`, `GET /evolucion-nu`, `GET /evolucion-nu-mensual`

**`/api/jerardith`**
- `GET /gastos`, `POST /gastos`, `GET /resumen`

**`/api/categorias`**
- `GET /`, `POST /`

**`/api/plan`**
- `GET /asesor`, `PUT /reparto`, `DELETE /reparto/:categoria`,
  `PUT /gasto-fijo`, `GET /`, `PUT /`

## 6. Lógica de negocio (lo que no se ve leyendo el código solo)

Esto vive en `CONTEXTO.md` del repo y es indispensable para que cualquier
reconstrucción no rompa el comportamiento esperado:

1. **Las quincenas no siguen el calendario.** Del 1-15 se vive del sueldo
   de la Q2 del mes anterior; del 16 en adelante, de la Q1 del mes en
   curso. `quincenaId()` en `calculos.js`. Sueldos distintos por
   quincena (Q1 ≈ 4.714.000, Q2 ≈ 4.350.500 en los datos actuales).

2. **Jerardith no maneja plata aparte.** Rafael le entrega dinero por
   rubro; ella registra en qué se lo gastó. Lo que registra ella **no
   cuenta en el balance de la casa** (evitar doble conteo — `movsCasa`).

3. **Rappi y Falabella son tarjetas rotativas**, no préstamos que solo
   bajan: `saldo = inicial − pagos` no aplica. Sus pagos históricos se
   registran como gasto, no como abono a deuda. Auteco, NU mamá y
   Decamerón sí son deudas que solo bajan.

4. **El balance se arrastra entre quincenas, no son cajas aisladas.**
   `saldoInicial` en `calcularEstadoQuincena` encadena el rojo o el
   sobrante de una quincena a la siguiente. El sobrante no se asume
   ahorrado solo — hay que confirmar el movimiento a mano.

5. **`ANCLA_ARRASTRE = 2026-08-Q2`**: el arrastre en vivo no encadena
   antes de esa fecha porque la historia importada de enero-julio (de un
   Excel) es incompleta y no tiene saldo inicial confiable. Cualquier
   vista o cálculo "hacia atrás" o "mes anterior" debe cortar ahí.

6. **`riesgoGasto`**: alerta "🛑 No gastes más" que compara lo
   efectivamente confirmado como ingreso contra lo ya comprometido
   (fijos + cuotas + registrado), sin esperar a que el balance real ya
   esté en rojo.

7. **Un "mes calendario" para Rafael = Q2 del mes anterior + Q1 del mes
   en curso**, no Q1+Q2 del mismo número de mes del id
   (`mesCalendarioDeQuincena` en `calculos.js`).

8. **Dos cupos de tarjeta distintos y ambos independientes:**
   `cupoTarjetasMensual` (disciplina personal, default $500.000) vs.
   `cupoCreditoTarjetas` en `db.config` (límite real del banco: Rappi
   $10M, Falabella $16M).

9. **`confirmado: true/false`** separa lo real de lo planeado en todo
   cálculo de saldo/gráfica. Meter el plan como confirmado infla la
   deuda mostrada de menos (bug real ya visto).

10. **Dos bases de datos separadas**: producción (volumen Railway, fuente
    de verdad, el celular) vs. local (`server/data/finanzas.json`,
    taller de desarrollo). El volumen sobrevive a despliegues — subir
    código nunca sube datos. Sincronización manual vía variables de
    entorno `IMPORTAR_HISTORIA=1` (agrega sin pisar) o
    `REEMPLAZAR_DATOS=1` (reemplaza todo, con seguros anti-pérdida).

11. **Reparto automático de cuotas** (`server/asesor.js`,
    `repartoQuincenas`): reparte cada cuota entre Q1/Q2 buscando margen
    parecido entre ambas, salvo que se fije a mano en `repartoCuotas`.

12. **Meta de ahorro**: la declarada es 39,2%/mes, pero el plan real da
    ~17,4% como techo teórico; se usa una "meta calculada sola" = promedio
    real de los últimos 3 meses cerrados (hoy ~10%). Las tarjetas son la
    causa principal de no llegar (4-5x lo presupuestado).

## 7. Diseño / dirección visual

`design-demos/` tiene 3 mockups HTML alternativos (`A-cinematic-pulse`,
`B-copilot-cards`, `C-warm-ledger`) con sus PNG, y
`direction-approved.md` documenta cuál se aprobó como dirección visual
real de la app (revisar ese archivo si se va a rediseñar).

## 8. Cómo correr en local

```
cd server && npm install && npm start     # puerto 3001
cd client && npm install && npm run dev   # puerto 5173
```

En producción, `npm run build` (raíz) compila `client/dist` y el mismo
Express de `server/index.js` lo sirve como estático, quedando todo en un
solo servicio de Railway.
