import { formatoCOP, formatoQuincenaCorta } from "../api";

// Linea encadenada del balance a lo largo de un semestre: unas quincenas
// atras (reales), la actual, y varias adelante proyectadas con el plan de
// hoy repetido "si nada cambia". Nace de que ver "agosto bien, septiembre
// critico" como dos cuadros sueltos no tenia sentido: lo que sobra en una
// quincena es justo lo que sostiene (o no) la siguiente, asi que esto se ve
// como una sola linea, no como meses aislados (ver trayectoriaBalance en
// server/asesor.js).
export default function TrayectoriaBalance({ trayectoria }) {
  if (!trayectoria) return null;
  const { puntos, primerRiesgoId } = trayectoria;

  const tono = primerRiesgoId ? "ambar" : "verde";
  const estilos = {
    ambar: {
      fondo: "bg-[var(--color-suave-ambar)]",
      texto: "text-[var(--color-suave-ambar-texto)]",
    },
    verde: {
      fondo: "bg-[var(--color-suave-verde)]",
      texto: "text-[var(--color-suave-verde-texto)]",
    },
  }[tono];

  const puntoRiesgo = puntos.find((p) => p.quincenaId === primerRiesgoId);

  return (
    <div className={`tile-suave ${estilos.fondo} mb-4`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide opacity-70 ${estilos.texto}`}>
        Trayectoria · próximos meses
      </div>

      {primerRiesgoId ? (
        <p className={`text-[13px] font-bold mt-1 ${estilos.texto}`}>
          ⚠ Con el plan de hoy, el balance se pone en rojo en {formatoQuincenaCorta(primerRiesgoId)}
          {puntoRiesgo && ` (${formatoCOP(puntoRiesgo.balance)})`}. Lo que sobre ahora es para
          sostener eso, no para gastarlo ya.
        </p>
      ) : (
        <p className={`text-[13px] font-bold mt-1 ${estilos.texto}`}>
          ✅ Con el plan de hoy, la línea se mantiene sana en los próximos meses. Lo que sobre de
          verdad es margen para ahorrar.
        </p>
      )}

      {puntos.some((p) => p.tipo === "real" && p.balance < 0) && (
        <p className={`text-[10.5px] mt-1 opacity-70 ${estilos.texto}`}>
          Un número en rojo de una quincena ya pasada es historia, no un riesgo hacia
          adelante — el mensaje de arriba solo mira lo que viene.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
        {puntos.map((p) => {
          const esActual = p.tipo === "actual";
          const negativo = p.balance < 0;
          return (
            <div
              key={p.quincenaId}
              className={`flex-shrink-0 rounded-xl px-2.5 py-1.5 text-center ${
                esActual ? "bg-[var(--color-fondo)]/70 ring-2 ring-[var(--color-texto)]/15" : "bg-[var(--color-fondo)]/40"
              } ${p.tipo === "proyectado" ? "opacity-80" : ""}`}
            >
              <div className={`text-[9.5px] font-semibold ${estilos.texto} opacity-70`}>
                {formatoQuincenaCorta(p.quincenaId)}
              </div>
              <div
                className={`font-serif-num text-[11.5px] font-bold mt-0.5 ${
                  negativo ? "text-[var(--color-negativo-alto)]" : estilos.texto
                }`}
              >
                {formatoCOP(p.balance)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
