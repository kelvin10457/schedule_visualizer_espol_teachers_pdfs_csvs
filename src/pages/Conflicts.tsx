import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Subject from "../models/Subject";
import { getStorageItem, setStorageItem } from "../lib/storage";
import { CONFLICTS_SELECTION_KEY } from "../lib/constants";
import {
    loadCurrentSchedule,
    practicasSinSemanas,
    profesoresDeCarrera,
    semanasLabel,
    type LoadedSchedule,
    type RelacionMateria,
    type RelacionPracticas,
} from "../lib/parseReport";
import {
    buildSections,
    buildSubjectOptions,
    computeFreeBlocks,
    findAllConflictFreeCombos,
    findConflictFreeCombo,
    findProfessorConflicts,
    meetingsOverlap,
    mismaAulaYHora,
    type ConflictPair,
    optionsConflict,
    pairwiseFeasibility,
    type FreeKind,
    type SubjectOption,
} from "../lib/conflicts";
import { NOMBRES_MATERIAS } from "../lib/mallaCurricular";
import { downloadExcel } from "../lib/exportExcel";
import MiniWeekGrid, { type WeekBlock } from "../components/MiniWeekGrid";
import SemanasPendientes from "../components/SemanasPendientes";
import { BLOCK_COLORS } from "../lib/palette";

const FREE_KIND_LEGEND: { kind: FreeKind; label: string; bg: string; border: string }[] = [
    { kind: "TODAS", label: "Libre todas las semanas", bg: "rgba(30,122,76,0.10)", border: "rgba(30,122,76,0.5)" },
    { kind: "1", label: "Libre solo en semanas impares", bg: "rgba(154,101,18,0.10)", border: "rgba(154,101,18,0.5)" },
    { kind: "2", label: "Libre solo en semanas pares", bg: "rgba(101,71,154,0.10)", border: "rgba(101,71,154,0.5)" },
];

interface SavedSelection {
    nivel: string;
    picks: Record<string, string>;
}

// Identificador estable de una opción que sobrevive a recargar el horario (los objetos
// SubjectOption se reconstruyen en cada carga, así que no se pueden guardar tal cual).
function optionKey(opt: SubjectOption): string {
    return `${opt.teoria.tipo}${opt.teoria.paralelo}|${opt.practica?.paralelo ?? ""}`;
}

const RELACION_NOTA: Record<RelacionPracticas, string> = {
    cualquiera: "Con cualquier teoría se puede tomar cualquier práctica de la materia",
    emparejadas: "Cada teoría solo con su práctica (1→101, 2→102…)",
};

