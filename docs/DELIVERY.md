# Plan de entrega — demo 3D

**Plazo confirmado:** domingo 15-11-2026, 22:00, Perú (UTC−05:00).
**Plan operativo propuesto:** el usuario ya aprobó el spec 0.3 y la base de aplicación; los horarios se ajustan con el equipo. Cada implementación empieza con su contrato específico y tarea adquirida en GitHub. Hosting aplazado; el desarrollo y los ensayos locales pueden avanzar.

## Frentes y operadores actuales

El usuario asignó **datos y contratos a Lucian**, cuyo Ground/revisión está en [Issue #6](https://github.com/OriolPalacios/memorias-deadhack/issues/6). Oriol mantiene experiencia, dominio, integración y demo. La asignación editable está en [harness/team.json](../harness/team.json). El equipo declarado tiene 3 personas; no se presupone disponibilidad del tercer operador. Los perfiles de este orquestador siguen siendo Gemini para implementar, Terra para QA y Sol para decisiones; no se atribuye a esos modelos el trabajo externo de Lucian sin evidencia.

| Frente | Entrega | Interfaz / dependencia |
|---|---|---|
| A · Datos y contratos · Lucian | Recorte DTM, capa térmica, orto opcional, transformación, POI/foto y procedencia; revisión de contratos del visor. | Prepara contratos/metadatos compatibles con B y C; su entrega actual se registra en #6. |
| B · Escena y experiencia | Terreno 3D, cámara, rutas/POIs y paneles de planificación/decisión. | Consume contratos congelados; coordina con C cambios en el estado de misión. |
| C · Dominio, integración y demo · Oriol | Presupuesto/eventos, pruebas, integración y guion/paquete de demo. | Implementa el dominio con interfaces acordadas junto a Lucian; Sol resuelve el comportamiento de producto. |

Son frentes de responsabilidad; sus propietarios por defecto están en el JSON y la asignación viva se confirma en el Issue. Oriol secuencia la integración y Lucian prepara los insumos de datos/contratos. Los agentes externos toman trabajo por Issue, declaran sus capacidades/modelos y no escriben en el checkout de otro agente.

## Paquetes verticales propuestos

| Paquete | Resultado observable | Dependencia |
|---|---|---|
| WP-01 · Prueba de datos y 3D | Un recorte real con altura y dos puntos de control se ve en Chrome; ortoimagen alineada si se incorpora, o color de elevación con leyenda. | Fuente/footprint y contrato de terreno aceptado; primer riesgo a resolver. |
| WP-02 · Planificar la salida | Dos rutas visibles con objetivo, costes y reserva; seleccionar cambia la misión. | `scenario/v1`, terreno mínimo de WP-01. |
| WP-03 · Una parada más | Ir, observar, comparar 15/35 con reserva 20, decidir y completar la vuelta. | WP-02 y reglas de autonomía. |
| WP-04 · Capas y demo estable | Térmica activable y trazada, foto/fuentes, errores útiles, reinicio, assets locales y recorrido repetible. | Flujo WP-03 y producto térmico preparado. |
| WP-05 · QA y ensayo | Terra entrega evidencia independiente sobre el candidato; correcciones acotadas y ensayo final. | WP-04. |

Estos paquetes son el backlog de producto, no una afirmación de Issues ya creados para cada uno. #6 ya cubre Ground y revisión de datos/contratos a cargo de Lucian. El spec está aprobado: bootstrap y dominio pueden pasar a tareas de ejecución con sus interfaces acordadas; la integración del terreno depende del paquete de datos. Un lead AGY por repositorio coordina su ejecución con las dependencias de los agentes externos.

## Cortes propuestos, hora de Perú

| Momento | Hito |
|---|---|
| Primeros 90 min de ejecución | Prueba WP-01 con DEM real. Si falla un producto, cambiar por otro verificable de la misma zona o llevar a decisión un cambio de recorte/objetivo. |
| 15-11, 15:00 | Terreno y planificación integrables con contratos estables. |
| 15-11, 18:00 | Primer recorrido completo: salida → observación → decisión → regreso, con capa térmica incorporable. |
| 15-11, 19:30 | Corte de funciones; quedan correcciones del recorrido, datos y rendimiento. |
| 15-11, 19:30–20:30 | QA de Terra y correcciones bloqueantes en el dispositivo/navegador de demo. |
| 15-11, 21:00 | Candidato final identificado por commit; paquete local probado. Publicación por operador autorizado. |
| 15-11, 21:15–21:45 | Dos ensayos, fuentes/atribuciones y respaldo de demo. |
| 15-11, 22:00 | Demo. |

Si el tiempo se reduce, eliminar animaciones, densidad de malla, capas opcionales y contexto RAD antes de comprometer el flujo central. El 3D, los datos reales y la explicación de autonomía permanecen como requisitos. No sustituir un DTM fallido por relieve generado sin volver al usuario.

## Definición de terminado de la demo

Spec/contratos aceptados, MVP-01…MVP-11 cubiertos, datos incorporados con procedencia, sin defectos que rompan el recorrido, candidato reproducible y dos ensayos. Un build correcto es una evidencia parcial. [QA.md](QA.md) define los casos mínimos y qué debe quedar registrado.
