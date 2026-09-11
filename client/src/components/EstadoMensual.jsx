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
// que Rafael quiere ver, antes de entrar a registrar nada: si el mes va a
// alcanzar con lo estimado, si toca frenar, o si ya hay margen para
// ahorrar. Los datos vienen de calcularEstadoMensual en el servidor.
export default function EstadoMensual({ estado }) {
  if (!estado) return null;

  const [, mesNum] = estado.mes.split("-");
  const nombreMes = NOMBRES_MES[Number(mesNum)];

  // sobranteSeguro YA es un balance esperado (saldo inicial + lo confirmado
  // - TODO lo comprometido, se haya registrado o no): es la misma cifra que
  // sustenta el mensaje de riesgo, asi que se muestra esa, no
  // balanceProyectado (que solo cuenta lo que ya quedo registrado como
  // pendiente -- al principio del mes eso da un numero mas optimista de lo
  // real, porque la mayoria de fijos y cuotas del mes todavia no se han
  // registrado como movimiento aunque ya se sabe que van a caer).
  const ratio =
    estado.egresoEsperadoTotal > 0 ? estado.sobranteSeguro / estado.egresoEsperadoTotal : 0;

  let tono, icono, titulo, detalle;

  if (ratio <= -UMBRAL_LIMITE) {
    tono = "rojo";
    icono = "🛑";
    titulo = "Este mes no va a alcanzar";
    detalle = `Con lo comprometido (fijos, cuotas y lo ya gastado) faltan ${formatoCOP(
      -estado.sobranteSeguro
    )} frente a lo que de verdad ha entrado. Frena gasto extra ya.`;
  } else if (ratio < 0) {
    tono = "ambar";
    icono = "⚠";
    titulo = "Estás al límite este mes";
    detalle = `Faltan ${formatoCOP(
      -estado.sobranteSeguro
    )} para cubrir lo comprometido — es poco frente al total del mes. Con un ajuste chico en algún rubro cierras bien.`;
  } else if (ratio < UMBRAL_SIN_MARGEN) {
    tono = "verde";
    icono = "🙂";
    titulo = "Vas cubierto, sin margen extra";
    detalle = "Lo comprometido del mes cabe casi exacto en lo que ha entrado. Nada que mover a ahorro todavía, pero tampoco hay riesgo.";
  } else {
    tono = "verde";
    icono = "✅";
    titulo = "Vas bien este mes";
    detalle = `Con lo confirmado hay ${formatoCOP(
      estado.sobrante
    )} de margen seguro sobre lo comprometido. Es un buen momento para mover algo a ahorro.`;
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
          <div className="flex justify-between items-baseline mt-1">
            <span className={`text-[11px] ${estilos.texto} opacity-70`}>
              Balance esperado si se cumple lo comprometido
            </span>
            <span
              className={`font-serif-num font-semibold text-[13px] ${
                estado.sobranteSeguro < 0 ? estilos.valor : estilos.texto
              }`}
            >
              {formatoCOP(estado.sobranteSeguro)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
