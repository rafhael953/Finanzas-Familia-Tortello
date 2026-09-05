import { useState } from "react";
import { api } from "../api";

export default function Login({ onIngreso }) {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const res = await api.login(usuario, clave);
      onIngreso(res.usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <div className="kicker mb-2">Tortello García</div>
        <h1 className="font-serif text-[30px] font-semibold tracking-tight">Libro de finanzas</h1>
        <p className="text-[var(--color-muted)] mt-1 text-sm">Acceso privado de la familia</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm ledger-card p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Usuario</label>
          <input
            type="text"
            autoFocus
            autoCapitalize="words"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Rafael T"
            className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Contraseña</label>
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="••••••••"
            className="border border-[var(--color-ledger-border)] rounded-md px-4 py-3 text-base bg-[var(--color-fondo)]/40"
          />
        </div>

        {error && <p className="text-[var(--color-negativo)] text-sm">{error}</p>}

        <button
          type="submit"
          disabled={cargando || !usuario || !clave}
          className="bg-[var(--color-acento)] text-white rounded-md py-3.5 font-semibold text-base disabled:opacity-50 mt-2"
        >
          {cargando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
