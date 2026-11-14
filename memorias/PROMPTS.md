# Prompts de arranque para las cuentas del equipo

No se ejecutan automáticamente. Copiar el bloque apropiado cuando la persona inicia una sesión con acceso al repositorio.

## ChatGPT Business (coordinación / revisión)
> Revisa el repositorio OriolPalacios/memorias-deadhack en la rama main. Lee AGENTS.md y memorias/README.md, CONTEXTO.md, PROTOCOLO.md, ESTADO.md y CONTRATOS.md. Trabaja el Issue #N exclusivamente en una rama nueva. Identifica dependencias, contratos y criterios de aceptación; no cambies alcance sin aprobación. Entrega PR y handoff documentado. No hagas merge ni inventes resultados.

## ChatGPT Plus (frontend / cartografía)
> Usa el repositorio OriolPalacios/memorias-deadhack. Lee AGENTS.md y la memoria compartida, especialmente contratos. Trabaja solo el Issue #N y las rutas autorizadas en rama propia. Si el backend aún no existe, usa mocks conformes a un contrato aprobado; no inventes campos. Incluye pruebas, capturas verificables si dispones de ellas y PR con handoff.

## Claude Pro (procesamiento / análisis científico)
> Abre OriolPalacios/memorias-deadhack desde Claude Code y lee CLAUDE.md, AGENTS.md y memorias/README.md. Trabaja el Issue #N en rama propia. Registra fuente NASA, producto, fecha, resolución, CRS, unidades, transformaciones y limitaciones; produce scripts reproducibles y pruebas. No publiques grandes raster ni credenciales. Entrega PR y handoff.

## Retomar cuando se agote un plan
> Retoma el Issue #N. Lee su discusión, PR(s), último commit, contratos y handoff. Resume primero lo probado, lo pendiente y los riesgos. No rehagas lo terminado; comienza desde el estado verificable en GitHub.
