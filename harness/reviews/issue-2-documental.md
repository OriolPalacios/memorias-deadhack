# Issue #2 — segunda revisión documental independiente

**Resultado: PASS DOCUMENTAL para el alcance revisado.** Perfil indicado por el lanzamiento del padre: `gpt-6.1-terra` / `max`. No se ha revisado ni probado un producto. Se evaluó el spec **0.2**, todavía `draft`, sobre la rama `docs/issue-2-harness-spec-mvp`, base `f7cf792f7fd106ae3494f14194e0404c9bc52f99`, con archivos locales sin commit. Tras la revisión inicial, el autor precisó la recomendación, ajustó la evidencia AGY y añadió la asignación editable; se verificaron esas modificaciones de manera acotada. SHA-256 de `SPEC.md`: `426f7ed6ab4e12a4399ef5f11e73b4538b0308ef69b72ceecc2d15b2d02cb0eb`; `QA.md`: `58ca22b23c143308805cfcdf31a0821f21df6f63acd273ea04c63cebecd15e54`; `harness/team.json`: `30214aacba3c0b222a51e273174e3e26e078f7a6a41bc5d73dd2e23639dde1e6`; `harness/RUNTIME.md`: `8beabe4680ac74fc3cb76473ae489a132aca7d1f7d518b23d04d8cec5c7444ff`.

## Resultado de los tres hallazgos previos

1. **Precedencia contradictoria: corregida.** `docs/SPEC.md:88-97` define una tabla ordenada; la extra cumple en el caso 65−(5+30)=30 y gana a la directa 65−50=15. `docs/QA.md:20` incorpora el caso.
2. **Estados y déficits indeterminados: corregidos para la evaluación proyectada.** `docs/SPEC.md:78-86` delimita estados mutuamente excluyentes y dos déficits, y `docs/QA.md:13-14` comprueba valores concretos.
3. **Textura opcional/obligatoria: corregida en los documentos revisados.** Elevación real obligatoria; la ortoimagen es opcional y, sin ella, se usa color de elevación con leyenda (`docs/SPEC.md:29`, `docs/ARCHITECTURE.md:42,51-53`, `docs/DELIVERY.md:20`, `docs/RESOURCES.md:38`, `docs/QA.md:10`).

## Hallazgo de seguimiento cerrado

La primera versión de la tabla 0.2 no precisaba `recommendedOptionId` cuando ninguna opción cumplía. Tras la aclaración del autor, `docs/SPEC.md:94-95` fija `null` y la razón correspondiente tanto si faltan datos como si ambas opciones incumplen; no selecciona automáticamente el menor déficit. `docs/QA.md:14` prueba expresamente 19/18, `reserve_unmet` y `null`. **Cerrado documentalmente.**

## Evidencia AGY y asignación humana

**Atribución de G-002: corregida.** `harness/RUNTIME.md:12,52` y `docs/DECISIONS.md:49` presentan `v24.13.1` como respuesta reportada y reconocen que el envelope no prueba ejecución ni ausencia de denegaciones.

**G-003: evidencia acotada comprobada.** `evidence.json` y los eventos correspondientes de `raw.jsonl` registran `run_command` ACTIVE/DONE para `node --version`, salida `v24.13.1` y código 0. La invocación solicita `gemini-4-hydrogen-xhigh`, esfuerzo `xhigh` y permiso exacto para ese comando. La documentación limita correctamente la conclusión a esa ejecución; no acredita permisos de escritura ni una tarea de implementación.

**Asignación inicial: coherente.** `harness/team.json` y `agents.json` son JSON válidos; los tres frentes apuntan al operador `oriol` / `OriolPalacios` y los IDs de persona, perfiles de implementación/QA y rutas referenciadas existen. Distinguen el equipo declarado de tres personas del único operador actual. El README y el plan conservan al Issue como autoridad para la asignación viva; editar el JSON no ejecuta agentes ni autoriza publicación.

**Mejora no bloqueante incorporada:** `harness/README.md:32` indica también actualizar `current_operator_ids` cuando se active un operador, además de `operators`, los dueños de frente y los Issues afectados.

## Comprobaciones y límites

- Matriz lógica independiente de los cuatro estados de cada opción: 16 combinaciones, una prioridad aplicable en cada una. Esto revisa la tabla documental; no prueba código.
- Aritmética: A disponible 65, directa 35, extra 15; B disponible 55, directa 25, extra 5. Con reserva 20: previsto −5 → `exhausted`, déficits presupuesto 5 y reserva 25; previsto 0 → `exhausted`, déficits 0 y 20; 19 → `below_reserve`; 20 y 21 → `meets_reserve`.
- `harness/agents.json` mantiene revisión 0.2, `draft`, `implementation_enabled: false` y modo `planning`. Georreferenciación, datos de terreno, permisos de escritura y aceptación humana siguen abiertos; las propuestas no se presentan como implementación aprobada.
- Se cotejaron la respuesta local de G-002 y la traza de G-003, sin relanzar AGY durante esta revisión. No se ejecutaron aplicación, build, render 3D, procesado geoespacial, QA de navegador ni ensayo de demo. Ningún resultado de esta revisión constituye PASS de producto.

**Siguiente paso:** continuar la revisión y entrega del Issue #2. La aceptación humana y los contratos por Issue siguen siendo condiciones previas para implementar.
