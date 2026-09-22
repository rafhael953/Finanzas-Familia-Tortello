import { Router } from "express";

// Express 4 no atrapa un reject de una ruta async: si nadie hace try/catch,
// la promesa queda "unhandled" y el proceso puede morir sin responder nada,
// dejando al navegador esperando para siempre (visto con las rutas que
// hablan con Supabase). Esto envuelve toda ruta async registrada en
// cualquier Router para que su error llegue siempre a next(err) y termine
// en el manejador de errores de server/index.js.
//
// OJO: Router() de Express NO usa Router.prototype para sus metodos (.get,
// .post, etc) -- usa un objeto interno separado que asigna via
// Object.setPrototypeOf(router, proto). Por eso hay que agarrar ese "proto"
// real creando una instancia de prueba, en vez de parchar Router.prototype
// (que existe pero Express nunca lo usa).
const proto = Object.getPrototypeOf(Router());
const METODOS = ["get", "post", "put", "delete", "patch"];

for (const metodo of METODOS) {
  const original = proto[metodo];
  proto[metodo] = function (path, ...handlers) {
    const envueltos = handlers.map((h) => {
      if (typeof h !== "function" || h.constructor.name !== "AsyncFunction") return h;
      return (req, res, next) => {
        Promise.resolve(h(req, res, next)).catch(next);
      };
    });
    return original.call(this, path, ...envueltos);
  };
}
