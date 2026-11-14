# Plan de entrega — demo 3D

**Plazo confirmado:** domingo 15-11-2026, 10:00, Perú (UTC−05:00).
**Plan propuesto:** se ajusta con el equipo; no supone disponibilidad nocturna de todas las personas. La implementación comienza con spec/contratos aceptados y tareas adquiridas en GitHub.

## Tres frentes, un operador actual

El usuario indicó que **por ahora hará todo**. La asignación editable está en [harness/team.json](../harness/team.json): los tres frentes tienen el mismo operador humano, con Gemini para implementar, Terra para QA y Sol para decisiones. El equipo declarado tiene 3 personas, pero este plan no cuenta con tres operadores disponibles a la vez.

| Frente | Entrega | Interfaz / dependencia |
|---|---|---|
| A · Datos y ciencia | Recorte DTM y orto opcional, transformación reproducible, POI documentado, foto y procedencia. | Publica `terrain/v1` y metadatos; debe trabajar con B en la prueba temprana. |
| B · Escena y experiencia | Terreno 3D, cámara, rutas/POIs y paneles de planificación/decisión. | Consume contratos congelados; coordina con C cambios en el estado de misión. |
| C · Dominio, integración y demo | Presupuesto/eventos, pruebas, integración de candidatos y guion/paquete de demo. | Publica `scenario/v1` y `evaluation/v1`; integra después de revisión. |

Son frentes de responsabilidad; sus propietarios por defecto están en el JSON y la asignación viva se confirma en el Issue. Un único operador secuencia las decisiones y la integración; el lead Gemini puede usar subagentes aislados dentro del contrato sin exigir coordinación humana simultánea en tres frentes. Los agentes externos toman trabajo por Issue, declaran sus capacidades/modelos y no escriben en el checkout de otro agente.

## Paquetes verticales propuestos

| Paquete | Resultado observable | Dependencia |
|---|---|---|
| WP-01 · Prueba de datos y 3D | Un recorte real con altura y dos puntos de control se ve en Chrome; ortoimagen alineada si se incorpora, o color de elevación con leyenda. | Fuente/footprint y contrato de terreno aceptado; primer riesgo a resolver. |
| WP-02 · Planificar la salida | Dos rutas visibles con objetivo, costes y reserva; seleccionar cambia la misión. | `scenario/v1`, terreno mínimo de WP-01. |
| WP-03 · Una parada más | Ir, observar, comparar 15/35 con reserva 20, decidir y completar la vuelta. | WP-02 y reglas de autonomía. |
| WP-04 · Fuentes y demo estable | Foto y procedencia, errores útiles, reinicio, assets locales y recorrido repetible. | Flujo WP-03. |
| WP-05 · QA y ensayo | Terra entrega evidencia independiente sobre el candidato; correcciones acotadas y ensayo final. | WP-04. |

No se han creado estos Issues ni asignado operadores. Son el backlog que se convertirá en tareas tras acordar el spec; no hay que abrir todo en paralelo ni crear un PR por componente trivial. Un lead AGY por repositorio coordina paquetes y dependencias, en consonancia con el protocolo de tareas de GitHub.

## Cortes propuestos, hora de Perú

| Momento | Hito |
|---|---|
| Primeros 90 min de ejecución | Prueba WP-01 con DEM real. Si falla un producto, cambiar por otro verificable de la misma zona o llevar a decisión un cambio de recorte/objetivo. |
| 14-11, 20:00 | Terreno y flujo de planificación integrables con contratos estables. |
| 14-11, 22:30 | Primer recorrido completo: salida → observación → decisión → regreso. |
| 14-11, 23:30 | Corte de funciones; quedan correcciones del recorrido, datos y rendimiento. |
| 15-11, 08:00–09:00 | QA de Terra en el dispositivo/navegador de demo y correcciones bloqueantes. |
| 15-11, 09:00 | Candidato final identificado por commit; paquete local probado. Publicación solo por operador autorizado. |
| 15-11, 09:15–09:45 | Dos ensayos completos, fuentes/atribuciones y respaldo de demo. |
| 15-11, 10:00 | Demo. |

Si el tiempo se reduce, eliminar animaciones, densidad de malla, capas opcionales y contexto RAD antes de comprometer el flujo central. El 3D, los datos reales y la explicación de autonomía permanecen como requisitos. No sustituir un DTM fallido por relieve generado sin volver al usuario.

## Definición de terminado de la demo

Spec/contratos aceptados, MVP-01…MVP-10 cubiertos, datos incorporados con procedencia, sin defectos que rompan el recorrido, candidato reproducible y dos ensayos. Un build correcto es una evidencia parcial. [QA.md](QA.md) define los casos mínimos y qué debe quedar registrado.
