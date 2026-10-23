# Visualizador de Horarios ESPOL

Herramienta para coordinadores de carrera que revisan la planificación de un término. A partir del reporte de horarios del sistema académico responde:

- **¿Pueden los estudiantes de la carrera tomar todas las materias de un nivel en el mismo semestre sin cruces?** Busca combinaciones de paralelos sin cruces, señala qué materias se cruzan siempre y muestra los huecos donde cabría abrir un paralelo nuevo.
- **¿Algún profesor de la carrera tiene dos clases a la misma hora?** Revisa todas sus clases del reporte, también las que dicta en otras carreras.

Es una página web estática: todo se procesa en el navegador y nada se envía a un servidor.

## Uso rápido

1. Exporta del sistema académico el reporte **«Horario de clases por aula»** del término, en **CSV**.
2. Abre la página y carga el archivo.
3. Revisa en **Configuración** que la malla (código → nivel) corresponda a tu carrera.
4. Consulta el **horario semanal** y la página de **Cruces**.

## Documentación

- [Guía de uso](docs/guia-de-uso.md): paso a paso para coordinadores, cómo leer cada pantalla y preguntas frecuentes.
- [Cómo funciona](docs/como-funciona.md): qué datos se leen, cómo se completan los que faltan y qué cuenta como cruce.
- [Desarrollo](docs/desarrollo.md): instalación, estructura del código y flujo de datos.

## Ejecutar localmente

Requiere Node.js LTS (probado con Node.js 24).

```bash
npm install
npm run dev
```

Para publicarla, `npm run build` genera `dist/`, que se puede servir desde cualquier hosting estático.
