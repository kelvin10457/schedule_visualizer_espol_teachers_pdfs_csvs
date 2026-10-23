// Claves de storage compartidas entre páginas (ver src/lib/storage.ts).
// Filas del último reporte cargado, tal como salen del CSV (sin aplicar la configuración),
// para que otras páginas como Conflicts.tsx puedan leerlo sin depender del state de
// react-router.
export const CURRENT_SUBJECTS_KEY = "currentSubjects";
// Nombre del último archivo cargado, para mostrarlo en el encabezado del horario.
export const CURRENT_FILE_NAME_KEY = "currentFileName";
// Nivel y paralelos elegidos en Conflicts.tsx, para restaurarlos al volver a la página.
export const CONFLICTS_SELECTION_KEY = "conflictsSelection";
// Relación teoría–práctica elegida a mano en Configuración (código → "cualquiera" |
// "emparejadas"). Las materias que no están aquí usan la detección automática.
export const RELACION_PRACTICAS_KEY = "relacionPracticas";
// Filtros del horario semanal (tipo, nivel y profesor), para restaurarlos al volver.
export const SCHEDULE_FILTERS_KEY = "scheduleFilters";
