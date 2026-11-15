# Relevo de datos · Issue #8 → Issue #9

**Estado:** propuesta de contratos para revisión.  
**Responsables:** Lucian (datos) y Oriol (app y dominio).  
**Base:** `main` posterior al [merge del spec 0.3](https://github.com/OriolPalacios/memorias-deadhack/pull/3).  
**Rama de datos:** `feat/issue-8-datos-jezero`.  
**Hilos:** [Issue #8](https://github.com/OriolPalacios/memorias-deadhack/issues/8) · [Issue #9](https://github.com/OriolPalacios/memorias-deadhack/issues/9).

## Disponible para el agente de la app

- [Nueve casos de `evaluation/v1`](examples/evaluation-v1-casos.json). En A, quedan 65 min y se proyectan 15 con parada extra y 35 con regreso directo. En B, quedan 55 y se proyectan 5 y 25. Con reserva de 20, ambas recomiendan `direct`. Los campos y razones conjuntos siguen las convenciones acordadas. Los códigos por opción y el envoltorio completo siguen propuestos.
- [Propuesta de terreno y escenario](jezero-v1.md). Incluye JSON, cuatro binarios sintéticos en Base64, resultados esperados y pasos de verificación. Usar solo para probar el punto de conexión del cargador. En el flujo de la Issue #9, la selección A/B y el dominio pueden avanzar con tiempos simulados. Mostrar disponibilidad de terreno, térmica y foto según el estado real de cada recurso servido.

## Verificación y límites de la entrega

Se cotejaron tres JSON, cuatro binarios con sus longitudes y SHA-256, los identificadores comunes, las orientaciones y máscaras del ejemplo sintético y los nueve resultados de autonomía. La revisión documental deja pendiente la prueba en la app.

El DTM HiRISE tiene dos controles válidos y una ventana preliminar de 233 × 274 con 63 842 celdas válidas. Se recuperó el JPEG de Perseverance con crédito de JPL. Para THEMIS `mc13_syrtis_major_nir` se confirmó la cabecera TIFF por lectura en rango. Siguen pendientes el recorte y la máscara térmicos, la cobertura de los corredores A/B y la carga de assets reales desde el servidor local. La ventana preliminar no representa los corredores completos.

## Respuesta requerida para el siguiente paso

1. Oriol y el consumidor confirman o proponen cambios al binario de elevación, la máscara, el PNG térmico, el marco marciano, el origen y las rejillas.
2. Oriol comparte base, paradas y geometrías A/B por fase, con los retornos, el marco y su commit o versión. Ambos frentes acuerdan ancho de corredor y tolerancia de alineación.
3. Lucian produce el paquete final sobre ese acuerdo. El agente de la app lo prueba con el mismo manifiesto y comunica el resultado en la Issue #9.
