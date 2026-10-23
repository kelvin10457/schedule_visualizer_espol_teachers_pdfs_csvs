import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getStorageItem, setStorageItem } from "../lib/storage";
import {
    DEFAULT_MALLA_CURRICULAR,
    DEFAULT_SEMANAS_PRACTICAS,
    MALLA_CURRICULAR_STORAGE_KEY,
    NOMBRES_MATERIAS,
    SEMANAS_PARALELOS_STORAGE_KEY,
    SEMANAS_PRACTICAS_STORAGE_KEY,
    claveParalelo,
    type SemanasPracticas,
} from "../lib/mallaCurricular";
import Subject from "../models/Subject";
import { CURRENT_SUBJECTS_KEY, RELACION_PRACTICAS_KEY } from "../lib/constants";
import {
    detectarRelaciones,
    getRelacionesGuardadas,
    getSemanasGuardadas,
    getSemanasParalelosGuardadas,
    loadCurrentSchedule,
    profesoresDeCarrera,
    type RelacionPracticas,
} from "../lib/parseReport";
import { findProfessorConflicts } from "../lib/conflicts";

interface MateriaRow {
    id: number;
    codigo: string;
    nivel: string;
    // "" = usar lo detectado en el archivo.
    relacion: RelacionPracticas | "";
}

interface SemanasRow {
    id: number;
    codigo: string;
    // Valor de la materia, para todas sus prácticas. "" = no se sabe.
    semanas: SemanasPracticas | "";
    // Valor de cada paralelo de práctica; "" = igual que la materia.
    paralelos: Record<number, SemanasPracticas | "">;
    // Si se muestra la lista de paralelos.
    abierto: boolean;
}

// Un paralelo de práctica del archivo, con su descripción para la lista.
interface ParaleloInfo {
    paralelo: number;
    detalle: string;
}

const RELACION_TEXTO: Record<RelacionPracticas, string> = {
    cualquiera: "Cualquier práctica de la materia",
    emparejadas: "Solo la práctica de su teoría (1→101, 2→102…)",
};

const RELACION_CORTA: Record<RelacionPracticas, string> = {
    cualquiera: "cualquier práctica",
    emparejadas: "solo la práctica de su teoría",
};

const SEMANAS_TEXTO: { value: SemanasPracticas | ""; label: string }[] = [
    { value: "", label: "No se sabe" },
    { value: "todas", label: "Todas las semanas" },
    { value: "impares", label: "Semanas impares (1ª quincena)" },
    { value: "pares", label: "Semanas pares (2ª quincena)" },
];

// Niveles de la malla curricular, para la lista desplegable de nivel.
const NIVELES_MALLA = [
    "NIVEL 100 - I",
    "NIVEL 100 - II",
    "NIVEL 200 - I",
    "NIVEL 200 - II",
    "NIVEL 300 - I",
    "NIVEL 300 - II",
    "NIVEL 400 - I",
    "NIVEL 400 - II",
    "NIVEL 500 - I",
    "NIVEL 500 - II",
];

const MATERIAS_COLUMNS = "110px minmax(0, 1.3fr) minmax(0, 0.9fr) minmax(0, 1.5fr) 32px";
const SEMANAS_COLUMNS = "110px minmax(0, 1.5fr) minmax(0, 1fr) 130px 32px";

const SEMANAS_CORTO: Record<SemanasPracticas | "", string> = {
    "": "no se sabe",
    todas: "todas las semanas",
    impares: "semanas impares",
    pares: "semanas pares",
};

const ESTILO_PENDIENTE = { backgroundColor: "var(--q1-soft)", borderColor: "var(--q1-border)", color: "var(--q1)" } as const;

// Paralelos de práctica de cada materia en el archivo: profesor, horarios y aula.
function paralelosPorCodigo(subjects: Subject[]): Record<string, ParaleloInfo[]> {
    const grupos = new Map<string, Subject[]>();
    for (const s of subjects) {
        if (s.tipo !== "PRACTICO") continue;
        const key = claveParalelo(s.codigo_materia, s.paralelo);
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key)!.push(s);
    }
    const out: Record<string, ParaleloInfo[]> = {};
    for (const filas of grupos.values()) {
        const { codigo_materia, paralelo, profesor } = filas[0];
        const horarios = filas.map((f) => `${f.dia} ${f.hora_inicio.slice(0, 5)}-${f.hora_fin.slice(0, 5)}`).join(", ");
        const aulas = Array.from(new Set(filas.map((f) => f.aula).filter(Boolean))).join(", ");
        (out[codigo_materia] ??= []).push({ paralelo, detalle: `${profesor} · ${horarios}${aulas ? ` · aula ${aulas}` : ""}` });
    }
    for (const lista of Object.values(out)) lista.sort((a, b) => a.paralelo - b.paralelo);
    return out;
}

