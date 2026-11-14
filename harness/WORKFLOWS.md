# Workflows del harness

GitHub es el estado compartido. Se conserva una tarea/Issue/rama/PR y un responsable primario, según [PROTOCOLO](../memorias/PROTOCOLO.md). Estos workflows detallan la asignación de modelos, no reemplazan ese ciclo.

## 1. Planning y aceptación

Sol interpreta la petición, revisa evidencia y actualiza `docs/SPEC.md`, `ARCHITECTURE.md` y `DECISIONS.md` en el Issue de definición. Requisitos confirmados se distinguen de propuestas técnicas. Las preguntas se llevan al usuario cuando requieren juicio o información no disponible.

Antes de ejecutar producto, el equipo acepta alcance y contratos por el mecanismo de revisión del repo. El contrato de tarea identifica revisión y commit/PR de spec aceptado, dependencias, rutas y pruebas. El manifest pasa de `draft` a `accepted` únicamente con esa evidencia. Un cambio en `implementation_enabled` no constituye por sí solo aprobación ni ejecuta nada.

## 2. Ground de un hecho faltante

Sol redacta una pregunta acotada para Gemini: hecho que falta, rutas/fuentes, evidencia esperada y prohibición de cambiar código o decidir arquitectura. Gemini devuelve conclusión, confianza, paths/símbolos o URLs/productos, comportamiento observado e incertidumbres.

Guardar logs completos en `.sol-orchestrator/runs/<id>/`; el modelo de razonamiento recibe solo el reporte compacto y referencias. No repetir búsquedas si una evidencia válida ya responde la pregunta. Validar salida/permisos con [RUNTIME](RUNTIME.md): un `SUCCESS` vacío no es un Ground válido.

## 3. Ejecución normal

1. Reclamar Issue y comprobar tarea/contratos aceptados; crear rama/worktree aislados a partir de la base revisada. El operador registra explícitamente cualquier cambio de asignación.
2. Sol congela un [contrato de tarea](templates/TASK.md) por Issue/entrega: misión, límites, interfaces, dependencias, propiedad, validación y formato de reporte. Un lead AGY por repo atiende ese contrato; los paquetes se secuencian para no multiplicar coordinadores sobre el mismo repo.
3. Gemini implementa, valida, corrige y se auto-revisa dentro del contrato. Puede delegar lectura o subpaquetes nativos cuando los permisos/propiedad lo permitan. Los escritores adicionales requieren Issues y worktrees propios; no se comparte un árbol mutable.
4. Gemini entrega reporte y evidencia requisito→artefacto. No devuelve transcripciones extensas a Sol.
5. Terra revisa un candidato identificado e inmóvil. Sol juzga cumplimiento semántico, scope y contratos con ese reporte y la evidencia del implementador.
6. Si corresponde, preparar PR con handoff. No confundir PR abierto con integración. Merge y publicación se realizan por una persona autorizada.

**Execution Ultra** está deshabilitado por defecto. Solo se usa ante petición explícita de Ultra/Teamwork y contrato apropiado; no se activa para recuperar un fallo de permisos o para ahorrar un intento de coordinación.

## 4. QA y corrección

Terra aplica [QA.md](../docs/QA.md) al candidato y reporta PASS/FIX REQUIRED/BLOCKED. Cada defecto tiene criterio violado, severidad, reproducción, resultado observado y evidencia; una prueba no ejecutada se identifica como tal.

Sol entrega a Gemini un contrato de corrección con el Issue/candidato, estado final requerido, rutas, invariantes y pruebas afectadas. Se retoma la conversación AGY anterior cuando sea útil. No reabrir exploración global ni cambiar requisitos por un test que falló.

Gemini corrige y entrega nuevo commit/reporte. Terra vuelve a verificar los defectos y el recorrido afectado. Terminar cuando los requisitos estén cubiertos, o declarar una contradicción/dependencia concreta que el operador deba resolver; no hacer retries ilimitados sobre el mismo bloqueo.

## 5. Handoff hacia otra cuenta o entorno

Entregar en Issue/PR las secciones de [memorias/HANDOFFS/PLANTILLA.md](../memorias/HANDOFFS/PLANTILLA.md): estado, modelo/operador, rama/commit, alcance, contratos, fuentes, pruebas observadas, pendientes, riesgos y siguiente paso preciso. Usar archivo bajo `memorias/HANDOFFS/` solo si el alcance lo autoriza y el traspaso lo necesita; para esta tarea se entrega en el PR.

El receptor comprueba el estado vivo del Issue/PR y la revisión de contratos antes de retomar. Si cambió `main`, compara los cambios de su ámbito; no aplica un pull o reseteo que destruya trabajo local. Una divergencia entre memoria, spec e Issue se devuelve al coordinador, conservando los hechos y la solicitud más reciente del usuario.

## 6. Integración de cambios de memoria

El pull de la estructura inicial ya lo realizó el usuario. Cambios futuros se leen al recibir aviso o al preparar una tarea nueva, comprobando primero el worktree. Se adaptan enlaces/protocolos del harness mediante su propio Issue/PR; no se reescribe la estructura del colega para ajustarla a Codex.

Los archivos de `memorias/` que siguen diciendo «pendiente» no se actualizan automáticamente por una propuesta local de este harness. Tras la aceptación e integración del spec, un coordinador puede refrescarlos en un cambio acotado.
