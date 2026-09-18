import { Link } from "react-router-dom";
import { formatoCOP, NOMBRES_MES } from "../api";

// Que tan lejos esta el faltante/sobrante frente al total comprometido del
// mes, para no saltar de golpe entre "no alcanza" y "vas bien": un mes que
// falta por poco (menos del 15% de lo comprometido) es distinto de uno que
// falta por mucho, y a Rafael le sirve ver ese punto intermedio para saber
// que un ajuste chico ya lo saca del rojo, en vez de un solo mensaje
// binario que no se mueve hasta que el numero cruza exactamente cero.
const UMBRAL_LIMITE = 0.15;
const UMBRAL_SIN_MARGEN = 0.1;

// Veredicto crudo del mes completo (las dos quincenas juntas) -- lo primero
// que Rafael quiere ver, antes de entrar a registrar nada. Es solo el
// titular: compacta a proposito y lleva a /comprometido, que es donde
// Rafael pidio ver el desglose completo (rubro por rubro, reservado vs
// pagado) en vez de mostrarlo aca tambien (2026-09-18).
export default function EstadoMensual({ estado }) {
  if (!estado) return null;

  const [, mesNum] = estado.mes.split("-");
  const nombreMes = NOMBRES_MES[Number(mesNum)];

  const ratio =
    estado.egresoEsperadoTotal > 0 ? estado.sobranteSeguro / estado.egresoEsperadoTotal : 0;

  let tono, icono, titulo;

  if (ratio <= -UMBRAL_LIMITE) {
    tono = "rojo";
    icono = "🛑";
    titulo = "Este mes no va a alcanzar";
  } else if (ratio < 0) {
    tono = "ambar";
    icono = "⚠";
    titulo = "Estás al límite este mes";
  } else if (ratio < UMBRAL_SIN_MARGEN) {
    tono = "verde";
    icono = "🙂";
    titulo = "Vas cubierto, sin margen extra";
  } else {
    tono = "verde";
    icono = "✅";
    titulo = "Vas bien este mes";
  }

  const estilos = {
    rojo: {
      fondo: "bg-[var(--color-suave-rojo)]",
      texto: "text-[var(--color-suave-rojo-texto)]",
      valor: "text-[var(--color-negativo-alto)]",
    },
    ambar: {
      fondo: "bg-[var(--color-suave-ambar)]",
      texto: "text-[var(--color-suave-ambar-texto)]",
      valor: "text-[var(--color-negativo-alto)]",
    },
    verde: {
      fondo: "bg-[var(--color-suave-verde)]",
      texto: "text-[var(--color-suave-verde-texto)]",
      valor: "text-[var(--color-positivo-alto)]",
    },
  }[tono];

  return (
    <Link
      to="/comprometido"
      className={`tile-suave ${estilos.fondo} mb-4 flex items-center gap-3 hover:brightness-[0.97] active:scale-[0.99] transition-all`}
    >
      <div className="text-[20px] leading-none flex-shrink-0">{icono}</div>
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] font-semibold uppercase tracking-wide opacity-70 ${estilos.texto}`}>
          {nombreMes} · balance del mes
        </div>
        <p className={`text-[13px] font-bold ${estilos.texto}`}>{titulo}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <span className={`font-serif-num font-bold text-[15px] block ${estilos.valor}`}>
          {formatoCOP(estado.balanceConfirmado)}
        </span>
        <span className={`text-[9.5px] ${estilos.texto} opacity-70`}>ver detalle ›</span>
      </div>
    </Link>
  );
}
