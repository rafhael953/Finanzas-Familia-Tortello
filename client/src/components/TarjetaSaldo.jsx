import { formatoCOP } from "../api";

export default function TarjetaSaldo({ titulo, valor, subtitulo, tono = "neutro" }) {
  const colorValor =
    tono === "positivo"
      ? "text-[var(--color-positivo)]"
      : tono === "negativo"
      ? "text-[var(--color-negativo)]"
      : "text-[var(--color-texto)]";

  return (
    <div className="flex flex-col gap-1">
      <span className="kicker">{titulo}</span>
      <span className={`font-serif-num text-4xl font-bold leading-none ${colorValor}`}>
        {typeof valor === "number" ? formatoCOP(valor) : valor}
      </span>
      {subtitulo && <span className="text-xs text-[var(--color-muted)] mt-1">{subtitulo}</span>}
    </div>
  );
}
