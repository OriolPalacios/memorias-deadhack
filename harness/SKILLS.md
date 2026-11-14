# Skills del proyecto

No se cargan todas en cada sesión. Leer únicamente la que aplica al trabajo actual y sus referencias pertinentes. Las skills globales son dependencias del entorno del operador; no se copian ni se dan por instaladas en otras cuentas.

| Skill | Cuándo aplica | Ubicación / estado |
|---|---|---|
| `sol-antigravity-orchestrator` | Obligatoria para la coordinación Sol→AGY solicitada; Planning, Ground, Execution y revisión. | En esta máquina: `/Users/oriolpalacios/.codex/skills/sol-antigravity-orchestrator/SKILL.md`. Verificada. Los otros operadores deben habilitar la misma skill o aportar la ruta correspondiente; no crear una copia que derive silenciosamente. |
| `mars-data-provenance` | Seleccionar, transformar, revisar o incorporar datos e imágenes marcianos. | [Skill local versionada](skills/mars-data-provenance/SKILL.md). |
| `deadhack-mvp-qa` | Revisar el spec/contratos o validar un candidato del MVP con Terra. | [Skill local versionada](skills/deadhack-mvp-qa/SKILL.md). |
| `design-taste-frontend` | Diseño o implementación visual de la interfaz, cuando está disponible. | En esta máquina: `/Users/oriolpalacios/.codex/skills/design-taste-frontend/SKILL.md`. Leer antes de aplicarla; el plazo y los requisitos del usuario conservan prioridad. No bloquea una tarea de datos. |
| `skill-creator` | Mantener las dos skills locales o crear una nueva necesidad de trabajo recurrente. | En esta máquina: `/Users/oriolpalacios/.codex/skills/.system/skill-creator/SKILL.md`. No necesaria para ejecutar la app. |

## Ajustes explícitos para esta sesión

El nombre de modelo de la skill de orquestación es anterior al pedido actual. Se usan **Sol 6.1 max**, **Gemini 4 Hydrogen xhigh** y **Terra 6.1 max**, tal como exige el usuario. Su recomendación de wrapper se conserva solo cuando el wrapper pueda representar el esfuerzo pedido y validar el reporte; actualmente hay una incompatibilidad documentada en [RUNTIME.md](RUNTIME.md).

No incorporar al MVP skills de base de datos, autenticación, agentes residentes o generación de imágenes científicas solo por estar disponibles. Se añaden herramientas/skills cuando una tarea y un criterio de aceptación las necesitan. Una imagen generada puede servir para exploración estética si se pide, pero nunca sustituye la fotografía o el terreno de NASA.

Las skills se guardan bajo `harness/skills/` para que cualquier entorno pueda leerlas desde el repo. El punto de entrada `AGENTS.md` las referencia; no se presupone descubrimiento automático. El operador adjunta/indica el `SKILL.md` pertinente si su cliente lo requiere.
