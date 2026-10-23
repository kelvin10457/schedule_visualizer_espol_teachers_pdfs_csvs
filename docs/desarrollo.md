# Desarrollo

Notas para quien mantenga o modifique la herramienta.

## Requisitos

Node.js en una versión LTS reciente, con npm (probado con Node.js 24).

## Comandos

```bash
npm install       # dependencias
npm run dev       # servidor de desarrollo
npm run build     # compila a dist/
npm run preview   # sirve dist/ localmente
npm run lint      # ESLint
```

`dist/` es un sitio estático. Se puede publicar en cualquier hosting de archivos estáticos (GitHub Pages, Netlify, un servidor web…). La app usa `HashRouter` (`#/show-schedule`), así que no necesita reglas de reescritura de rutas.

> `public/new_data/` guarda reportes y tablas reales para probar en local. Está en `.gitignore` y el build lo quita de `dist/` (plugin `exclude-local-data` en `vite.config.ts`), así que no se sube al repositorio ni se publica. Cualquier otra cosa en `public/` sí se copia a `dist/`.

## Stack

React 19, TypeScript, Vite y React Router. No hay backend: todo corre en el navegador y se guarda en `localStorage`.

## Estructura

```
src/
├── main.tsx                 Entrada; monta el router.
├── App.tsx                  Rutas.
├── pages/
│   ├── UploadFile.tsx       /               Carga y valida el CSV.
│   ├── Schedule.tsx         /show-schedule  Horario semanal.
│   ├── Conflicts.tsx        /conflicts      Cruces de profesores, niveles y huecos.
│   └── Config.tsx           /config         Malla, relación teoría–práctica y semanas de prácticas (guardado automático).
├── components/
│   ├── MiniWeekGrid.tsx     Grilla de la página de Cruces.
│   ├── FilterSelect.tsx     Lista desplegable de los filtros del horario.
│   ├── SemanasPendientes.tsx Aviso de prácticas sin semanas indicadas.
│   ├── AppMark.tsx
├── lib/
│   ├── parseReport.ts       Lectura del reporte y aplicación de la configuración.
│   ├── conflicts.ts         Secciones, cruces, combinaciones y huecos.
│   ├── mallaCurricular.ts   Valores por defecto: malla, nombres y semanas de prácticas.
│   ├── exportExcel.ts       Descarga de tablas en .xlsx (write-excel-file, cargada solo al exportar).
│   ├── storage.ts           Envoltorio de localStorage.
│   ├── constants.ts         Claves de storage.
│   ├── palette.ts, time.ts, tooltip.ts
└── models/Subject.ts        Una fila = una clase semanal.
```

## Flujo de datos

1. `UploadFile` lee el archivo con `parseReportCSV()` y guarda las filas **sin configurar** en `currentSubjects`.
2. `Schedule` y `Conflicts` llaman a `loadCurrentSchedule()`, que lee esas filas, la malla, las relaciones teoría–práctica y las semanas de prácticas guardadas (por materia y por paralelo), y aplica `applyConfig()`. Devuelve:
   - `todas`: todas las clases del reporte, con nivel, paralelos asociados y semanas (`planificada_quincenalmente`: `1 QUINCENA` = impares, `2 QUINCENA` = pares, `NO` = todas, `DESCONOCIDA` = no se sabe).
   - `carrera`: las de `todas` que tienen nivel en la malla.
   - `malla`: la malla vigente, para listar los niveles y las materias sin horario.
   - `relaciones`: para cada materia con prácticas, la regla usada (`cualquiera` / `emparejadas`), la detectada por `detectarRelaciones()` y si viene de Configuración.
3. Los análisis de `conflicts.ts` trabajan sobre `carrera`, salvo los cruces de profesores, que usan `todas` filtradas a los profesores de la carrera (`profesoresDeCarrera()`).

Como la configuración se aplica al leer y no al guardar, cambiar la malla actualiza los resultados sin volver a cargar el archivo.

La lógica de cruces y huecos de `conflicts.ts` trabaja con quincenas (`1 QUINCENA` / `2 QUINCENA`); la interfaz las muestra como semanas impares / pares, que es como las nombra la coordinación. `DESCONOCIDA` se comporta como `NO` (todas las semanas). No se infieren semanas a partir del aula: `mismaAulaYHora()` solo sirve para mostrar una nota en el cruce.

## Formato del reporte

`parseReportCSV()` busca en cada fila la celda `PROFESOR` seguida de `COD.MAT.`, que son las 8 celdas del encabezado de columnas. Los datos de la clase empiezan 8 celdas después: aula, profesor, código, materia, paralelo, día, una celda vacía, hora de inicio y hora de fin. Si el sistema académico cambia el reporte, ese es el único lugar que hay que ajustar.

Las reglas para completar los datos que faltan están documentadas en [Cómo funciona](como-funciona.md).
