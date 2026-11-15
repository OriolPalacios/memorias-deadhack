# Relevo de datos · Issue #8 → Issue #9

**Estado.** Paquete de datos procesado y verificado con un consumidor HTTP de prueba. Falta la prueba con la app de Oriol. [Issue #8](https://github.com/OriolPalacios/memorias-deadhack/issues/8) · [Issue #9](https://github.com/OriolPalacios/memorias-deadhack/issues/9)

## Integración

- Punto de entrada en la app `demo/jezero/terrain.json`. El recurso enlaza `scenario.json`, las alturas Float32 LE, la máscara Uint8, el PNG THEMIS RGBA y la foto Hazcam. La ficha histórica MEDA está incluida en el escenario. [Paquete](../../public/demo/jezero/terrain.json)
- Se conserva `jezero-geometry-proposal-20261115-1`, incluidos sus costes simulados. El consumidor confirmó el marco, las rejillas, los formatos y el corredor de 5 m. Oriol reportó coincidencia entre los nueve casos de evaluación y su dominio TypeScript. [Geometrías y autonomía](https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6901693527) · [Formato acordado](https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6902087995)

## Evidencia

- HiRISE contiene 160 388 de 160 388 celdas nativas válidas sobre la ventana de trabajo y 65 536 de 65 536 vértices válidos tras la reproyección. Los cinco movimientos, incluidos ambos regresos, mantienen el corredor dentro de una malla continua con margen mínimo de 44,22 m. El resultado acredita cobertura de elevación para el escenario simulado.
- THEMIS tiene las 16 celdas válidas en la misma extensión y un paso de 100 m. LibTIFF y el decodificador de ventana devolvieron los mismos DN. El catálogo STAC tiene fechas invertidas y se registra el período de adquisición como desconocido.
- Los seis archivos usados por la app se verifican por HTTP local junto con dimensiones y hashes. El presupuesto de 15 MB se comprobará con el build de producción completo. [Registro técnico](examples/jezero-v1-ground-validation.json) · [Procesamiento](../../scripts/data/README.md)

## Prueba pendiente con el frente de app

Oriol carga el manifiesto en la app, prueba textura y máscaras, verifica que el drapeado y las paradas usen el mismo marco, y ejecuta A/B por salida directa y extra. Registra el resultado, los assets finales y la suma de bytes del `dist`.
