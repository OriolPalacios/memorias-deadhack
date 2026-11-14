# Decisiones y preguntas abiertas

**Fecha:** 2026-11-14 · **Revisión del spec:** 0.2.
Este registro captura la conversación actual; las decisiones duraderas se aprueban y fusionan mediante el protocolo de `memorias/`. No marca retroactivamente ADR-0001 como aceptado ni sobrescribe las instantáneas de memoria.

## Confirmadas por el usuario en esta conversación

| ID | Decisión | Consecuencia |
|---|---|---|
| C-01 | Copiloto para astronautas, antes y durante la caminata. | Planificación y decisión en ruta forman un único recorrido de demo. |
| C-02 | Terreno 3D desde el MVP. | La malla con elevación real es un criterio de aceptación; el 2D no sustituye este requisito. |
| C-03 | Equipo de 3 personas; demo 15-11-2026, 10:00, Perú. | Corte temprano de alcance y QA sobre un candidato estable. |
| C-04 | Usar sol-antigravity-orchestrator: Sol 6.1 max para decisiones; Gemini 4 Hydrogen xhigh para implementar; Terra 6.1 max para QA. | El perfil explícito reemplaza el nombre/valor por defecto más antiguo de la skill. No sustituir modelos/esfuerzo sin decisión del operador. |
| C-05 | Varios entornos/agentes participarán; memoria compartida en `memorias/`, harness/producto fuera. | Integración por Issues/PRs y contratos portables; no se supone memoria conversacional común. |
| C-06 | El usuario ya hizo pull y autorizó revisar la estructura de memorias. | Lectura e integración por referencia realizadas; no reestructurar esa carpeta en esta tarea. |
| C-07 | Los cinco recursos son Perseverance Raw Images, Worldview, mapa de Curiosity, USGS Mars y Mars Trek. | Registro preciso en RESOURCES; distinguir datos de Marte y referencias de diseño. |
| C-08 | Por ahora el usuario opera todos los frentes; pidió una asignación fácilmente modificable en JSON. | `harness/team.json` registra propietarios por defecto y roles; Issues/PRs conservan la asignación viva de tareas. |

## Recomendaciones de Sol pendientes de aceptación

| ID | Propuesta y motivo |
|---|---|
| P-01 | Caso «Una parada más» en Enchanted Lake/Jezero, con dos rutas curadas y un único punto de decisión. Continúa el contexto de Miro y concentra la demo. La cobertura y la ubicación exacta requieren evidencia antes del contrato de datos. |
| P-02 | React/TypeScript/Vite + Three.js/React Three Fiber; escena local preparada y distribución estática. Minimiza dependencias operativas para mañana. |
| P-03 | Recomendación determinista, sin chat libre ni LLM en tiempo de ejecución. La explicación y los números son comprobables. |
| P-04 | Un presupuesto en minutos de autonomía simulada; tiempos A/B y precedencia de recomendación explícitos en el spec. Déficit de presupuesto y de reserva tienen unidades y semánticas distintas. Evita modelos de soporte vital sin base. |
| P-05 | Una malla pequeña, cámara orbital, HTML para decisiones y fuentes; assets locales. Recortar detalle visual antes que eliminar el terreno 3D. |
| P-06 | Corte de funciones 14-11 a las 23:30; candidato final 15-11 a las 09:00. Horario de trabajo propuesto, no disponibilidad del equipo confirmada. |
| P-07 | Textura orbital opcional; terreno de elevación real obligatorio. Sin ortoimagen se muestra color de elevación y leyenda, además de la foto científica de superficie. Mantiene el requisito 3D y reduce riesgo de datos/plazo. |

## Abiertas y quién debe resolverlas

| ID | Pregunta / siguiente acción | Responsable | Bloquea |
|---|---|---|---|
| Q-01 | Revisar y aceptar spec 0.2 y propuestas técnicas aplicables o dar correcciones. | Usuario/equipo con Sol | Contratos de implementación de producto. |
| Q-02 | Elegir DTM y recorte con cobertura; obtener posición documentada del objetivo y transformación a escena. | Gemini Ground / operador de datos | Terreno y colocación científica reales. |
| Q-03 | Comprobar geometrías de ambas rutas sobre el recorte y aceptar los tiempos didácticos A/B del spec, sin atribuir transitabilidad verificada a una ruta simulada. | Sol + operador de datos | Congelar `scenario/v1`. |
| Q-04 | Asignación inicial resuelta: todos los frentes a cargo del usuario en `harness/team.json`. Si se suman operadores/agentes externos, actualizar el JSON y declarar capacidades/propietarios en los Issues. | Usuario/equipo | No bloquea el reparto inicial; solo futuras reasignaciones. |
| Q-05 | Seleccionar hosting estático y persona autorizada para publicar; confirmar dispositivo de demo. | Usuario/equipo | Publicación y ensayo de rendimiento final. |
| Q-06 | Preparar permisos de la futura tarea de escritura AGY; la consulta acotada de lectura ya funciona. Ver RUNTIME. | Orquestador/operador | Ejecución autónoma de implementación, no esta planificación. |

## Hechos de repositorio y runtime

- Base observada tras el pull: `f7cf792`; la estructura compartida entró mediante PR #1. No existe app, package manifest ni pruebas de producto en esta base.
- Se abrió [Issue #2](https://github.com/OriolPalacios/memorias-deadhack/issues/2) y la rama `docs/issue-2-harness-spec-mvp` para esta documentación.
- `agy models` lista `gemini-4-hydrogen-xhigh` y `agy --help` admite `--effort xhigh`.
- El wrapper upstream `agy_compact.py --help` solo acepta `low|medium|high`; no es compatible con el esfuerzo solicitado sin adaptación o uso directo de CLI.
- Ground G-001 devolvió `status: SUCCESS` pero respuesta vacía y una acción `command` denegada por AGY. Se considera **incompleto**, no evidencia de Ground satisfactorio. Los logs permanecen locales en `.sol-orchestrator/`.
- Probe G-002 con el mismo modelo/esfuerzo y permiso acotado retornó una respuesta con `v24.13.1`, pero sin traza de herramienta; no se toma como prueba de ejecución o de ausencia de denegaciones.
- Probe G-003, con `stream-json` y permiso exacto `command(node --version)`, registró `run_command` ACTIVE/DONE, el comando esperado, `v24.13.1` y exit 0. Comprueba esa ejecución de lectura; no valida permisos generales de implementación. La traza completa y su extracción acotada permanecen locales.
