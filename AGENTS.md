# Instrucciones para agentes que trabajan con este repositorio

Lee primero `memorias/README.md`, `memorias/CONTEXTO.md`, `memorias/PROTOCOLO.md`, `memorias/ESTADO.md` y el Issue asignado. Prioriza la versión más reciente de `main`.

1. No asumas que la conversación de otro agente es visible. El contexto compartido es GitHub.
2. Una tarea = un Issue = una rama = un PR. No edites `main` directamente ni fusiones PR sin aprobación humana.
3. Antes de modificar archivos, registra en el Issue la tarea que asumes, tu alcance y los archivos previstos. Comprueba si otro colaborador ya trabaja en ese ámbito.
4. Usa nombres de rama `feat/issue-N-resumen`, `docs/issue-N-resumen` o `fix/issue-N-resumen`.
5. Mantén el código del producto fuera de `memorias/`. Los archivos de memoria son documentación/protocolos, no procesos residentes ni almacenamiento de credenciales.
6. No inventes datos científicos, validaciones, ejecuciones o requisitos aprobados. Distingue hechos, hipótesis y supuestos; enlaza fuentes NASA/PDS/USGS.
7. No confundas capas visuales de Marte con modelos numéricos de elevación; no uses WGS84 terrestre como referencia planetaria sin transformación fundamentada.
8. No afirmes que un prototipo certifica la seguridad de una EVA. Radiación, oxígeno y tiempos de caminata requieren modelos específicos y supuestos explícitos.
9. Ejecuta las pruebas disponibles; si no puedes hacerlo, indícalo. Proporciona evidencia en el PR.
10. Al terminar deja un handoff claro según `memorias/HANDOFFS/PLANTILLA.md`. Un humano revisa antes de merge.

Si faltan Issue, contrato, fuente o requisitos, identifica el bloqueo y solicita una decisión en lugar de establecerla silenciosamente.
