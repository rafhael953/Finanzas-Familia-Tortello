import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Inicio() {
  const navigate = useNavigate();

  function elegir(perfil) {
    localStorage.setItem("perfil", perfil);
    navigate(perfil === "rafael" ? "/rafael" : "/jerardith");
  }

  async function salir() {
    await api.logout().catch(() => {});
    window.location.reload();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <div className="kicker mb-2">Tortello García</div>
        <h1 className="font-serif text-[32px] font-semibold tracking-tight">Libro de finanzas</h1>
        <p className="text-[var(--color-muted)] mt-1 text-sm">¿Quién eres?</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <button
          onClick={() => elegir("rafael")}
          className="bg-[var(--color-acento)] text-white rounded-[22px] py-7 text-lg font-bold tracking-tight active:scale-95 shadow-sm hover:shadow-md transition-all"
        >
          Rafael
        </button>
        <button
          onClick={() => elegir("jerardith")}
          className="bg-[var(--color-suave-rojo)] text-[var(--color-suave-rojo-texto)] rounded-[22px] py-7 text-lg font-bold tracking-tight active:scale-95 shadow-sm hover:shadow-md transition-all"
        >
          Jerardith
        </button>
      </div>

      <button onClick={salir} className="text-xs text-[var(--color-muted)] underline">
        cerrar sesión
      </button>
    </div>
  );
}
