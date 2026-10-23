// Materias profesionales de Ingeniería en Electricidad (ELEG y EYAG, los cuadros amarillos
// de la malla curricular) por nivel.
// Solo se usa como valor inicial de la página de Configuración; una vez que el usuario
// guarda cambios ahí, localStorage bajo MALLA_CURRICULAR_STORAGE_KEY manda.
export const DEFAULT_MALLA_CURRICULAR: Record<string, string> = {
  ELEG1030: "NIVEL 200 - I",
  EYAG1044: "NIVEL 200 - I",

  ELEG1028: "NIVEL 200 - II",
  ELEG1051: "NIVEL 200 - II",
  EYAG1040: "NIVEL 200 - II",
  EYAG1043: "NIVEL 200 - II",

  ELEG1049: "NIVEL 300 - I",
  ELEG1038: "NIVEL 300 - I",
  ELEG1040: "NIVEL 300 - I",

  ELEG1050: "NIVEL 300 - II",
  ELEG1041: "NIVEL 300 - II",
  EYAG1035: "NIVEL 300 - II",

  ELEG1044: "NIVEL 400 - I",
  ELEG1032: "NIVEL 400 - I",
  ELEG1035: "NIVEL 400 - I",
  ELEG1029: "NIVEL 400 - I",
  ELEG1031: "NIVEL 400 - I",

  ELEG1047: "NIVEL 400 - II",
  ELEG1046: "NIVEL 400 - II",
  ELEG1033: "NIVEL 400 - II",
  ELEG1036: "NIVEL 400 - II",
  ELEG1039: "NIVEL 400 - II",

  ELEG1037: "NIVEL 500 - I",
  ELEG1042: "NIVEL 500 - I",
};

// La clave cambia cuando cambia la malla por defecto (antes: "mallaCurricular" con todas
// las materias, "mallaCurricular-eleg" con solo ELEG), para que una malla vieja guardada en
// el navegador no se imponga sobre la nueva.
export const MALLA_CURRICULAR_STORAGE_KEY = "mallaCurricular-eleg-eyag";

// Nombres de las materias de la malla y de las que vienen en DEFAULT_SEMANAS_PRACTICAS,
// para mostrarlos cuando el archivo cargado no trae esa materia (si la trae, se usa el
// nombre del archivo).
export const NOMBRES_MATERIAS: Record<string, string> = {
  ELEG1028: "ANÁLISIS DE REDES ELÉCTRICAS",
  ELEG1029: "CENTRALES ELÉCTRICAS",
  ELEG1030: "CIRCUITOS ELÉCTRICOS",
  ELEG1031: "CONTROLES ELÉCTRICOS INDUSTRIALES",
  ELEG1032: "DISTRIBUCIÓN ELÉCTRICA I",
  ELEG1033: "DISTRIBUCIÓN ELÉCTRICA II",
  ELEG1034: "ELECTRICIDAD BÁSICA",
  ELEG1035: "ENERGÍAS RENOVABLES",
  ELEG1036: "ESTABILIDAD Y CONTROL DE SISTEMAS DE POTENCIA",
  ELEG1037: "GESTIÓN Y MARCO REGULATORIO DEL SECTOR ELÉCTRICO",
  ELEG1038: "INSTALACIONES ELÉCTRICAS",
  ELEG1039: "LÍNEAS DE TRANSMISIÓN Y SUBESTACIONES",
  ELEG1040: "MAQUINARIA ELÉCTRICA I",
  ELEG1041: "MAQUINARIA ELÉCTRICA II",
  ELEG1042: "MATERIA INTEGRADORA DE ELECTRICIDAD",
  ELEG1043: "MÁQUINAS Y TRANSFORMADORES",
  ELEG1044: "OPERACIÓN DE SISTEMAS DE POTENCIA",
  ELEG1046: "PLANIFICACIÓN DE SISTEMAS DE POTENCIA",
  ELEG1047: "PROTECCIONES ELÉCTRICAS",
  ELEG1049: "SISTEMAS DE POTENCIA I",
  ELEG1050: "SISTEMAS DE POTENCIA II",
  ELEG1051: "TEORÍA ELECTROMAGNÉTICA",
  EYAG1035: "ELECTRÓNICA DE POTENCIA I",
  EYAG1040: "PRINCIPIOS DE ELECTRÓNICA",
  EYAG1043: "SISTEMAS DE CONTROL",
  EYAG1044: "SISTEMAS DIGITALES I",
};

// En qué semanas se dictan las prácticas (laboratorios) de cada materia. El reporte de
// horarios no lo indica. "impares" equivale a la 1ª quincena y "pares" a la 2ª. Valores
// tomados de la tabla de laboratorios de la coordinación; las materias que no aparecen
// quedan como "no se sabe" y, para detectar cruces, se tratan como de todas las semanas.
export type SemanasPracticas = "todas" | "impares" | "pares";

export const DEFAULT_SEMANAS_PRACTICAS: Record<string, SemanasPracticas> = {
  ELEG1028: "impares", // Análisis de Redes Eléctricas
  ELEG1030: "pares", // Circuitos Eléctricos
  ELEG1031: "pares", // Controles Eléctricos Industriales
  ELEG1033: "impares", // Distribución Eléctrica II
  ELEG1034: "todas", // Electricidad Básica
  ELEG1038: "todas", // Instalaciones Eléctricas
  ELEG1039: "impares", // Líneas de Transmisión y Subestaciones
  ELEG1040: "impares", // Maquinaria Eléctrica I
  ELEG1041: "pares", // Maquinaria Eléctrica II
  ELEG1043: "impares", // Máquinas y Transformadores
  ELEG1047: "pares", // Protecciones Eléctricas
  ELEG1049: "impares", // Sistemas de Potencia I
};

export const SEMANAS_PRACTICAS_STORAGE_KEY = "semanasPracticas";

// Semanas indicadas para un paralelo de práctica en particular ("CODIGO|PARALELO" →
// semanas). Tienen prioridad sobre el valor de la materia: una misma materia puede tener
// prácticas en semanas impares y otras en pares.
export const SEMANAS_PARALELOS_STORAGE_KEY = "semanasParalelos";

export function claveParalelo(codigo: string, paralelo: number): string {
  return `${codigo}|${paralelo}`;
}
