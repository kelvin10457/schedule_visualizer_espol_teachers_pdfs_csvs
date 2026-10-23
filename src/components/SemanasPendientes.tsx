import { useNavigate } from "react-router-dom";
import { NOMBRES_MATERIAS } from "../lib/mallaCurricular";

// Aviso de materias de la carrera cuyas prácticas no tienen indicadas sus semanas, con un
// botón que lleva a completarlas en Configuración.
export default function SemanasPendientes({ codigos, nombres }: { codigos: string[]; nombres: Record<string, string> }) {
    const navigate = useNavigate();
    if (codigos.length === 0) return null;
    return (
        <div className="callout callout-warning" style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                <strong style={{ fontWeight: 600 }}>
                    Falta indicar en qué semanas se dictan las prácticas de {codigos.length} {codigos.length === 1 ? "materia" : "materias"}.
                </strong>{" "}
                Mientras no se indique, se tratan como si fueran todas las semanas, y pueden aparecer cruces que no existen
                (por ejemplo, dos prácticas a la misma hora, una de semanas impares y otra de pares).
                <div style={{ marginTop: 4, color: "var(--text-2)" }}>
                    {codigos.map((c, i) => (
                        <span key={c}>
                            <b style={{ fontWeight: 600, color: "var(--text)" }}>{c}</b> {nombres[c] ?? NOMBRES_MATERIAS[c] ?? ""}
                            {i < codigos.length - 1 ? " · " : ""}
                        </span>
                    ))}
                </div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate("/config", { state: { seccion: "semanas" } })}>
                Completar en Configuración
            </button>
        </div>
    );
}
