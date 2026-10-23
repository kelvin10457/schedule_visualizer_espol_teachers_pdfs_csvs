import Subject from "../models/Subject";
import { getStorageItem } from "./storage";
import { CURRENT_SUBJECTS_KEY, RELACION_PRACTICAS_KEY } from "./constants";
import {
    DEFAULT_MALLA_CURRICULAR,
    DEFAULT_SEMANAS_PRACTICAS,
    MALLA_CURRICULAR_STORAGE_KEY,
    SEMANAS_PARALELOS_STORAGE_KEY,
    SEMANAS_PRACTICAS_STORAGE_KEY,
    claveParalelo,
    type SemanasPracticas,
} from "./mallaCurricular";

// Parser del reporte "HORARIO DE CLASES POR AULA" (SAAC00085) exportado a CSV por el
// sistema académico. Cada fila repite el encabezado del reporte y luego trae una clase:
//   ..., "PROFESOR","COD.MAT.","NOMBRE MATERIA","PAR.","DÍA","","HORA INIC.","HORA FIN",
//   <aula>, <profesor>, <código>, <materia>, <paralelo>, <día>, "", <inicio>, <fin>, ...
// El reporte no trae tipo, quincena, paralelos asociados, cupo, exámenes ni nivel: el tipo
// se deduce del paralelo, el nivel sale de la configuración y los paralelos asociados se
// deducen en applyConfig.