function mallaToRows(malla: Record<string, string>, relaciones: Record<string, RelacionPracticas>, nextId: () => number): MateriaRow[] {
    return Object.entries(malla)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([codigo, nivel]) => ({ id: nextId(), codigo, nivel, relacion: relaciones[codigo] ?? "" }));
}

// Filas de semanas: las materias con valor guardado, las prácticas de la carrera que trae
// el archivo y las de otras carreras que aparecen en un cruce de profesores, para que se
// vea cuáles faltan por indicar.
function semanasToRows(
    semanas: Record<string, SemanasPracticas>,
    semanasParalelos: Record<string, SemanasPracticas>,
    malla: Record<string, string>,
    subjects: Subject[],
    enCruces: string[],
    nextId: () => number,
): SemanasRow[] {
    const porParalelo: Record<string, Record<number, SemanasPracticas>> = {};
    for (const [clave, valor] of Object.entries(semanasParalelos)) {
        const [codigo, paralelo] = clave.split("|");
        (porParalelo[codigo] ??= {})[Number(paralelo)] = valor;
    }
    const codigos = new Set([...Object.keys(semanas), ...Object.keys(porParalelo), ...enCruces]);
    for (const s of subjects) if (s.tipo === "PRACTICO" && malla[s.codigo_materia]) codigos.add(s.codigo_materia);
    return Array.from(codigos)
        .sort((a, b) => a.localeCompare(b))
        .map((codigo) => {
            const paralelos = porParalelo[codigo] ?? {};
            return { id: nextId(), codigo, semanas: semanas[codigo] ?? "", paralelos, abierto: Object.keys(paralelos).length > 0 };
        });
}

function DeleteButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            className="btn btn-danger-ghost"
            onClick={onClick}
            title="Eliminar"
            aria-label="Eliminar fila"
            style={{ padding: 0, width: 32 }}
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
        </button>
    );
}

function TableHeader({ columns, labels }: { columns: string; labels: string[] }) {
    return (
        <div
            className="eyebrow"
            style={{
                display: "grid",
                gridTemplateColumns: columns,
                gap: 8,
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
                borderRadius: "8px 8px 0 0",
            }}
        >
            {labels.map((l, i) => (
                <span key={i}>{l}</span>
            ))}
        </div>
    );
}

// Prácticas sin semanas indicadas que aparecen en algún cruce de profesores de la carrera.
async function practicasEnCruces(): Promise<string[]> {
    const { carrera, todas } = await loadCurrentSchedule();
    const set = new Set<string>();
    for (const g of findProfessorConflicts(todas, profesoresDeCarrera(carrera))) {
        for (const c of g.conflicts) {
            for (const x of [c.a, c.b]) {
                if (x.meeting.row.tipo === "PRACTICO" && x.meeting.row.planificada_quincenalmente === "DESCONOCIDA")
                    set.add(x.section.codigoMateria);
            }
        }
    }
    return Array.from(set);
}

