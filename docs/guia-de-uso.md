# Guía de uso

Esta guía es para coordinadores de carrera. Explica cómo usar el visualizador para responder dos preguntas al planificar un término:

1. **¿Pueden los estudiantes de mi carrera tomar todas las materias de un nivel en el mismo semestre sin que se les crucen?**
2. **¿Algún profesor de mi carrera tiene dos clases a la misma hora?**

Para saber exactamente qué reglas aplica la herramienta, revisa [Cómo funciona](como-funciona.md).

---

## 1. Antes de empezar: el archivo

La herramienta trabaja con el reporte **«Horario de clases por aula»** (código SAAC00085) del sistema académico, exportado en **CSV**. Por ejemplo: `2027_PAO1_PlanificaciónMaterias.csv`.

- Carga un archivo por término (PAO 1, PAO 2…).
- El PDF del mismo reporte no sirve; tiene que ser el CSV.
- El reporte incluye las clases de todas las aulas que abarca, de todas las carreras. La herramienta se queda con las materias de tu carrera (ver paso 2).

> **Importante:** el reporte solo trae las clases que se dictan en las aulas que abarca. Si alguna materia de la carrera no aparece en el archivo, la herramienta avisa cuál falta, pero no puede analizarla.

## 2. Configurar la carrera (una vez por término)

Abre **Configuración** (desde la pantalla inicial con *Configurar materias*, o con el botón *Configuración* del horario o de Cruces). Arriba tiene un recuadro *Cómo usar esta página* con los pasos, y luego dos tablas: **Materias de la carrera** y **Semanas de las prácticas**.

Cuando falta información, la herramienta te lo dice: el botón *Configuración* muestra un número naranja con las materias de la carrera cuyas prácticas no tienen semanas indicadas, y el horario y Cruces muestran un aviso naranja con la lista y el botón **Completar en Configuración**, que te lleva directo a la tabla de semanas.

- **Los cambios se guardan automáticamente** al momento y se aplican al archivo cargado, sin volver a subirlo. No hay botón de guardar.
- **Restaurar valores originales** (al final de la página) vuelve a la malla y a las semanas de laboratorio originales. Pide confirmación antes.

### Materias de la carrera

Cada fila es una materia de la malla:

| Columna | Qué poner |
|---|---|
| **Código** | El código tal como aparece en el reporte, por ejemplo `ELEG1028`. |
| **Materia** | El nombre; se muestra solo, no se edita. |
| **Nivel** | El nivel de la malla curricular, por ejemplo `NIVEL 200 - II`. |
| **Prácticas que puede tomar el estudiante** | Qué prácticas puede inscribir un estudiante según la teoría en la que está. Ver abajo. |

**Las materias de esta lista son las de tu carrera.** Todo lo demás del reporte se ignora en el horario y en el análisis por nivel. La lista viene precargada con las materias profesionales de la malla de Electricidad, los cuadros amarillos: las **ELEG** y las **EYAG** (Principios de Electrónica, Sistemas Digitales I, Sistemas de Control y Electrónica de Potencia I). Las de ciencias básicas y formación general (MATG, FISG, QUIG, CCPG, IDIG, ESTG…) no se incluyen; si quieres considerar alguna, agrégala aquí con su nivel. El nivel se elige de una lista.

### Prácticas que puede tomar el estudiante

En algunas materias, un estudiante de cualquier teoría puede inscribirse en cualquier práctica. Por ejemplo, en ELEG1028 el estudiante de la teoría 1 o de la 2 puede elegir cualquiera de las prácticas 101 a 107. En otras, cada teoría tiene su propia práctica: el estudiante de la teoría 2 solo puede tomar la práctica 102.

El reporte no indica cuál es el caso, así que cada materia tiene tres opciones:

| Opción | Qué significa |
|---|---|
| **Automático: …** | La herramienta lo deduce de los números de paralelo y muestra lo que detectó en el archivo cargado. Si hay dos o más teorías y cada teoría N tiene exactamente su práctica 100+N, toma *solo la práctica de su teoría*; si no, *cualquier práctica*. |
| **Cualquier práctica de la materia** | Con cualquier teoría se puede tomar cualquier práctica. |
| **Solo la práctica de su teoría (1→101, 2→102…)** | La teoría 1 solo con la práctica 101, la 2 con la 102, etc. Las prácticas que no corresponden a ninguna teoría quedan fuera. |

Deja *Automático* salvo que sepas que lo detectado no es correcto. Esta opción cambia la respuesta a «¿se puede tomar todo el nivel sin cruces?»:
- Si la herramienta supone *cualquier práctica* pero en realidad están emparejadas, puede decir «sí es posible» con una combinación que el estudiante no puede inscribir.
- Si supone *emparejadas* pero se puede cualquiera, puede decir «no es posible» cuando sí lo es.

