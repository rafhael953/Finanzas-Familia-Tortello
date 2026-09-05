# Tortello Finanzas

App de finanzas familiares (Rafael + Jerardith).

## Cómo correr en local

**Servidor (puerto 3001):**
```
cd server
npm install
npm start
```

**Cliente (puerto 5173):**
```
cd client
npm install
npm run dev
```

Abre http://localhost:5173 en el navegador (o en el celular usando la IP de tu computador en la red local, con `npm run dev -- --host`).

## Datos

Todo vive en `server/data/finanzas.json`. Es la fuente de verdad — respáldalo de vez en cuando (o versiónalo con git).

## Próximos pasos sugeridos

- Paso 3: alertas ya incluidas en el Panel Rafael (quincena pendiente / balance negativo).
- Paso 2: proyección de deudas ya disponible en `GET /api/deudas/proyeccion`.
- Paso 5: revisar diseño mobile con dispositivos reales.
- Paso 6: desplegar en Railway.
