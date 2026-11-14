# Runtime de los agentes

**Comprobaciones locales:** 2026-11-14. Estos resultados pertenecen a este entorno, no a todas las cuentas del equipo.

| Capacidad | Estado observado |
|---|---|
| CLI `agy` | Disponible en PATH. `--help` muestra modos `plan`, `accept-edits`, `auto` y esfuerzos `low/medium/high/xhigh/max`. |
| Modelo solicitado | `agy models` lista `gemini-4-hydrogen-xhigh` («Gemini 4 Hydrogen (XHigh)»). |
| Wrapper upstream | `agy_compact.py --help` admite solo `low/medium/high`. No pasar `high` para simular una ejecución xhigh. |
| Runtime base | Node `v24.13.1`, npm `11.8.0`, Python `3.9.6`. App, dependencias, tests y pipeline geoespacial aún no instalados/verificados. |
| Consulta headless con herramientas | G-001 retornó exit 0 y `SUCCESS`, pero `response` vacía y `denied_actions: command/Bash`. **No fue un Ground satisfactorio.** |
| Respuesta con permiso acotado | G-002 retornó una respuesta del agente con `v24.13.1`; su envelope no contiene rastro de herramienta ni clave `denied_actions`. Esa respuesta por sí sola no prueba ejecución ni ausencia de denegaciones. |
| Ejecución de lectura con traza | G-003, Hydrogen xhigh y `--settings {"permissions":{"allow":["command(node --version)"]}}`: eventos `run_command` ACTIVE/DONE para `node --version`, salida `v24.13.1` y exit 0. Se verificó ese comando, no permisos generales de implementación. |
| Sol / Terra | Los IDs de perfil del harness son `gpt-6.1-sol` y `gpt-6.1-terra`, esfuerzo `max`. El operador debe comprobar selección/capacidad real en cada entorno. |

## Perfil de invocación AGY

Para la futura ejecución, seleccionar explícitamente:

```text
--model gemini-4-hydrogen-xhigh
--effort xhigh
--output-format json
--print-timeout <límite-acotado>
```

En Ground, usar modo de planificación y alcance de solo lectura. No combinar `--mode plan` con `--disable-slash-commands`: en el intento observado AGY advirtió que esa combinación deja el modo sin efecto. Un Ground debe seguir siendo de solo lectura por su contrato y sus permisos, no solo por la etiqueta de modo.

Hasta adaptar/revisar el wrapper, usar CLI directo con captura de stdout/stderr a archivos locales y una extracción compacta posterior. No se añadió un launcher propio ni se modificó la skill global en esta tarea de Planning. No copiar comandos con sustitución de shell de contenido no confiable; pasar prompts como argumentos estructurados desde un launcher revisado o desde el cliente del operador.

## Preflight antes de una tarea de escritura

1. Confirmar Issue, operador, modelo/esfuerzo, spec aceptado, contrato y rama/worktree aislados.
2. Leer las referencias de Execution y runtime de la skill. Verificar el modo y las aprobaciones que soporta la versión instalada.
3. Probar herramientas con permisos específicos del ámbito. G-003 verificó una regla exacta para un solo comando; los permisos de lectura/escritura de cada contrato se configuran y verifican por separado, sin generalizar esa regla a cualquier terminal. Una denegación headless se informa y se corrige; no se toma como respuesta a la pregunta de Ground.
4. No usar `--dangerously-skip-permissions` por defecto. Si una ejecución autónoma autorizada lo necesita, cumplir las condiciones de aislamiento y alcance de la skill; nunca aplicarlo al checkout compartido o a `main`.
5. Guardar modelo, esfuerzo, modo, timeout, revisión del contrato, conversación y resultado real. Si falta un modelo/herramienta, devolver la limitación al operador sin fallback silencioso.

La sesión AGY puede necesitar acceso a sus logs y servidor local además de la carpeta del proyecto; el primer `agy models` falló bajo el sandbox del proceso padre y la consulta se pudo realizar con la aprobación del entorno. Esto no equivale a permiso de escritura autónoma para herramientas internas de AGY.

## Validación de resultados y context firewall

Guardar localmente `raw.json`, `stderr.log`, metadata del run y el reporte normalizado. No versionar logs completos ni considerar `.sol-orchestrator/` un registro compartido.

Un run aceptable requiere conjuntamente:

- Proceso completado y estado final coherente.
- Respuesta o salida estructurada **no vacía** y compatible con el contrato de reporte.
- Ninguna acción esencial denegada o timeout oculto.
- Requisitos mapeados a artefactos/comandos realmente observados; «no ejecutado» permanece como tal.

En la versión observada el envelope tiene `conversation_id`, `status`, `response`, `num_turns` y `usage`; `json_schema` y `denied_actions` aparecieron solo en algunos runs. `json_schema` es el esquema solicitado, no el reporte; la ausencia de `denied_actions` no prueba que ninguna herramienta haya sido denegada. No asumir que siempre existe `structured_output`. La extracción debe manejar el envelope real y fallar explícitamente si falta contenido. Cuando se necesite probar ejecución de herramientas, capturar `stream-json` con eventos y su resultado, como en G-003.

Sol recibe conclusión, incertidumbres y rutas de evidencia, con un reporte normalmente menor de 1.500 palabras. Depurar un error de runtime puede requerir un fragmento acotado de stderr; nunca volcar la transcripción completa por comodidad.
