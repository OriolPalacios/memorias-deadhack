# Decisiones y preguntas abiertas

**Fecha:** 2026-11-15 · **Revisión del spec:** 0.3.
Este registro captura la conversación actual; las decisiones duraderas se aprueban y fusionan mediante el protocolo de `memorias/`. No marca retroactivamente ADR-0001 como aceptado ni sobrescribe las instantáneas de memoria.

## Confirmadas por el usuario en esta conversación

| ID | Decisión | Consecuencia |
|---|---|---|
| C-01 | Copiloto para astronautas, antes y durante la caminata. | Planificación y decisión en ruta forman un único recorrido de demo. |
| C-02 | Terreno 3D desde el MVP. | La malla con elevación real es un criterio de aceptación; el 2D no sustituye este requisito. |
| C-03 | Equipo de 3 personas; deadline actualizado por el usuario al 15-11-2026, 22:00, Perú. | Sustituye el plazo anterior de las 10:00; reajustar los cortes y el QA. |
| C-04 | Usar sol-antigravity-orchestrator: Sol 6.1 max para decisiones; Gemini 4 Hydrogen xhigh para implementar; Terra 6.1 max para QA. | El perfil explícito reemplaza el nombre/valor por defecto más antiguo de la skill. No sustituir modelos/esfuerzo sin decisión del operador. |
| C-05 | Varios entornos/agentes participarán; memoria compartida en `memorias/`, harness/producto fuera. | Integración por Issues/PRs y contratos portables; no se supone memoria conversacional común. |
| C-06 | El usuario ya hizo pull y autorizó revisar la estructura de memorias. | Lectura e integración por referencia realizadas; no reestructurar esa carpeta en esta tarea. |
| C-07 | Los cinco recursos son Perseverance Raw Images, Worldview, mapa de Curiosity, USGS Mars y Mars Trek. | Registro preciso en RESOURCES; distinguir datos de Marte y referencias de diseño. |
| C-08 | El usuario pidió una asignación fácilmente modificable en JSON; inicialmente todos los frentes estaban a su cargo. | `harness/team.json` registra propietarios por defecto; la asignación de datos se actualiza con C-09. |
| C-09 | Lucian atiende datos y contratos; #6 confirma su trabajo de Ground/revisión con Codex. | Lucian figura como propietario del frente de datos; no se duplican ni editan sus entregables desde el harness. |
| C-10 | El copiloto dará recomendaciones explicadas, sin chat libre con IA. | Evaluación determinista en el navegador; no hay dependencia de una API de LLM para la demo. |
| C-11 | Incluir la capa térmica en el MVP; el usuario indicó asumir su inclusión y remitió al relevo de Lucian en PR #3. | Se añade MVP-11. El relevo identifica mosaicos THEMIS públicos; el recorte concreto y su contrato siguen dentro del frente de datos. |

## Recomendaciones de Sol pendientes de aceptación

| ID | Propuesta y motivo |
|---|---|
| P-01 | Caso «Una parada más» en Enchanted Lake/Jezero, con dos rutas curadas y un único punto de decisión. Continúa el contexto de Miro y concentra la demo. La cobertura y la ubicación exacta requieren evidencia antes del contrato de datos. |
| P-02 | React/TypeScript/Vite + Three.js/React Three Fiber; escena local preparada y distribución estática. Minimiza dependencias operativas para mañana. |
| P-04 | Un presupuesto en minutos de autonomía simulada; tiempos A/B y precedencia de recomendación explícitos en el spec. Déficit de presupuesto y de reserva tienen unidades y semánticas distintas. Evita modelos de soporte vital sin base. |
| P-05 | Una malla pequeña, cámara orbital, HTML para decisiones y fuentes; assets locales. Recortar detalle visual antes que eliminar el terreno 3D. |
| P-06 | Corte de funciones 15-11 a las 19:30; candidato final a las 21:00; ensayo antes de las 22:00. Horario propuesto para el nuevo plazo. |
| P-07 | Textura orbital opcional; terreno de elevación real obligatorio. Sin ortoimagen se muestra color de elevación y leyenda, además de la foto científica de superficie. Mantiene el requisito 3D y reduce riesgo de datos/plazo. |

## Abiertas y quién debe resolverlas

| ID | Pregunta / siguiente acción | Responsable | Bloquea |
|---|---|---|---|
| Q-01 | Revisar y aceptar spec 0.3 y base técnica recomendada, o dar correcciones. Chat y capa térmica ya están resueltos por C-10/C-11. | Usuario/equipo con Sol | Contratos de implementación de producto. |
| Q-02 | Completar cobertura A/B, objetivo y transformación; preparar recorte térmico y leyenda. Conciliar el avance de muestreo reportado en el comentario de PR #3 con el informe versionado de PR #7. | Lucian, frente de datos; coordinación #6 | Assets preparados y colocación científica reales. |
| Q-03 | Revisar contratos de terreno, escenario y evaluación, geometrías y tiempos didácticos A/B, sin atribuir transitabilidad verificada a la simulación. | Lucian prepara/revisa contratos; Sol resuelve decisiones de producto | Interfaces aceptadas para productores/consumidores. |
| Q-04 | Asignación actual: Lucian en datos/contratos y Oriol en los demás frentes, registrados en `harness/team.json`. | Usuario/equipo | No bloquea el reparto; confirmar cambios en los Issues correspondientes. |
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