### Semanas de las prácticas (laboratorios)

Algunas prácticas no se dictan todas las semanas, sino en **semanas impares** o **semanas pares** (equivalen a la 1ª y la 2ª quincena). Dos prácticas a la misma hora, una impar y otra par, nunca coinciden, así que **no son un cruce**. El reporte no trae este dato.

**La semana es de cada paralelo, no de la materia.** Una misma materia puede tener la práctica 101 en semanas impares y la 102 en pares, incluso el mismo día. Por eso cada materia tiene dos niveles:

- **Valor de la materia** (la lista de la fila): se aplica a todas sus prácticas. Sirve cuando todas son iguales, como en la tabla de laboratorios.
- **Por paralelo**: abre la lista de las prácticas de esa materia en el archivo, con profesor, día, hora y aula, para indicar cada una. Lo indicado en un paralelo tiene prioridad; *Igual que la materia* usa el valor de la fila. El botón dice cuántos paralelos tienen valor propio, por ejemplo *Por paralelo (1/12)*.

| Opción | Qué significa |
|---|---|
| **Todas las semanas** | La práctica se dicta cada semana. |
| **Semanas impares (1ª quincena)** | Solo en semanas impares. |
| **Semanas pares (2ª quincena)** | Solo en semanas pares. |
| **No se sabe** | Para detectar cruces se trata como *todas las semanas*, así que puede aparecer un cruce que no existe. |

- Los valores iniciales vienen de la tabla de laboratorios de la coordinación (`Laboratorios.xlsx`), como valor de la materia. Lo que sigue sin indicar queda resaltado en naranja, y el título de la tabla dice cuántas materias faltan.
- La herramienta **no adivina semanas**. Aunque dos prácticas compartan aula y hora, siguen apareciendo como cruce hasta que se indiquen sus semanas, porque también puede tratarse de un error de planificación.
- La tabla muestra las materias de la carrera que tienen prácticas en el archivo, las que ya tienen un valor y las de **otras carreras que aparecen en un cruce** de un profesor de tu carrera (marcadas *otra carrera, aparece en un cruce*). También puedes agregar otras con *+ Agregar materia*.

La configuración se guarda en el navegador que estés usando. En otro computador o navegador tendrás que configurarla de nuevo.

## 3. Cargar el archivo

En la pantalla inicial, arrastra el CSV o haz clic para elegirlo y pulsa **Continuar al horario**.

Si aparece un error:
- *«El archivo no tiene el formato del reporte…»*: el CSV no es el reporte «Horario de clases por aula».
- *«Ninguna materia del archivo está en la malla curricular…»*: los códigos de Configuración no coinciden con los del reporte.

El último archivo cargado se recuerda: si cierras la página y vuelves, sigue ahí.

## 4. Horario semanal

Muestra de lunes a viernes, de 07:00 a 22:00, todas las clases de las materias de tu carrera.

- **Filtros:** tipo (teoría o práctica), nivel y profesor, cada uno en una lista desplegable. La primera vez se abre con el **primer nivel** ya filtrado, porque con todos los niveles juntos los bloques no se alcanzan a leer. Después se recuerdan los últimos filtros que usaste.
- **Colores:** cada profesor tiene un color. Haz clic en un nombre de la leyenda para ver solo su horario.
- **Etiquetas:** `TEO` es teoría y `PRA` es práctica. `PRA · IMPAR` y `PRA · PAR`, con rayado, son prácticas de semanas impares o pares. En el detalle, cada práctica dice sus semanas, por ejemplo *PRÁCTICO (semanas impares)* o *PRÁCTICO (no se sabe si semanas impares o pares)*.
- **Detalle:** pasa el mouse sobre una clase (o tócala en el celular) para ver código, paralelo, profesor, horario, aula y nivel.
- **Clases lado a lado:** cuando varias clases coinciden en horario se dibujan una al lado de otra. Que coincidan **no** significa que haya un cruce: suelen ser paralelos distintos de la misma materia.

**Al elegir un profesor** (en el filtro o en la leyenda), el filtro de nivel pasa a *Todos los niveles* y se muestran **todas** sus clases del reporte, también las de otras carreras (en el detalle aparecen como *Nivel: Otra carrera*). Las clases con las que tiene un cruce se marcan en rojo con ⚠︎.

El número sobre el botón **Cruces** es la cantidad de cruces entre profesores, la misma que se lista en esa página.

## 5. Cruces

### Cruces entre profesores

Lista a los profesores de tu carrera que tienen dos clases distintas el mismo día con horas que se solapan. Se revisan **todas** sus clases del reporte, porque un profesor que dicta en tu carrera y en otra a la misma hora también tiene un problema. Esas materias se marcan como *· otra carrera*.

