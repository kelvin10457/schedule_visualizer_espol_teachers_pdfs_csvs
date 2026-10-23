interface FilterSelectProps {
    options: { value: string; label: string }[];
    value: string; // "ALL" o el value de una opción
    onChange: (value: string) => void;
    allLabel: string;
    width?: number;
    label: string;
}

// Lista desplegable para los filtros del horario (Tipo / Nivel / Profesor), con una
// primera opción fija "Todos los X".
export default function FilterSelect({ options, value, onChange, allLabel, width = 220, label }: FilterSelectProps) {
    return (
        <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={{ width }}>
            <option value="ALL">{allLabel}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
