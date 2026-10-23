# Cómo funciona

Reglas que aplica la herramienta para leer el reporte, completar los datos que faltan y detectar cruces. Sirve para saber cuándo confiar en un resultado y cuándo revisarlo a mano.

Para el uso paso a paso, ver la [Guía de uso](guia-de-uso.md).

---

## Archivo de entrada

El reporte «Horario de clases por aula» (SAAC00085) exportado a CSV tiene una fila por clase semanal. Cada fila repite el encabezado del reporte y luego trae:

| Dato | Ejemplo |
|---|---|
| Aula y bloque | `A002 -11C` → aula `A002`, bloque `11C` |
| Profesor | `ALVARADO MORENO OTTO ISMAEL` |
| Código de materia | `ELEG1028` |
| Nombre de materia | `ANÁLISIS DE REDES ELÉCTRICAS` |
| Paralelo | `1`, `101` |
| Día | `LUNES` … `SÁBADO` |
| Hora de inicio y de fin | `09:00:00`, `11:00:00` |

Las filas con profesor `CERRADO CURSO` (cursos cerrados) se descartan.

## Datos que el reporte no trae

| Dato | Cómo se obtiene |
|---|---|
| **Tipo** | Paralelo 101 o mayor → práctica. Menor → teoría. Es la numeración que usa ESPOL. |
| **Carrera y nivel** | De la malla curricular en Configuración, que por defecto tiene las materias profesionales de la malla de Electricidad (ELEG y EYAG). Una materia es de la carrera si tiene nivel ahí. |
| **Semanas de las prácticas** | De la tabla *Semanas de las prácticas* en Configuración: todas las semanas, semanas impares (1ª quincena) o semanas pares (2ª quincena). Para cada paralelo de práctica se usa su valor propio si lo tiene; si no, el de su materia (precargado con la tabla de laboratorios de la coordinación). Si no hay ninguno, se muestra como *no se sabe* y, para detectar cruces, se trata como de todas las semanas. Las teorías siempre son de todas las semanas. |
| **Paralelos asociados** | Se detectan por la numeración y se pueden corregir en Configuración; ver abajo. |
| Cupo, exámenes | No se usan. |

La configuración se aplica cada vez que se abre una página, no al subir el archivo. Por eso los cambios en Configuración se ven sin volver a cargar el CSV.

### Paralelos asociados

Un estudiante inscribe un paralelo de teoría y un paralelo de práctica de la misma materia. Según la materia, hay dos reglas:

- **Cualquier práctica:** con cualquier teoría se puede tomar cualquier práctica. Una materia con 2 teorías y 7 prácticas tiene 14 opciones.
- **Emparejadas:** la teoría N solo con la práctica 100+N. Una materia con 38 teorías y 38 prácticas tiene 38 opciones.

El reporte no trae este dato. La regla se elige así, por materia:

1. Si en Configuración se eligió una regla, se usa esa.
2. Si no (*Automático*), se deduce de los paralelos del archivo: **emparejadas** si hay 2 o más teorías y exactamente una práctica 100+N por cada teoría N; **cualquier práctica** en los demás casos.

En los reportes de PAO 2027-1 y 2027-2, ninguna materia ELEG ni EYAG cumple el patrón de emparejadas, así que todas quedan con *cualquier práctica*. Fuera de la carrera sí ocurre: CCPG1043 (teoría 19 con práctica 119) e IDIG2012, donde además el profesor de la teoría N es el mismo de la práctica 100+N, lo que respalda la regla. Con una sola teoría, las dos reglas dan el mismo resultado.

## Qué cuenta como cruce

Dos clases **se solapan** si cumplen las tres condiciones:

1. Son el mismo día.
2. Sus horarios se superponen. Que una termine a las 11:00 y la otra empiece a las 11:00 **no** es solape.
3. Hay al menos una semana en que ocurren las dos:

| Clase A | Clase B | ¿Pueden cruzarse? |
|---|---|---|
| Todas las semanas (o no se sabe) | Cualquiera | Sí |
| Semanas impares | Semanas impares | Sí |
| Semanas impares | Semanas pares | **No** |

**Misma aula y hora.** Si las dos clases de un cruce usan la misma aula a la misma hora, se agrega una nota: puede que alternen semanas y falte indicarlo, o que haya un error de planificación. La herramienta no asume ninguna de las dos cosas y lo sigue contando como cruce hasta que se indiquen las semanas.

### Cruces entre profesores

Se consideran los profesores que dictan al menos una clase de la carrera. Para cada uno se revisan **todas** sus clases del reporte, incluidas las de otras carreras, y se reporta cada par de clases distintas que se solapan. Si el mismo profesor aparece en dos filas de la misma sección (misma materia, tipo y paralelo), no se cuenta como cruce.

### Cursar un nivel completo

Para un nivel se toman las materias de la carrera de ese nivel que tienen horario en el archivo. Las materias de la malla sin horario se informan y quedan fuera.

- **Opción de una materia:** una teoría más una práctica compatible, o solo la teoría si la materia no tiene prácticas.
- **Combinación sin cruces:** una opción por materia, de modo que ningún par de opciones se solape.
- La búsqueda prueba primero las materias con menos opciones y descarta un camino apenas encuentra un cruce. *Ver todas las combinaciones* se detiene en 200 combinaciones o tras revisar 300 000 posibilidades, para no bloquear el navegador.
- **Pares que siempre se cruzan:** cuando no hay combinación posible, se revisa cada par de materias. Si ninguna opción de una es compatible con ninguna opción de la otra, ese par es la causa. A veces no hay ningún par así y el problema aparece solo al juntar tres o más materias.

### Huecos libres

Se calculan sobre la grilla de lunes a viernes, de 07:00 a 22:00, con **todas** las secciones del nivel: todas las materias, tipos y paralelos.

Para cada franja del día:
- Si la ocupa alguna clase de todas las semanas (o de semanas no indicadas), o la ocupan prácticas impares y pares, está **ocupada**.
- Si solo la ocupan prácticas de semanas pares, está **libre en semanas impares**, y al revés.
- Si nada la ocupa, está **libre todas las semanas**.

Sirve para decidir dónde abrir un paralelo nuevo; lo que puede inscribir un estudiante lo responden las combinaciones.

## Dónde se guardan los datos

Todo queda en el `localStorage` del navegador. No hay servidor.

| Clave | Contenido |
|---|---|
| `currentSubjects` | Clases del último archivo cargado, tal como salen del CSV. |
| `currentFileName` | Nombre de ese archivo. |
| `mallaCurricular-eleg-eyag` | Código → nivel (materias de la carrera). El nombre de la clave cambia cuando cambia la malla por defecto. |
| `conflictsSelection` | Nivel y paralelos elegidos en Cruces. |
| `relacionPracticas` | Código → `cualquiera` / `emparejadas`, solo para las materias cambiadas a mano en Configuración. |
| `semanasPracticas` | Código → `todas` / `impares` / `pares` (valor de la materia). |
| `semanasParalelos` | `CÓDIGO\|PARALELO` → `todas` / `impares` / `pares` (valor de un paralelo de práctica; tiene prioridad). |
| `scheduleFilters` | Últimos filtros del horario semanal. |

## Limitaciones conocidas

- Las materias que se dictan en aulas que el reporte no incluye no se pueden analizar.
- Las semanas de las prácticas no vienen en el reporte. Si no se indican en Configuración, dos prácticas de semanas alternas a la misma hora aparecen como cruce.
- No se consideran cupos: una combinación sin cruces puede incluir un paralelo lleno.
- La grilla no muestra los sábados (sí cuentan para los cruces de profesores).