// Separa un CSV respetando campos entre comillas (con comas, saltos de línea y "" escapadas).
function splitCSV(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ",") {
            row.push(field);
            field = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += c;
        }
    }
    if (field || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

// "A001 -11F" → aula "A001", bloque "11F".
function splitAula(raw: string): { aula: string; bloque: string } {
    const idx = raw.indexOf(" -");
    if (idx < 0) return { aula: raw.trim(), bloque: "" };
    return { aula: raw.slice(0, idx).trim(), bloque: raw.slice(idx + 2).trim() };
}

export function parseReportCSV(text: string): Subject[] {
    const rows = splitCSV(text.replace(/^\uFEFF/, ""));
    const subjects: Subject[] = [];

    for (const values of rows) {
        const cells = values.map((v) => v.trim());
        // Los datos de la clase empiezan justo después de las 8 celdas del encabezado
        // de columnas, que arranca en "PROFESOR".
        const headerIdx = cells.indexOf("PROFESOR");
        if (headerIdx < 0 || cells[headerIdx + 1] !== "COD.MAT.") continue;
        const d = headerIdx + 8;
        const [aulaRaw, profesor, codigo, materia, paraleloRaw, dia, , horaInicio, horaFin] = cells.slice(d, d + 9);
        if (!codigo || !dia || !horaInicio || !horaFin) continue;
        // Cursos cerrados: el reporte los deja en un aula ficticia sin profesor real.
        if (profesor === "CERRADO CURSO") continue;

        const paralelo = Number(paraleloRaw) || 0;
        const { aula, bloque } = splitAula(aulaRaw ?? "");

        const s = new Subject();
        s.codigo_materia = codigo.toUpperCase();
        s.materia = materia ?? "";
        // Convención de ESPOL: los paralelos de práctica se numeran desde 101.
        s.tipo = paralelo >= 100 ? "PRACTICO" : "TEORIA";
        s.paralelo = paralelo;
        s.profesor = profesor ?? "";
        s.dia = dia.toUpperCase();
        s.hora_inicio = horaInicio;
        s.hora_fin = horaFin;
        s.aula = aula;
        s.bloque = bloque;
        s.planificada_quincenalmente = "NO";
        s.paralelos_asociados = "";
        s.nivel = "";
        subjects.push(s);
    }

    return subjects;
}

// Qué prácticas puede inscribir un estudiante según su paralelo de teoría:
// - "cualquiera": cualquier práctica de la materia (p. ej. ELEG1028: teoría 1 o 2 con
//   cualquiera de las prácticas 101–107).
// - "emparejadas": solo la práctica que corresponde a su teoría, la 100+N para la teoría N
//   (p. ej. CCPG1043: teoría 19 → práctica 119).
// El reporte no trae este dato. Se detecta solo y se puede corregir por materia en
// Configuración (si no hay valor guardado, se usa lo detectado).
export type RelacionPracticas = "cualquiera" | "emparejadas";

export interface RelacionMateria {
    modo: RelacionPracticas;
    detectado: RelacionPracticas;
    // true si el modo viene de Configuración y no de la detección automática.
    manual: boolean;
}

// Se consideran emparejadas cuando hay 2 o más teorías y exactamente una práctica 100+N por
// cada teoría N. Con una sola teoría ambas reglas dan lo mismo, así que queda "cualquiera".
export function detectarRelaciones(subjects: Subject[]): Record<string, RelacionPracticas> {
    const teorias = new Map<string, Set<number>>();
    const practicas = new Map<string, Set<number>>();
    for (const s of subjects) {
        const map = s.tipo === "PRACTICO" ? practicas : teorias;
        if (!map.has(s.codigo_materia)) map.set(s.codigo_materia, new Set());
        map.get(s.codigo_materia)!.add(s.paralelo);
    }
    const out: Record<string, RelacionPracticas> = {};
    for (const [codigo, practs] of practicas) {
        const teos = teorias.get(codigo);
        const emparejadas =
            !!teos && teos.size >= 2 && teos.size === practs.size && Array.from(teos).every((n) => practs.has(100 + n));
        out[codigo] = emparejadas ? "emparejadas" : "cualquiera";
    }
    return out;
}

// Completa lo que el reporte no trae a partir de la configuración guardada:
// - nivel: según la malla curricular (código → nivel); "" si la materia no es de la carrera.
// - paralelos asociados: según la relación teoría–práctica de cada materia (ver arriba).
// - semanas de las prácticas: las del paralelo si están indicadas; si no, las de la materia.
//   impares → "1 QUINCENA", pares → "2 QUINCENA", todas → "NO". Si no se sabe queda
//   "DESCONOCIDA", que para detectar cruces cuenta como todas las semanas.
// Se aplica al cargar (no al subir el archivo) para que los cambios en Configuración se
// reflejen sin volver a cargar el CSV.
export function applyConfig(
    subjects: Subject[],
    malla: Record<string, string>,
    relacionesGuardadas: Record<string, RelacionPracticas>,
    semanas: Record<string, SemanasPracticas>,
    semanasParalelos: Record<string, SemanasPracticas> = {}
): { subjects: Subject[]; relaciones: Record<string, RelacionMateria> } {
    const detectadas = detectarRelaciones(subjects);
    const relaciones: Record<string, RelacionMateria> = {};
    for (const [codigo, detectado] of Object.entries(detectadas)) {
        const guardado = relacionesGuardadas[codigo];
        relaciones[codigo] = { modo: guardado ?? detectado, detectado, manual: !!guardado };
    }

    const practicasByCodigo = new Map<string, Set<number>>();
    for (const s of subjects) {
        if (s.tipo !== "PRACTICO") continue;
        if (!practicasByCodigo.has(s.codigo_materia)) practicasByCodigo.set(s.codigo_materia, new Set());
        practicasByCodigo.get(s.codigo_materia)!.add(s.paralelo);
    }

    const configured = subjects.map((s) => {
        const practicas = practicasByCodigo.get(s.codigo_materia);
        let asociados = practicas ? Array.from(practicas).sort((a, b) => a - b).join(", ") : "";
        if (relaciones[s.codigo_materia]?.modo === "emparejadas") {
            asociados = String(s.tipo === "PRACTICO" ? s.paralelo : 100 + s.paralelo);
        }
        return {
            ...s,
            nivel: malla[s.codigo_materia] ?? "",
            paralelos_asociados: asociados,
            planificada_quincenalmente:
                s.tipo === "PRACTICO"
                    ? QUINCENA_DE_SEMANAS[semanasParalelos[claveParalelo(s.codigo_materia, s.paralelo)] ?? semanas[s.codigo_materia]] ??
                      "DESCONOCIDA"
                    : "NO",
        };
    });
    return { subjects: configured, relaciones };
}

export interface LoadedSchedule {
    // Clases de las materias de la carrera (las que están en la malla curricular).
    carrera: Subject[];
    // Todas las clases del reporte, para revisar el horario completo de cada profesor:
    // un profesor de la carrera que dicta otra materia a la misma hora también tiene cruce.
    todas: Subject[];
    malla: Record<string, string>;
    // Relación teoría–práctica usada para cada materia con prácticas.
    relaciones: Record<string, RelacionMateria>;
}

export async function getRelacionesGuardadas(): Promise<Record<string, RelacionPracticas>> {
    return getStorageItem<Record<string, RelacionPracticas>>(RELACION_PRACTICAS_KEY, {});
}

export function getSemanasGuardadas(): Promise<Record<string, SemanasPracticas>> {
    return getStorageItem(SEMANAS_PRACTICAS_STORAGE_KEY, DEFAULT_SEMANAS_PRACTICAS);
}

export function getSemanasParalelosGuardadas(): Promise<Record<string, SemanasPracticas>> {
    return getStorageItem<Record<string, SemanasPracticas>>(SEMANAS_PARALELOS_STORAGE_KEY, {});
}

// Lee el último reporte cargado y le aplica la configuración vigente.
export async function loadCurrentSchedule(): Promise<LoadedSchedule> {
    const [raw, malla, relacionesGuardadas, semanas, semanasParalelos] = await Promise.all([
        getStorageItem<Subject[]>(CURRENT_SUBJECTS_KEY, []),
        getStorageItem(MALLA_CURRICULAR_STORAGE_KEY, DEFAULT_MALLA_CURRICULAR),
        getRelacionesGuardadas(),
        getSemanasGuardadas(),
        getSemanasParalelosGuardadas(),
    ]);
    const { subjects: todas, relaciones } = applyConfig(raw, malla, relacionesGuardadas, semanas, semanasParalelos);
    return { carrera: todas.filter((s) => s.nivel), todas, malla, relaciones };
}

// Profesores que dictan al menos una clase de la carrera.
export function profesoresDeCarrera(carrera: Subject[]): Set<string> {
    return new Set(carrera.map((s) => s.profesor).filter(Boolean));
}

const QUINCENA_DE_SEMANAS: Record<SemanasPracticas, string> = {
    impares: "1 QUINCENA",
    pares: "2 QUINCENA",
    todas: "NO",
};

// Semanas en que se dicta una práctica, en palabras.
export function semanasLabel(s: Subject): string {
    switch (s.planificada_quincenalmente) {
        case "1 QUINCENA":
            return "semanas impares";
        case "2 QUINCENA":
            return "semanas pares";
        case "NO":
            return "todas las semanas";
        default:
            return "no se sabe si semanas impares o pares";
    }
}

// Texto del tipo para el detalle de una clase; en las prácticas incluye sus semanas.
export function tipoLabel(s: Subject): string {
    return s.tipo === "PRACTICO" ? `PRÁCTICO (${semanasLabel(s)})` : s.tipo;
}

// Códigos de las materias con alguna práctica sin sus semanas indicadas.
export function practicasSinSemanas(subjects: Subject[]): string[] {
    const set = new Set<string>();
    for (const s of subjects) if (s.tipo === "PRACTICO" && s.planificada_quincenalmente === "DESCONOCIDA") set.add(s.codigo_materia);
    return Array.from(set).sort();
}
