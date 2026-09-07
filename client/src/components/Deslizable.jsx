import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SECCIONES } from "./Navegacion";

// Pasar de una sección a otra arrastrando, como en cualquier app del
// celular. El orden es el mismo de la barra de arriba, para que deslizar y
// tocar lleven al mismo lado y no haya dos mapas distintos en la cabeza.
const MINIMO = 60; // píxeles: menos que esto es un toque, no un gesto

export default function Deslizable({ children }) {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const inicio = useRef(null);
  const indicePrevio = useRef(null);
  // Hacia donde entra la pantalla siguiente: coincide con el sentido en que
  // se "abre" (deslizar a la izquierda trae la de la derecha, y viceversa),
  // tanto si se llego deslizando como tocando una pestaña.
  const [direccion, setDireccion] = useState(null);

  const indice = SECCIONES.findIndex((s) => s.a === pathname);

  useEffect(() => {
    if (indicePrevio.current !== null && indice >= 0) {
      if (indice > indicePrevio.current) setDireccion("der");
      else if (indice < indicePrevio.current) setDireccion("izq");
    }
    if (indice >= 0) indicePrevio.current = indice;
  }, [pathname, indice]);

  function alTocar(e) {
    const t = e.touches[0];
    inicio.current = { x: t.clientX, y: t.clientY };
  }

  function alSoltar(e) {
    if (!inicio.current || indice < 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicio.current.x;
    const dy = t.clientY - inicio.current.y;
    inicio.current = null;

    // Solo cuenta si el movimiento fue claramente horizontal: si no,
    // cualquier scroll con el dedo un poco torcido cambiaría de pantalla.
    if (Math.abs(dx) < MINIMO || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const destino = dx < 0 ? indice + 1 : indice - 1;
    if (destino < 0 || destino >= SECCIONES.length) return;
    navegar(SECCIONES[destino].a);
  }

  const clasePagina =
    direccion === "der"
      ? "pagina-entra pagina-entra-der"
      : direccion === "izq"
      ? "pagina-entra pagina-entra-izq"
      : "pagina-entra";

  // La key hace que React vuelva a montar el contenido en cada cambio de
  // ruta, que es lo que dispara la animacion de entrada. Sin eso, React
  // reutiliza los nodos y la pantalla cambia de golpe.
  return (
    <div onTouchStart={alTocar} onTouchEnd={alSoltar}>
      <div key={pathname} className={clasePagina}>
        {children}
      </div>
    </div>
  );
}
