# Harness de trabajo de DeadHack

Este harness reúne **instrucciones, perfiles de modelos, skills y contratos portables**. No ejecuta agentes por sí solo, no conecta cuentas, no es una segunda cola de tareas ni implica que los runtimes estén autenticados. La coordinación compartida continúa en GitHub según [memorias/PROTOCOLO.md](../memorias/PROTOCOLO.md).

## Arranque de una sesión

1. Leer `AGENTS.md` y el orden establecido en [memorias/README.md](../memorias/README.md); consultar el Issue, comentarios y PR vigentes. Una instantánea en memoria puede estar desactualizada.
2. Leer [el spec](../docs/SPEC.md) y su estado, [las decisiones](../docs/DECISIONS.md) y únicamente los contratos relevantes. Un borrador no habilita implementación de requisitos abiertos.
3. Comprobar capacidades del entorno: modelo/esfuerzo, acceso al repo, herramientas y skill requerida. [RUNTIME.md](RUNTIME.md) registra lo que se ha comprobado localmente y lo que falta.
4. Adquirir la tarea en el Issue, con operador humano, rol/modelo, rama, rutas permitidas y dependencias. Cada escritor usa su propio clon/worktree. No realizar un pull sobre trabajo ajeno sin comprobarlo.
5. Usar el [workflow aplicable](WORKFLOWS.md), la [plantilla de contrato](templates/TASK.md) y el [formato de reporte](templates/REPORT.md).

## Qué leer según el rol

| Recurso | Propósito |
|---|---|
| [agents.json](agents.json) | Perfiles pedidos por el usuario y límites de orquestación. Es declarativo; no es configuración reconocida automáticamente por Codex/AGY. |
| [team.json](team.json) | Asignación humana editable por frente. Lucian atiende datos y contratos (#6); Oriol, experiencia, dominio y demo. El estado efectivo se confirma en cada Issue. |
| [ROLES.md](ROLES.md) | Contratos de responsabilidad y prompts breves de arranque. |
| [SKILLS.md](SKILLS.md) | Skills requeridas, condicionales y sus ubicaciones. |
| [WORKFLOWS.md](WORKFLOWS.md) | Planning, Ground, implementación, QA, corrección y handoff externo. |
| [RUNTIME.md](RUNTIME.md) | Selección real de modelos, permisos y reglas para validar una ejecución AGY. |
| [QA del producto](../docs/QA.md) | Casos de prueba del futuro MVP y evidencias. |
| [Plan de entrega](../docs/DELIVERY.md) | Paquetes, dependencias, frentes humanos y cortes de demo. |

## Memoria y autoridad

`memorias/` conserva conocimiento compartido y convenciones; `docs/` describe el producto; `harness/` describe cómo trabajar. Los contratos aceptados quedan identificados por revisión/commit y PR aprobado, siguiendo el protocolo existente. Este harness no convierte recomendaciones de Sol en requisitos aprobados automáticamente.

`.sol-orchestrator/` contiene estado local, preguntas de Ground y logs sin versionar. No es memoria compartida ni fuente de estado de tareas. Al entregar, trasladar solo conclusiones, referencias y evidencia relevante al Issue/PR o al handoff establecido; no subir logs completos, conversaciones o rutas privadas de otra persona.

Para repartir trabajo, añadir el operador a `team.json.operators`, incluirlo en `current_operator_ids` cuando esté activo y actualizar `owner_operator_id` en los frentes correspondientes; los IDs de rol de agente se resuelven contra `agents.json`. Después actualizar/adquirir los Issues afectados: editar el JSON no reasigna automáticamente tareas ni concede permisos de publicación.

Los perfiles de implementación/QA del JSON son los valores por defecto del orquestador. Una tarea externa activa puede declarar su runtime/modelo efectivo por separado; `null` significa que no está registrado. El trabajo de Ground/revisión de Lucian con Codex en #6 no se atribuye a Gemini.

No se cambia la estructura de `memorias/` desde este Issue. Cuando haya que actualizar una decisión duradera o su índice de contratos, el coordinador prepara un cambio acotado según su protocolo. Los handoffs normales pueden incluirse en el PR sin abrir un archivo adicional.