export default function Config() {
    const navigate = useNavigate();
    const location = useLocation();
    // Si se llega desde un aviso de semanas pendientes, se baja directo a esa tabla.
    const irASemanas = (location.state as { seccion?: string } | null)?.seccion === "semanas";
    const semanasRef = useRef<HTMLElement>(null);
    const [enCruces, setEnCruces] = useState<Set<string>>(new Set());
    const [rows, setRows] = useState<MateriaRow[]>([]);
    const [semanasRows, setSemanasRows] = useState<SemanasRow[]>([]);
    // Datos del archivo cargado: relación teoría–práctica detectada y nombres de materias.
    const [detectadas, setDetectadas] = useState<Record<string, RelacionPracticas>>({});
    const [nombresArchivo, setNombresArchivo] = useState<Record<string, string>>({});
    const [paralelosArchivo, setParalelosArchivo] = useState<Record<string, ParaleloInfo[]>>({});
    const [loaded, setLoaded] = useState(false);
    const [highlightId, setHighlightId] = useState<number | null>(null);

    const idCounter = useRef(0);
    const nextId = () => ++idCounter.current;

    const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const codigoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    useEffect(() => {
        Promise.all([
            getStorageItem(MALLA_CURRICULAR_STORAGE_KEY, DEFAULT_MALLA_CURRICULAR),
            getRelacionesGuardadas(),
            getSemanasGuardadas(),
            getSemanasParalelosGuardadas(),
            getStorageItem<Subject[]>(CURRENT_SUBJECTS_KEY, []),
            practicasEnCruces(),
        ]).then(([malla, relaciones, semanas, semanasParalelos, subjects, cruces]) => {
            setRows(mallaToRows(malla, relaciones, nextId));
            setSemanasRows(semanasToRows(semanas, semanasParalelos, malla, subjects, cruces, nextId));
            setParalelosArchivo(paralelosPorCodigo(subjects));
            setEnCruces(new Set(cruces));
            setDetectadas(detectarRelaciones(subjects));
            const nombres: Record<string, string> = {};
            for (const s of subjects) nombres[s.codigo_materia] ??= s.materia;
            setNombresArchivo(nombres);
            setLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (loaded && irASemanas) semanasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [loaded, irASemanas]);

    // Guardado automático: cada cambio se guarda al momento, así no se pierde nada al salir.
    useEffect(() => {
        if (!loaded) return;
        const malla: Record<string, string> = {};
        const relaciones: Record<string, RelacionPracticas> = {};
        for (const row of rows) {
            const codigo = row.codigo.trim().toUpperCase();
            const nivel = row.nivel.trim().toUpperCase();
            if (codigo && nivel) malla[codigo] = nivel;
            if (codigo && nivel && row.relacion) relaciones[codigo] = row.relacion;
        }
        const semanas: Record<string, SemanasPracticas> = {};
        const semanasParalelos: Record<string, SemanasPracticas> = {};
        for (const row of semanasRows) {
            const codigo = row.codigo.trim().toUpperCase();
            if (!codigo) continue;
            if (row.semanas) semanas[codigo] = row.semanas;
            for (const [paralelo, valor] of Object.entries(row.paralelos)) {
                if (valor) semanasParalelos[claveParalelo(codigo, Number(paralelo))] = valor;
            }
        }
        setStorageItem(MALLA_CURRICULAR_STORAGE_KEY, malla);
        setStorageItem(RELACION_PRACTICAS_KEY, relaciones);
        setStorageItem(SEMANAS_PRACTICAS_STORAGE_KEY, semanas);
        setStorageItem(SEMANAS_PARALELOS_STORAGE_KEY, semanasParalelos);
    }, [loaded, rows, semanasRows]);

    useEffect(() => {
        if (highlightId == null) return;
        rowRefs.current[highlightId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        codigoInputRefs.current[highlightId]?.focus();
    }, [highlightId]);

    // Niveles de la malla más cualquier otro que ya esté guardado.
    const nivelOptions = useMemo(() => {
        const set = new Set([...NIVELES_MALLA, ...rows.map((r) => r.nivel.trim().toUpperCase()).filter(Boolean)]);
        return Array.from(set).sort();
    }, [rows]);

    function nombreDe(codigo: string): string {
        const c = codigo.trim().toUpperCase();
        return nombresArchivo[c] ?? NOMBRES_MATERIAS[c] ?? "";
    }

    function updateRow(id: number, field: "codigo" | "nivel" | "relacion", value: string) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    }

    function updateSemanasRow(id: number, changes: Partial<Omit<SemanasRow, "id">>) {
        setSemanasRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    }

    function updateParalelo(row: SemanasRow, paralelo: number, value: SemanasPracticas | "") {
        updateSemanasRow(row.id, { paralelos: { ...row.paralelos, [paralelo]: value } });
    }

    // Paralelos de práctica que siguen sin semanas: sin valor propio ni de la materia.
    function paralelosPendientes(row: SemanasRow): number {
        if (row.semanas) return 0;
        const lista = paralelosArchivo[row.codigo.trim().toUpperCase()] ?? [];
        if (lista.length === 0) return 1;
        return lista.filter((p) => !row.paralelos[p.paralelo]).length;
    }

    function removeRow(id: number) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        delete rowRefs.current[id];
        delete codigoInputRefs.current[id];
    }

    function removeSemanasRow(id: number) {
        setSemanasRows((prev) => prev.filter((r) => r.id !== id));
        delete rowRefs.current[id];
        delete codigoInputRefs.current[id];
    }

    function addRow() {
        const row: MateriaRow = { id: nextId(), codigo: "", nivel: "", relacion: "" };
        setRows((prev) => [...prev, row]);
        setHighlightId(row.id);
    }

    function addSemanasRow() {
        const row: SemanasRow = { id: nextId(), codigo: "", semanas: "", paralelos: {}, abierto: false };
        setSemanasRows((prev) => [...prev, row]);
        setHighlightId(row.id);
    }

    async function handleReset() {
        if (
            !window.confirm(
                "Se reemplazarán las materias de la carrera y las semanas de las prácticas por los valores originales. ¿Continuar?",
            )
        ) {
            return;
        }
        const subjects = await getStorageItem<Subject[]>(CURRENT_SUBJECTS_KEY, []);
        setRows(mallaToRows(DEFAULT_MALLA_CURRICULAR, {}, nextId));
        setSemanasRows(semanasToRows(DEFAULT_SEMANAS_PRACTICAS, {}, DEFAULT_MALLA_CURRICULAR, subjects, Array.from(enCruces), nextId));
    }

    function rowProps(id: number, columns: string) {
        return {
            ref: (el: HTMLDivElement | null) => {
                rowRefs.current[id] = el;
            },
            onAnimationEnd: () => setHighlightId((current) => (current === id ? null : current)),
            className: id === highlightId ? "row-added" : undefined,
            style: { display: "grid", gridTemplateColumns: columns, gap: 8, alignItems: "center" },
        };
    }

    function codigoInput(id: number, value: string, onChange: (v: string) => void) {
        return (
            <input
                ref={(el) => {
                    codigoInputRefs.current[id] = el;
                }}
                className="input"
                value={value}
                placeholder="ELEG1028"
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }

    const nombreStyle = { fontSize: 12, color: "var(--text-2)", lineHeight: 1.3 } as const;
    const faltan = semanasRows.filter((r) => r.codigo.trim() && paralelosPendientes(r) > 0).length;
    const codigosCarrera = new Set(rows.map((r) => r.codigo.trim().toUpperCase()));

    return (
        <div className="page" style={{ padding: "32px 16px 60px" }}>
            <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Configuración</h1>
                        <p className="section-desc" style={{ maxWidth: 680 }}>
                            Los cambios se guardan automáticamente en este navegador y se aplican al horario cargado.
                        </p>
                    </div>
                    <button className="btn" onClick={() => navigate(-1)}>
                        Volver
                    </button>
                </div>

                <div className="callout callout-info">
                    <strong style={{ fontWeight: 600 }}>Cómo usar esta página</strong>
                    <p style={{ margin: "4px 0" }}>
                        El reporte de horarios solo trae aula, profesor, materia, paralelo, día y hora. Lo que falta para analizar bien la
                        carrera se completa aquí:
                    </p>
                    <ol style={{ margin: 0, paddingLeft: 20, listStyle: "decimal" }}>
                        <li>
                            <b>Materias de la carrera:</b> revisa que estén todas las materias y su nivel. Ya vienen las ELEG y EYAG de la
                            malla de Electricidad. Solo estas materias se muestran en el horario y en «¿Se puede tomar todo un nivel?».
                        </li>
                        <li>
                            <b>Semanas de las prácticas:</b> completa las materias resaltadas en naranja. Si todas sus prácticas se dictan
                            en las mismas semanas, elige el valor de la materia; si cada paralelo es distinto (por ejemplo, la 101 en
                            semanas impares y la 102 en pares), usa <i>Por paralelo</i>.
                            {faltan > 0 ? ` Faltan ${faltan} materias.` : " Ya están todas."} Cada una que completes puede eliminar cruces
                            falsos entre profesores.
                        </li>
                        <li>Vuelve al horario o a Cruces: los cambios se aplican solos.</li>
                    </ol>
                </div>

                {/* ── Materias de la carrera ── */}
                <section>
                    <h2 className="section-title">Materias de la carrera</h2>
                    <p className="section-desc" style={{ maxWidth: 760 }}>
                        Solo las materias de esta lista se consideran de la carrera; por defecto, las materias ELEG y EYAG de la malla de
                        Electricidad.
                    </p>
                    <ul className="section-desc" style={{ maxWidth: 760, margin: "8px 0 12px", paddingLeft: 18, listStyle: "disc" }}>
                        <li>
                            <b>Nivel:</b> el nivel de la materia en la malla curricular.
                        </li>
                        <li>
                            <b>Prácticas que puede tomar el estudiante:</b> si un estudiante inscrito en una teoría puede elegir cualquier
                            práctica de la materia (por ejemplo, en ELEG1028 la teoría 1 o la 2 con cualquiera de las prácticas 101 a 107),
                            o solo la práctica que corresponde a su teoría (por ejemplo, la teoría 2 solo con la práctica 102). El reporte
                            no trae este dato: en <i>Automático</i> la herramienta lo deduce de la numeración de los paralelos y muestra lo
                            que detectó en el archivo cargado. Elige otra opción si lo detectado no es correcto.
                        </li>
                    </ul>

                    <div className="card">
                        <TableHeader
                            columns={MATERIAS_COLUMNS}
                            labels={["Código", "Materia", "Nivel", "Prácticas que puede tomar el estudiante", ""]}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 16px" }}>
                            {rows.map((row) => (
                                <div key={row.id} {...rowProps(row.id, MATERIAS_COLUMNS)}>
                                    {codigoInput(row.id, row.codigo, (v) => updateRow(row.id, "codigo", v))}
                                    <span style={nombreStyle}>{nombreDe(row.codigo)}</span>
                                    <select
                                        className="input"
                                        aria-label="Nivel"
                                        value={row.nivel}
                                        onChange={(e) => updateRow(row.id, "nivel", e.target.value)}
                                    >
                                        <option value="">Elige un nivel...</option>
                                        {nivelOptions.map((n) => (
                                            <option key={n} value={n}>
                                                {n}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        className="input"
                                        value={row.relacion}
                                        onChange={(e) => updateRow(row.id, "relacion", e.target.value)}
                                    >
                                        <option value="">
                                            {(() => {
                                                const detectado = detectadas[row.codigo.trim().toUpperCase()];
                                                return detectado
                                                    ? `Automático: ${RELACION_CORTA[detectado]}`
                                                    : "Automático: sin prácticas en el archivo";
                                            })()}
                                        </option>
                                        {(Object.keys(RELACION_TEXTO) as RelacionPracticas[]).map((r) => (
                                            <option key={r} value={r}>
                                                {RELACION_TEXTO[r]}
                                            </option>
                                        ))}
                                    </select>
                                    <DeleteButton onClick={() => removeRow(row.id)} />
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: "0 16px 16px" }}>
                            <button
                                className="btn btn-ghost"
                                onClick={addRow}
                                style={{ width: "100%", border: "1px dashed var(--border-strong)" }}
                            >
                                + Agregar materia
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Semanas de las prácticas ── */}
                <section ref={semanasRef} style={{ scrollMarginTop: 16 }}>
                    <h2 className="section-title">
                        Semanas de las prácticas (laboratorios)
                        {faltan > 0 && (
                            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: "var(--q1)" }}>
                                Faltan {faltan} por indicar
                            </span>
                        )}
                    </h2>
                    <p className="section-desc" style={{ maxWidth: 760 }}>
                        Algunas prácticas no se dictan todas las semanas, sino en semanas impares o pares. Dos prácticas a la misma hora,
                        una en semanas impares y otra en pares, nunca coinciden, así que no se cuentan como cruce. La semana es de cada{" "}
                        <b>paralelo</b>: una misma materia puede tener prácticas en semanas impares y otras en pares. El reporte no trae
                        este dato; los valores iniciales por materia vienen de la tabla de laboratorios de la coordinación.
                    </p>
                    <ul className="section-desc" style={{ maxWidth: 760, margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>
                        <li>
                            <b>Valor de la materia:</b> se aplica a todas sus prácticas. <b>Por paralelo</b> abre la lista de sus prácticas
                            en el archivo (profesor, día, hora y aula) para indicar cada una; lo indicado en un paralelo tiene prioridad
                            sobre el valor de la materia.
                        </li>
                        <li>
                            Lo que queda en <i>No se sabe</i> se trata como si fuera todas las semanas, y puede aparecer un cruce que no
                            existe. La herramienta no adivina semanas: aunque dos prácticas compartan aula y hora, siguen apareciendo como
                            cruce hasta que se indiquen, porque también puede ser un error de planificación.
                        </li>
                    </ul>
                    <p className="section-desc" style={{ maxWidth: 760, margin: "6px 0 12px" }}>
                        Aparecen las materias de la carrera con prácticas en el archivo, las que ya tienen un valor y las de otras carreras
                        que aparecen en un cruce de un profesor de la carrera. También puedes agregar otras con
                        <i> + Agregar materia</i>.
                    </p>

                    <div className="card">
                        <TableHeader columns={SEMANAS_COLUMNS} labels={["Código", "Materia", "Semanas (valor de la materia)", "", ""]} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 16px" }}>
                            {semanasRows.map((row) => {
                                const lista = paralelosArchivo[row.codigo.trim().toUpperCase()] ?? [];
                                const pendientes = paralelosPendientes(row);
                                const conValorPropio = lista.filter((p) => row.paralelos[p.paralelo]).length;
                                return (
                                    <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <div {...rowProps(row.id, SEMANAS_COLUMNS)}>
                                            {codigoInput(row.id, row.codigo, (v) => updateSemanasRow(row.id, { codigo: v }))}
                                            <span style={nombreStyle}>
                                                {nombreDe(row.codigo)}
                                                {row.codigo.trim() && !codigosCarrera.has(row.codigo.trim().toUpperCase()) && (
                                                    <span style={{ color: "var(--text-3)" }}>
                                                        {enCruces.has(row.codigo.trim().toUpperCase())
                                                            ? " · otra carrera, aparece en un cruce"
                                                            : " · otra carrera"}
                                                    </span>
                                                )}
                                            </span>
                                            <select
                                                className="input"
                                                aria-label="Semanas de las prácticas de la materia"
                                                value={row.semanas}
                                                onChange={(e) =>
                                                    updateSemanasRow(row.id, { semanas: e.target.value as SemanasPracticas | "" })
                                                }
                                                style={pendientes > 0 ? ESTILO_PENDIENTE : undefined}
                                            >
                                                {SEMANAS_TEXTO.map((o) => (
                                                    <option key={o.value} value={o.value}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => updateSemanasRow(row.id, { abierto: !row.abierto })}
                                                disabled={lista.length === 0}
                                                title={
                                                    lista.length === 0 ? "El archivo cargado no trae prácticas de esta materia" : undefined
                                                }
                                                style={{ fontSize: 12, padding: "0 8px" }}
                                            >
                                                {row.abierto ? "▾" : "▸"} Por paralelo
                                                {lista.length > 0 ? ` (${conValorPropio}/${lista.length})` : ""}
                                            </button>
                                            <DeleteButton onClick={() => removeSemanasRow(row.id)} />
                                        </div>
                                        {row.abierto && lista.length > 0 && (
                                            <div
                                                style={{
                                                    marginLeft: 118,
                                                    padding: "8px 10px",
                                                    borderLeft: "2px solid var(--border)",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 6,
                                                }}
                                            >
                                                {lista.map((p) => {
                                                    const valor = row.paralelos[p.paralelo] ?? "";
                                                    return (
                                                        <div
                                                            key={p.paralelo}
                                                            style={{
                                                                display: "grid",
                                                                gridTemplateColumns: "minmax(0, 1fr) 260px",
                                                                gap: 8,
                                                                alignItems: "center",
                                                            }}
                                                        >
                                                            <span style={nombreStyle}>
                                                                <b style={{ color: "var(--text)", fontWeight: 600 }}>
                                                                    Práctica {p.paralelo}
                                                                </b>{" "}
                                                                · {p.detalle}
                                                            </span>
                                                            <select
                                                                className="input"
                                                                aria-label={`Semanas de la práctica ${p.paralelo}`}
                                                                value={valor}
                                                                onChange={(e) =>
                                                                    updateParalelo(row, p.paralelo, e.target.value as SemanasPracticas | "")
                                                                }
                                                                style={!valor && !row.semanas ? ESTILO_PENDIENTE : undefined}
                                                            >
                                                                <option value="">
                                                                    Igual que la materia ({SEMANAS_CORTO[row.semanas]})
                                                                </option>
                                                                {SEMANAS_TEXTO.filter((o) => o.value).map((o) => (
                                                                    <option key={o.value} value={o.value}>
                                                                        {o.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ padding: "0 16px 16px" }}>
                            <button
                                className="btn btn-ghost"
                                onClick={addSemanasRow}
                                style={{ width: "100%", border: "1px dashed var(--border-strong)" }}
                            >
                                + Agregar materia
                            </button>
                        </div>
                    </div>
                </section>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "var(--text-3)" }}>Los cambios se guardan automáticamente.</span>
                    <button className="btn btn-ghost" onClick={handleReset}>
                        Restaurar valores originales
                    </button>
                </div>
            </div>
        </div>
    );
}
