import { useRef } from "react";
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

  const indice = SECCIONES.findIndex((s) => s.a === pathname);

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

  // La key hace que React vuelva a montar el contenido en cada cambio de
  // ruta, que es lo que dispara la animacion de entrada. Sin eso, React
  // reutiliza los nodos y la pantalla cambia de golpe.
  return (
    <div onTouchStart={alTocar} onTouchEnd={alSoltar}>
      <div key={pathname} className="pagina-entra">
        {children}
      </div>
    </div>
  );
}
