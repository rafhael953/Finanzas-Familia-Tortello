import { Component } from "react";

// Sin esto, cualquier error de programacion deja la pantalla completamente
// en blanco: React desmonta todo y no queda ni un mensaje. Paso una vez y
// desde el celular era imposible saber si la app estaba caida, si se habian
// perdido los datos o que. Ahora al menos se ve que fue un error de la app,
// que los datos estan intactos, y queda el texto del fallo para poder
// arreglarlo sin tener que adivinar.
export default class SiAlgoFalla extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div>
          <div className="kicker mb-2">Tortello · Libro de finanzas</div>
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">
            Algo se rompió en la pantalla
          </h1>
          <p className="text-[var(--color-muted)] mt-2 text-sm max-w-sm">
            Es una falla de la aplicación, no de tus datos: todo lo que tienes
            registrado sigue guardado tal cual.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="bg-[var(--color-acento)] text-white rounded-[16px] py-3.5 px-8 font-semibold text-base"
        >
          Volver a intentar
        </button>

        <a
          href="/api/respaldo"
          className="text-xs text-[var(--color-muted)] underline"
        >
          descargar una copia de mis datos
        </a>

        <details className="text-left max-w-sm w-full mt-2">
          <summary className="text-xs text-[var(--color-muted)] cursor-pointer">
            detalle del error (para pasárselo a quien lo arregla)
          </summary>
          <pre className="text-[11px] mt-2 p-3 rounded-[12px] bg-[var(--color-ledger)] border border-[var(--color-ledger-border)] overflow-x-auto whitespace-pre-wrap">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </details>
      </div>
    );
  }
}
