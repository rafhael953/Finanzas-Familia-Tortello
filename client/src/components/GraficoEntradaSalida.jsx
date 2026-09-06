import { formatoCOP } from "../api";

// Dos barras por mes, entrada contra salida, sobre un eje comun. Es la
// grafica que responde de un vistazo la pregunta que mas importa: ¿en que
// meses gaste mas de lo que entro? Los meses en rojo saltan solos.
export default function GraficoEntradaSalida({ meses, etiquetaMes }) {
  if (!meses || meses.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--color-muted)]">
        Sin datos suficientes todavía
      </p>
    );
  }

  const max = Math.max(...meses.map((m) => Math.max(m.ingreso, m.salida)), 1);

  return (
    <div>
      {meses.map((m) => {
        const negativo = m.salida > m.ingreso;
        return (
          <div key={m.mes} className="py-2.5 dashed-row">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[12.5px] text-[var(--color-muted)] flex items-center gap-1.5">
                {etiquetaMes(m.mes)}
                {negativo && (
                  <span className="text-[10px] uppercase font-semibold text-[var(--color-negativo)]">
                    en rojo
                  </span>
                )}
              </span>
              <span
                className={`font-serif-num font-semibold text-[13px] ${
                  negativo ? "text-[var(--color-negativo)]" : "text-[var(--color-positivo)]"
                }`}
              >
                {formatoCOP(m.ingreso - m.salida)}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] w-[38px] text-[var(--color-muted)] flex-shrink-0">
                entró
              </span>
              <div className="flex-1 h-[9px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full barra-crece"
                  style={{
                    width: `${(m.ingreso / max) * 100}%`,
                    background: "var(--color-positivo)",
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] w-[38px] text-[var(--color-muted)] flex-shrink-0">
                salió
              </span>
              <div className="flex-1 h-[9px] bg-[var(--color-ledger-rule)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full barra-crece"
                  style={{
                    width: `${(m.salida / max) * 100}%`,
                    background: negativo ? "var(--color-negativo)" : "var(--color-acento)",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
