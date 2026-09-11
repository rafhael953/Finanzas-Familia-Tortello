import { formatoCOP, NOMBRES_MES } from "../api";

// Veredicto crudo del mes completo (las dos quincenas juntas) -- lo primero
// que Rafael quiere ver, antes de entrar a registrar nada: si el mes va a
// alcanzar con lo estimado, si toca frenar, o si ya hay margen para
// ahorrar. Los datos vienen de calcularEstadoMensual en el servidor.
export default function EstadoMensual({ estado }) {
  if (!estado) return null;

  const [, mesNum] = estado.mes.split("-");
  const nombreMes = NOMBRES_MES[Number(mesNum)];

  let tono, icono, titulo, detalle;

  if (estado.riesgoGasto) {
    tono = "rojo";
    icono = "🛑";
    titulo = "Este mes no va a alcanzar";
    detalle = `Con lo comprometido (fijos, cuotas y lo ya gastado) faltan ${formatoCOP(
      -estado.sobranteSeguro
    )} frente a lo que de verdad ha entrado. Frena gasto extra ya.`;
  } else if (estado.balanceProyectado < 0) {
    tono = "ambar";
    icono = "⚠";
    titulo = "Ojo con lo que falta por confirmar";
    detalle = `Si se cumple todo lo pendiente, el mes cierra en rojo: ${formatoCOP(
      estado.balanceProyectado
    )}. Todavía hay margen para ajustar.`;
  } else if (estado.sobrante > 0) {
    tono = "verde";
    icono = "✅";
    titulo = "Vas bien este mes";
    detalle = `Con lo confirmado hay ${formatoCOP(
      estado.sobrante
    )} de margen seguro sobre lo comprometido. Es un buen momento para mover algo a ahorro.`;
  } else {
    tono = "verde";
    icono = "🙂";
    titulo = "Vas cubierto, sin margen extra";
    detalle = "Lo comprometido del mes cabe exacto en lo que ha entrado. Nada que mover a ahorro todavía, pero tampoco hay riesgo.";
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
    <div className={`tile-suave ${estilos.fondo} mb-4`}>
      <div className="flex gap-3 items-start">
        <div className="text-[22px] leading-none flex-shrink-0">{icono}</div>
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-semibold uppercase tracking-wide opacity-70 ${estilos.texto}`}>
            {nombreMes} · balance del mes
          </div>
          <p className={`text-[14px] font-bold mt-0.5 ${estilos.texto}`}>{titulo}</p>
          <p className={`text-[12.5px] mt-1 ${estilos.texto} opacity-90`}>{detalle}</p>

          <div className="flex justify-between items-baseline mt-3 pt-2 border-t border-black/10">
            <span className={`text-[11px] font-semibold ${estilos.texto} opacity-70`}>
              Balance al día
            </span>
            <span className={`font-serif-num font-bold text-[20px] ${estilos.valor}`}>
              {formatoCOP(estado.balanceConfirmado)}
            </span>
          </div>
          {estado.balanceProyectado !== estado.balanceConfirmado && (
            <div className="flex justify-between items-baseline mt-1">
              <span className={`text-[11px] ${estilos.texto} opacity-70`}>
                Proyectado si se cumple lo pendiente
              </span>
              <span className={`font-serif-num font-semibold text-[13px] ${estilos.texto}`}>
                {formatoCOP(estado.balanceProyectado)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