Cada cruce muestra, para las dos clases: código, nombre de la materia, paralelo, semanas (si es práctica), día, horario y aula.

- Haz clic en el nombre de un profesor para abrir su horario y ver el cruce en la grilla.
- Si alguna de las dos prácticas no tiene sus semanas indicadas, aparece una nota naranja *«Puede no ser un cruce real…»* que nombra el paralelo (por ejemplo *EYAG1040 práctica 111*), con el enlace **Indicarlo en Configuración**. Ahí, en *Por paralelo*, indica sus semanas.
- Si las dos clases usan **la misma aula a la misma hora**, la nota lo dice: o alternan semanas (y falta indicarlo) o hay un error de planificación. La herramienta no decide cuál; revísalo.
- **Descargar Excel** baja la lista de cruces en un archivo de Excel (.xlsx), con una columna de observaciones, para enviarla o revisarla con otras personas.

### ¿Se puede tomar todo un nivel sin cruces?

Responde si un estudiante que va al día puede inscribir **todas** las materias de un nivel en el mismo semestre.

1. **Elige un nivel.** La primera vez ya viene elegido el primer nivel. Aparecen las materias del nivel que tienen horario en el archivo, con su código y nombre. Si alguna materia de la malla no está en el reporte, se avisa en un recuadro azul: esas materias **no se consideran** en el análisis.
2. **Cada materia tiene dos listas: teoría y práctica.** La lista de prácticas solo muestra las que se pueden tomar con la teoría elegida. Debajo, una nota indica la regla usada (*cualquier práctica* o *cada teoría solo con su práctica*) y si fue detectada automáticamente o elegida en Configuración.
3. **Buscar combinación sin cruces** encuentra una forma de elegir una opción por materia sin que ninguna se cruce con otra:
   - **Sí es posible:** la combinación se aplica en las listas y en la grilla.
   - **No es posible:** se listan los pares de materias que **siempre** se cruzan, elijas el paralelo que elijas. Esas son las que hay que mover en la planificación.
4. **Ver todas las combinaciones** genera todas las combinaciones sin cruces (hasta 200) y deja recorrerlas con `‹` y `›`. Sirve para ver cuántas alternativas reales tienen los estudiantes. Si hay muy pocas, el nivel queda frágil ante cualquier cambio o paralelo lleno.
5. **Ajuste manual:** puedes cambiar la teoría o la práctica de cualquier materia. Si se cruza con otra, la materia se marca como *cruce* en rojo.

El nivel y los paralelos elegidos se recuerdan al volver a la página.

### Huecos libres del nivel

Las combinaciones responden qué puede inscribir un estudiante. Los huecos responden otra pregunta: **¿a qué hora puedo abrir un paralelo nuevo?**

Debajo de la grilla se marcan las franjas en las que **ningún paralelo de ninguna materia del nivel** tiene clase. Ahí se podría abrir un paralelo nuevo sin chocar con nada de lo que ya se dicta en ese nivel.

- Verde: libre todas las semanas.
- Naranja: libre solo en semanas impares (en esa franja solo hay prácticas de semanas pares).
- Morado: libre solo en semanas pares.

Los huecos se calculan con **todos** los paralelos del nivel, no solo con la combinación elegida. Si las materias del nivel tienen muchos paralelos repartidos en la semana, habrá pocos huecos.

## Preguntas frecuentes

**¿Por qué un nivel muestra menos materias que la malla?**
Por dos razones. Solo se muestran las materias de la carrera (ELEG y EYAG; las de ciencias básicas y formación general no se consideran). Y si alguna de ellas no viene en el archivo, no tiene horario que analizar: el recuadro azul indica cuáles son, con su nombre.

**¿Por qué una materia tiene tantas prácticas para elegir, o solo una?**
Depende de la regla de la materia: con *cualquier práctica* aparecen todas; con *solo la práctica de su teoría* aparece una. Revisa la nota bajo la materia y, si no es correcta, cámbiala en Configuración. Ver [Cómo funciona › Paralelos asociados](como-funciona.md#paralelos-asociados).

**Un profesor aparece con un cruce que no es real.**
Lo más común es que sean dos prácticas de semanas alternas (una impar y otra par) cuyas semanas no están indicadas. Indícalas en Configuración › Semanas de las prácticas › *Por paralelo*; si la materia no aparece en esa tabla, agrégala con *+ Agregar materia*.

**¿Por qué no aparecen las clases del sábado?**
La grilla va de lunes a viernes. Las clases del sábado sí se usan para detectar cruces de profesores.

**¿Mis datos se envían a algún lado?**
No. Todo se procesa y se guarda en tu navegador.