// Elige la opción de una materia con dos listas: teoría y práctica. La lista de prácticas
// solo muestra las que se pueden tomar con la teoría elegida.
function SubjectPicker({
    opts,
    current,
    conflicted,
    relacion,
    onChange,
}: {
    opts: SubjectOption[];
    current: SubjectOption | undefined;
    conflicted: boolean;
    relacion: RelacionMateria | undefined;
    onChange: (opt: SubjectOption) => void;
}) {
    const selected = current ?? opts[0];
    const teorias = Array.from(new Set(opts.map((o) => o.teoria))).sort((a, b) => a.paralelo - b.paralelo);
    const practicas = opts
        .filter((o) => o.teoria === selected?.teoria && o.practica)
        .sort((a, b) => a.practica!.paralelo - b.practica!.paralelo);
    const className = conflicted ? "input is-danger" : "input";

    function pickTeoria(paralelo: number) {
        const conTeoria = opts.filter((o) => o.teoria.paralelo === paralelo);
        // Si la misma práctica sirve con la nueva teoría, se conserva.
        const next = conTeoria.find((o) => o.practica?.paralelo === selected?.practica?.paralelo) ?? conTeoria[0];
        if (next) onChange(next);
    }

    function pickPractica(paralelo: number) {
        const next = practicas.find((o) => o.practica!.paralelo === paralelo);
        if (next) onChange(next);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: practicas.length > 0 ? "1fr 1fr" : "1fr", gap: 8 }}>
                <select
                    className={className}
                    aria-label="Paralelo de teoría"
                    value={selected?.teoria.paralelo}
                    onChange={(e) => pickTeoria(Number(e.target.value))}
                >
                    {teorias.map((t) => (
                        <option key={t.paralelo} value={t.paralelo}>
                            {t.tipo === "TEORIA" ? "Teoría" : "Práctica"} P{t.paralelo} — {t.profesor}
                        </option>
                    ))}
                </select>
                {practicas.length > 0 && (
                    <select
                        className={className}
                        aria-label="Paralelo de práctica"
                        value={selected?.practica?.paralelo}
                        onChange={(e) => pickPractica(Number(e.target.value))}
                        disabled={practicas.length === 1}
                    >
                        {practicas.map((o) => (
                            <option key={o.practica!.paralelo} value={o.practica!.paralelo}>
                                Práctica {o.practica!.paralelo} — {o.practica!.profesor}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            {relacion && (
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {RELACION_NOTA[relacion.modo]}
                    {relacion.manual ? " · elegido en Configuración" : " · detectado automáticamente"}
                </span>
            )}
        </div>
    );
}

export default function Conflicts() {
    const navigate = useNavigate();
    const [schedule, setSchedule] = useState<LoadedSchedule | null>(null);
    const subjects = schedule?.carrera ?? null;
    const [selectedNivel, setSelectedNivel] = useState("");
    const [selection, setSelection] = useState<Record<string, SubjectOption>>({});
    const [autoResult, setAutoResult] = useState<
        | { status: "idle" }
        | { status: "found"; combo: SubjectOption[] }
        | { status: "not-found" }
    >({ status: "idle" });
    const [combosState, setCombosState] = useState<
        | { status: "idle" }
        | { status: "ready"; combos: SubjectOption[][]; truncated: boolean; index: number }
    >({ status: "idle" });

    // Cambia de nivel: arranca con la primera opción de cada materia y limpia el resultado
    // de la búsqueda automática anterior. Si hay una selección guardada para ese nivel
    // (venimos de recargar la página), se restaura; los paralelos que ya no existan en el
    // horario actual caen a la primera opción.
    function chooseNivel(nivel: string, carrera: Subject[], saved: SavedSelection | null = null) {
        const options = buildSubjectOptions(buildSections(carrera.filter((s) => s.nivel === nivel)));
        const initial: Record<string, SubjectOption> = {};
        for (const [code, opts] of options) {
            if (opts.length === 0) continue;
            const savedKey = saved?.nivel === nivel ? saved.picks[code] : undefined;
            initial[code] = (savedKey && opts.find((o) => optionKey(o) === savedKey)) || opts[0];
        }
        setSelectedNivel(nivel);
        setSelection(initial);
        setAutoResult({ status: "idle" });
        setCombosState({ status: "idle" });
    }

    useEffect(() => {
        Promise.all([
            loadCurrentSchedule(),
            getStorageItem<SavedSelection | null>(CONFLICTS_SELECTION_KEY, null),
        ]).then(([loaded, saved]) => {
            setSchedule(loaded);
            if (saved && Object.values(loaded.malla).includes(saved.nivel)) {
                chooseNivel(saved.nivel, loaded.carrera, saved);
            } else {
                // Sin selección guardada, se arranca con el primer nivel que tenga clases.
                const niveles = Array.from(new Set(loaded.carrera.map((s) => s.nivel))).sort();
                if (niveles[0]) chooseNivel(niveles[0], loaded.carrera);
            }
        });
    }, []);

    // Profesores de la carrera, revisando todas sus clases del reporte (también las de otras
    // carreras): si dictan otra materia a la misma hora, igual es un cruce.
    const professorConflicts = useMemo(
        () => (schedule ? findProfessorConflicts(schedule.todas, profesoresDeCarrera(schedule.carrera)) : []),
        [schedule]
    );

    const pendientes = useMemo(() => practicasSinSemanas(subjects ?? []), [subjects]);
    const nombres = useMemo(() => Object.fromEntries((schedule?.todas ?? []).map((s) => [s.codigo_materia, s.materia])), [schedule]);

    // Todos los niveles de la malla, tengan o no materias con horario en el archivo.
    const niveles = useMemo(() => (schedule ? Array.from(new Set(Object.values(schedule.malla))).sort() : []), [schedule]);

    const optionsByCodigo = useMemo(() => {
        if (!subjects || !selectedNivel) return new Map<string, SubjectOption[]>();
        const levelSubjects = subjects.filter((s) => s.nivel === selectedNivel);
        return buildSubjectOptions(buildSections(levelSubjects));
    }, [subjects, selectedNivel]);

    const codes = useMemo(() => Array.from(optionsByCodigo.keys()).sort(), [optionsByCodigo]);

    // Materias del nivel según la malla que el archivo no trae. No entran en el análisis
    // porque no tienen horario.
    const missingCodes = useMemo(() => {
        if (!schedule || !selectedNivel) return [];
        return Object.entries(schedule.malla)
            .filter(([codigo, nivel]) => nivel === selectedNivel && !optionsByCodigo.has(codigo))
            .map(([codigo]) => codigo)
            .sort();
    }, [schedule, selectedNivel, optionsByCodigo]);

    // Secciones crudas del nivel (todas las materias, tipos y paralelos) — se usan para
    // detectar los huecos libres, independientemente de qué opción esté seleccionada.
    const levelSections = useMemo(() => {
        if (!subjects || !selectedNivel) return [];
        return buildSections(subjects.filter((s) => s.nivel === selectedNivel));
    }, [subjects, selectedNivel]);

    const freeBlocks = useMemo(() => computeFreeBlocks(levelSections), [levelSections]);

    useEffect(() => {
        if (!selectedNivel || Object.keys(selection).length === 0) return;
        const picks: Record<string, string> = {};
        for (const [code, opt] of Object.entries(selection)) picks[code] = optionKey(opt);
        setStorageItem<SavedSelection>(CONFLICTS_SELECTION_KEY, { nivel: selectedNivel, picks });
    }, [selectedNivel, selection]);

    function applyCombo(combo: SubjectOption[]) {
        const next: Record<string, SubjectOption> = {};
        for (const opt of combo) next[opt.codigoMateria] = opt;
        setSelection(next);
    }

    function handleAutoSearch() {
        setCombosState({ status: "idle" });
        const combo = findConflictFreeCombo(optionsByCodigo);
        if (combo) {
            applyCombo(combo);
            setAutoResult({ status: "found", combo });
        } else {
            setAutoResult({ status: "not-found" });
        }
    }

    function handleShowAllCombos() {
        const { combos, truncated } = findAllConflictFreeCombos(optionsByCodigo);
        if (combos.length === 0) {
            setCombosState({ status: "idle" });
            setAutoResult({ status: "not-found" });
            return;
        }
        applyCombo(combos[0]);
        setAutoResult({ status: "found", combo: combos[0] });
        setCombosState({ status: "ready", combos, truncated, index: 0 });
    }

    function gotoCombo(delta: number) {
        setCombosState((prev) => {
            if (prev.status !== "ready") return prev;
            const nextIndex = (prev.index + delta + prev.combos.length) % prev.combos.length;
            applyCombo(prev.combos[nextIndex]);
            return { ...prev, index: nextIndex };
        });
    }

    const infeasiblePairs = useMemo(() => {
        if (autoResult.status !== "not-found") return [];
        return pairwiseFeasibility(optionsByCodigo).filter((p) => !p.feasible);
    }, [autoResult, optionsByCodigo]);

    // Cruces dentro de la selección manual actual (independiente del resultado automático).
    const manualConflicts = useMemo(() => {
        const out: { codeA: string; codeB: string }[] = [];
        for (let i = 0; i < codes.length; i++) {
            for (let j = i + 1; j < codes.length; j++) {
                const a = selection[codes[i]];
                const b = selection[codes[j]];
                if (a && b && optionsConflict(a, b)) out.push({ codeA: codes[i], codeB: codes[j] });
            }
        }
        return out;
    }, [codes, selection]);

    const conflictedCodes = useMemo(() => {
        const set = new Set<string>();
        for (const c of manualConflicts) {
            set.add(c.codeA);
            set.add(c.codeB);
        }
        return set;
    }, [manualConflicts]);

    const conflictedRows = useMemo(() => {
        const set = new Set<Subject>();
        for (let i = 0; i < codes.length; i++) {
            for (let j = i + 1; j < codes.length; j++) {
                const a = selection[codes[i]];
                const b = selection[codes[j]];
                if (!a || !b) continue;
                for (const ma of a.meetings) {
                    for (const mb of b.meetings) {
                        if (meetingsOverlap(ma, mb)) {
                            set.add(ma.row);
                            set.add(mb.row);
                        }
                    }
                }
            }
        }
        return set;
    }, [codes, selection]);

    const blocks: WeekBlock[] = useMemo(() => {
        const out: WeekBlock[] = [];
        codes.forEach((code, idx) => {
            const opt = selection[code];
            if (!opt) return;
            const color = BLOCK_COLORS[idx % BLOCK_COLORS.length];
            opt.meetings.forEach((m, mIdx) => {
                out.push({
                    id: `${code}-${mIdx}`,
                    dia: m.dia,
                    startMin: m.startMin,
                    endMin: m.endMin,
                    title: code,
                    subtitle: m.row.tipo === "TEORIA" ? `Teoría P${m.row.paralelo}` : `Práctica ${m.row.paralelo}`,
                    color,
                    conflicted: conflictedRows.has(m.row),
                    subject: m.row,
                });
            });
        });
        return out;
    }, [codes, selection, conflictedRows]);

    if (subjects === null) {
        return (
            <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)" }}>
                Cargando...
            </div>
        );
    }

    if (subjects.length === 0) {
        return (
            <div
                className="page"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                }}
            >
                <p style={{ margin: 0, color: "var(--text-2)" }}>No hay ningún horario cargado todavía.</p>
                <button className="btn btn-primary" onClick={() => navigate("/")}>
                    Ir a cargar un horario
                </button>
            </div>
        );
    }

    const noLevel = !selectedNivel || codes.length === 0;

    return (
        <div className="page" style={{ padding: "32px 16px 60px" }}>
            <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Cruces de horario</h1>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={() => navigate("/config", pendientes.length > 0 ? { state: { seccion: "semanas" } } : undefined)}>
                            Configuración
                            {pendientes.length > 0 && <span className="btn-badge btn-badge-warning">{pendientes.length}</span>}
                        </button>
                        <button className="btn" onClick={() => navigate(-1)}>
                            Volver
                        </button>
                    </div>
                </div>

                <SemanasPendientes codigos={pendientes} nombres={nombres} />

                {/* ── Cruces de profesores ── */}
                <section className="card" style={{ padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <h2 className="section-title">Cruces entre profesores</h2>
                        {professorConflicts.length > 0 && (
                            <button className="btn" onClick={() => exportConflicts(professorConflicts)} title="Descargar la lista de cruces como archivo de Excel">
                                Descargar Excel
                            </button>
                        )}
                    </div>
                    <p className="section-desc" style={{ marginBottom: 16 }}>
                        Profesores de la carrera con dos clases distintas que caen en el mismo día y horario, contando también las que dictan en otras carreras. Haz clic en un nombre para ver su horario.
                    </p>

                    {professorConflicts.length === 0 ? (
                        <div className="callout callout-success">No se detectó ningún cruce entre profesores.</div>
                    ) : (
                        <div style={{ border: "1px solid var(--border)", borderRadius: 6 }}>
                            {professorConflicts.map((group, gIdx) => (
                                <div
                                    key={group.profesor}
                                    style={{ padding: "12px 14px", borderTop: gIdx === 0 ? "none" : "1px solid var(--border)" }}
                                >
                                    <div style={{ fontSize: 13, marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 12 }}>
                                        <button
                                            className="link-button"
                                            onClick={() => navigate("/show-schedule", { state: { profesor: group.profesor } })}
                                            title="Ver el horario de este profesor"
                                            style={{ fontWeight: 600 }}
                                        >
                                            {group.profesor}
                                        </button>
                                        <span style={{ color: "var(--danger)", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
                                            {group.conflicts.length} {group.conflicts.length === 1 ? "cruce" : "cruces"}
                                        </span>
                                    </div>
                                    <div className="tabular" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {group.conflicts.map((c, i) => (
                                            <div key={i} style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                                                <div>
                                                    <ClassRef side={c.a} />
                                                </div>
                                                <div>
                                                    <span style={{ color: "var(--text-3)" }}>se cruza con </span>
                                                    <ClassRef side={c.b} />
                                                </div>
                                                <ConflictHint conflict={c} onConfigure={() => navigate("/config", { state: { seccion: "semanas" } })} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Cruces por nivel ── */}
                <section className="card" style={{ padding: 20 }}>
                    <h2 className="section-title">¿Se puede tomar todo un nivel sin cruces?</h2>
                    <p className="section-desc" style={{ marginBottom: 16 }}>
                        Elige un nivel, deja que la herramienta busque una combinación de paralelos sin cruces, o ajústala tú mismo abajo.
                    </p>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                            className="input"
                            aria-label="Nivel"
                            value={selectedNivel}
                            onChange={(e) => chooseNivel(e.target.value, subjects ?? [])}
                            style={{ width: 260 }}
                        >
                            {!selectedNivel && <option value="">Elige un nivel...</option>}
                            {niveles.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                        <button className="btn btn-primary" onClick={handleAutoSearch} disabled={noLevel}>
                            Buscar combinación sin cruces
                        </button>
                        <button className="btn" onClick={handleShowAllCombos} disabled={noLevel}>
                            Ver todas las combinaciones
                        </button>
                    </div>

                    {combosState.status === "ready" && (
                        <div
                            className="tabular"
                            style={{
                                marginTop: 14,
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                flexWrap: "wrap",
                            }}
                        >
                            <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border-strong)", borderRadius: 6, overflow: "hidden" }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => gotoCombo(-1)}
                                    disabled={combosState.combos.length <= 1}
                                    aria-label="Combinación anterior"
                                    style={{ borderRadius: 0, width: 32, padding: 0 }}
                                >
                                    ‹
                                </button>
                                <span style={{ fontSize: 13, padding: "0 12px", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", lineHeight: "32px" }}>
                                    Combinación {combosState.index + 1} de {combosState.combos.length}
                                    {combosState.truncated ? "+" : ""}
                                </span>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => gotoCombo(1)}
                                    disabled={combosState.combos.length <= 1}
                                    aria-label="Combinación siguiente"
                                    style={{ borderRadius: 0, width: 32, padding: 0 }}
                                >
                                    ›
                                </button>
                            </div>
                            {combosState.truncated && (
                                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                                    Se limitó la búsqueda a las primeras {combosState.combos.length} para no trabar el navegador.
                                </span>
                            )}
                        </div>
                    )}

                    {missingCodes.length > 0 && (
                        <div className="callout callout-info" style={{ marginTop: 14, fontSize: 13 }}>
                            {codes.length === 0
                                ? "Ninguna materia de este nivel tiene horario en el archivo cargado"
                                : `${missingCodes.length} ${missingCodes.length === 1 ? "materia" : "materias"} de este nivel no ${missingCodes.length === 1 ? "tiene" : "tienen"} horario en el archivo cargado y no se ${missingCodes.length === 1 ? "considera" : "consideran"} en el análisis`}
                            :
                            <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>
                                {missingCodes.map((c) => (
                                    <li key={c}>
                                        <strong style={{ fontWeight: 600 }}>{c}</strong> {NOMBRES_MATERIAS[c] ?? ""}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {autoResult.status === "found" && (
                        <div className="callout callout-success" style={{ marginTop: 14 }}>
                            <strong style={{ fontWeight: 600 }}>Sí es posible.</strong> Se armó una combinación sin cruces para las {autoResult.combo.length} materias de este nivel con horario (aplicada abajo).
                        </div>
                    )}

                    {autoResult.status === "not-found" && (
                        <div className="callout callout-danger" style={{ marginTop: 14 }}>
                            <div style={{ marginBottom: infeasiblePairs.length > 0 ? 8 : 0 }}>
                                <strong style={{ fontWeight: 600 }}>No es posible.</strong> No existe ninguna combinación de paralelos sin cruces para este nivel.
                            </div>
                            {infeasiblePairs.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 12, marginBottom: 4, opacity: 0.8 }}>
                                        Pares que siempre se cruzan (sin importar el paralelo elegido):
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
                                        {infeasiblePairs.map((p, i) => (
                                            <li key={i} style={{ fontSize: 12 }}>
                                                {p.materiaA} ({p.codigoA}) ↔ {p.materiaB} ({p.codigoB})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {codes.length > 0 && (
                        <>
                            <div style={{ marginTop: 20, border: "1px solid var(--border)", borderRadius: 6 }}>
                                {codes.map((code, idx) => {
                                    const opts = optionsByCodigo.get(code) ?? [];
                                    const current = selection[code];
                                    const color = BLOCK_COLORS[idx % BLOCK_COLORS.length];
                                    const conflicted = conflictedCodes.has(code);
                                    return (
                                        <div
                                            key={code}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "200px 1fr",
                                                gap: 12,
                                                alignItems: "start",
                                                padding: "8px 12px",
                                                borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, paddingTop: 6 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: color.border, flexShrink: 0, marginTop: 5 }} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div>
                                                        <span style={{ fontWeight: 600 }}>{code}</span>
                                                        {conflicted && (
                                                            <span title="Se cruza con otra materia elegida" style={{ marginLeft: 8, fontSize: 11, color: "var(--danger)", fontWeight: 500 }}>
                                                                cruce
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.35 }}>{opts[0]?.materia ?? NOMBRES_MATERIAS[code]}</div>
                                                </div>
                                            </div>
                                            <SubjectPicker
                                                opts={opts}
                                                current={current}
                                                conflicted={conflicted}
                                                relacion={schedule?.relaciones[code]}
                                                onChange={(opt) => {
                                                    setSelection((prev) => ({ ...prev, [code]: opt }));
                                                    setCombosState({ status: "idle" });
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <div className="eyebrow" style={{ marginBottom: 4 }}>
                                    Huecos libres del nivel
                                </div>
                                <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-2)" }}>
                                    Franjas donde ningún paralelo de ninguna materia del nivel tiene clase: ahí se podría abrir
                                    un paralelo nuevo sin chocar con nada del nivel. Lo que puede inscribir un estudiante está
                                    en las combinaciones de arriba.
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                                    {FREE_KIND_LEGEND.filter(({ kind }) => kind === "TODAS" || freeBlocks.some((f) => f.freeIn === kind)).map(({ kind, label, bg, border }) => (
                                        <div key={kind} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: `1px dashed ${border}`, flexShrink: 0 }} />
                                            <span style={{ fontSize: 12, color: "var(--text-2)" }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginTop: 10, overflowX: "auto" }}>
                                <div style={{ minWidth: 620 }}>
                                    <MiniWeekGrid blocks={blocks} freeBlocks={freeBlocks} />
                                </div>
                            </div>

                            {freeBlocks.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <div className="eyebrow" style={{ marginBottom: 6 }}>
                                        Huecos por día
                                    </div>
                                    <div className="tabular" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"].map((dia) => {
                                            const dayFree = freeBlocks.filter((f) => f.dia === dia);
                                            if (dayFree.length === 0) return null;
                                            return (
                                                <div key={dia} style={{ fontSize: 12, color: "var(--text-2)", display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
                                                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{dia.charAt(0) + dia.slice(1).toLowerCase()}</span>
                                                    <span>
                                                        {dayFree.map((f, i) => (
                                                            <span key={i}>
                                                                {formatRange(f.startMin, f.endMin)}
                                                                {f.freeIn === "1" ? " (semanas impares)" : f.freeIn === "2" ? " (semanas pares)" : ""}
                                                                {i < dayFree.length - 1 ? " · " : ""}
                                                            </span>
                                                        ))}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}

// Prácticas de un cruce que no tienen sus semanas indicadas, como "EYAG1040 práctica 111".
function practicasSinSemanasEn(c: ConflictPair): string[] {
    return [c.a, c.b]
        .filter((x) => x.meeting.row.tipo === "PRACTICO" && x.meeting.row.planificada_quincenalmente === "DESCONOCIDA")
        .map((x) => `${x.section.codigoMateria} práctica ${x.section.paralelo}`);
}

// Nota bajo un cruce cuando puede ser falso (faltan semanas) o cuando las dos clases usan
// la misma aula a la vez. No se decide si es alternancia o un error: se avisa para revisar.
function hintTexto(c: ConflictPair): { sinSemanas: string; mismaAula: string } {
    const sin = practicasSinSemanasEn(c);
    return {
        sinSemanas:
            sin.length > 0
                ? `Puede no ser un cruce real: falta indicar en qué semanas se dicta ${sin.join(" y ")}. Si una es de semanas impares y la otra de pares, el cruce desaparece.`
                : "",
        mismaAula: mismaAulaYHora(c)
            ? sin.length > 0
                ? "Además usan la misma aula a la misma hora: o alternan semanas o hay un error de planificación."
                : "Usan la misma aula a la misma hora en las mismas semanas: revisa la planificación o las semanas indicadas."
            : "",
    };
}

function ConflictHint({ conflict, onConfigure }: { conflict: ConflictPair; onConfigure: () => void }) {
    const { sinSemanas, mismaAula } = hintTexto(conflict);
    if (!sinSemanas && !mismaAula) return null;
    return (
        <div style={{ marginTop: 2, color: "var(--q1)" }}>
            {[sinSemanas, mismaAula].filter(Boolean).join(" ")}{" "}
            {sinSemanas && (
                <button className="link-button" onClick={onConfigure} style={{ color: "var(--accent)" }}>
                    Indicarlo en Configuración
                </button>
            )}
        </div>
    );
}

function claseLabel(side: ConflictPair["a"]): string {
    const { section, meeting } = side;
    const tipo = section.tipo === "TEORIA" ? `Teoría P${section.paralelo}` : `Práctica ${section.paralelo} (${semanasLabel(meeting.row)})`;
    return `${tipo}, ${meeting.dia} ${formatRange(meeting.startMin, meeting.endMin)}, aula ${meeting.row.aula || "?"}`;
}

// Una clase dentro de un cruce: código, nombre, paralelo, horario y aula.
function ClassRef({ side }: { side: ConflictPair["a"] }) {
    const { section } = side;
    return (
        <>
            <b style={{ color: "var(--text)", fontWeight: 600 }}>{section.codigoMateria}</b> {section.materia}
            {section.nivel ? "" : " · otra carrera"} — {claseLabel(side)}
        </>
    );
}

function observacion(c: ConflictPair): string {
    const { sinSemanas, mismaAula } = hintTexto(c);
    return [sinSemanas, mismaAula].filter(Boolean).join(" ");
}

function exportConflicts(groups: ReturnType<typeof findProfessorConflicts>) {
    const rows: string[][] = [];
    for (const g of groups) {
        for (const c of g.conflicts) {
            rows.push([
                g.profesor,
                c.a.section.codigoMateria,
                c.a.section.materia,
                claseLabel(c.a),
                c.b.section.codigoMateria,
                c.b.section.materia,
                claseLabel(c.b),
                observacion(c),
            ]);
        }
    }
    downloadExcel(
        "cruces-profesores.xlsx",
        ["Profesor", "Código A", "Materia A", "Clase A", "Código B", "Materia B", "Clase B", "Observación"],
        rows,
        [34, 11, 32, 46, 11, 32, 46, 50]
    );
}

function formatRange(startMin: number, endMin: number): string {
    const fmt = (m: number) => `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
    return `${fmt(startMin)}-${fmt(endMin)}`;
}
