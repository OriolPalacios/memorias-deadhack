# Contratos de datos de Jezero

**Estado.** Oriol confirmó los formatos de carga, el marco y la geometría de la demo. El paquete procesado de la Issue #8 se entrega para que el frente de la Issue #9 lo pruebe con su app. Los códigos de evaluación por opción y su envoltorio externo continúan propuestos. [Formato confirmado](https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6902087995) · [Relevo de integración](issue-8-handoff.md)

## Intercambio local

Lucian prepara los datos y el manifiesto `terrain.json`. Oriol aporta la geometría. El dominio produce la salida de evaluación que presenta la UI. La ubicación propuesta en el repositorio es `public/demo/jezero/terrain.json`, servido por Vite desde `demo/jezero/terrain.json` bajo la URL base de la app. Resolver `scenarioAsset` y cada `path` relativo al JSON que lo declara, dentro del paquete. Los JSON son UTF-8 y usan rutas con `/`. Cada binario declara `format`, `byteLength` y `sha256` de los bytes servidos. Una versión incompatible, un archivo faltante y una zona sin datos tienen mensajes distintos.

## Integración con el Issue #9

| Punto de conexión de la app | Insumo disponible para avanzar |
|---|---|
| Duraciones y evaluación de autonomía | `route-a` y `route-b` se pueden ejecutar en el dominio puro con los tiempos simulados de spec 0.3. La selección A/B por tiempos puede probarse durante la planificación mientras la geometría figure como pendiente. [Nueve casos de evaluación](examples/evaluation-v1-casos.json) |
| Carga de terreno, rutas y capas | Los ejemplos sintéticos prueban las interfaces. El paquete con datos procesados comienza en `demo/jezero/terrain.json`. El visor presenta la disponibilidad de terreno, térmica y foto por separado. |

El frente de la app implementa sus puntos de conexión en `src/**` y los verifica en `tests/**`. `docs/contracts/**`, `scripts/data/**` y `public/demo/jezero/**` corresponden al frente de datos. [Issue #9](https://github.com/OriolPalacios/memorias-deadhack/issues/9)

## terrain/v1

| Campo | Formato propuesto |
|---|---|
| `contract`, `id` | `terrain/v1` e identificador de esta versión de terreno. |
| `frame` | ID del marco, CRS de destino, convención geográfica, origen de escena `[E0,N0]` en metros, datum vertical, altura de origen `h0` en metros del datum y exageración vertical positiva. |
| `grid` | `width` columnas y `height` filas, enteros ≥2. `extentM` es `[oeste,sur,este,norte]` en metros proyectados y representa los bordes exteriores. Rejilla rectangular, norte arriba, sin rotación. |
| `heightAsset` | IEEE 754 Float32 little-endian sin cabecera, `4 × width × height` bytes. Alturas físicas en metros. Lectura con `DataView.getFloat32(4*i, true)`. |
| `heightMaskAsset` | Uint8 sin cabecera, `width × height` bytes. `1` indica altura válida finita y `0` indica NoData. Escribir +0 canónico en muestras inválidas. Una altura de 0 m con máscara 1 sigue siendo válida. |
| `heightSourceId`, `sources` | Las referencias resuelven a IDs de fuente únicos. En productos reales registrar ID/revisión, URL, misión/instrumento, crédito/condiciones, fecha de consulta, resolución nativa, cobertura, CRS, datum, escala, offset y NoData originales. Incluir SHA-256 cuando el original completo esté disponible o registrar el intervalo comprobado. |
| `elevationLegend`, `coverage` | Extremos de altura en metros sobre valores válidos y conteos `validSamples` y `totalSamples`. Reportar la cobertura de rutas por separado. |
| `thermal`, `textureAsset` | La capa THEMIS es obligatoria para la demo. La ortoimagen es opcional y se indica con `null` si falta. Si se incluye, declarar fuente, rejilla en el CRS y extensión del terreno, y máscara propia. |

El índice es `i = row*width + col`, desde 0, con fila 0 al norte y columna 0 al oeste. Para `[W,S,Emax,Nmax]`, calcular `dx = (Emax-W)/width` y `dy = (Nmax-S)/height`. El centro de la celda está en `E = W + (col+0.5)*dx` y `N = Nmax - (row+0.5)*dy`. El desplazamiento de medio píxel se aplica una vez al interpretar el afín de bordes. [Geotransformación GDAL](https://gdal.org/en/stable/tutorials/geotransforms_tut.html)

El CRS de destino propuesto es equirectangular local de Marte, radio esférico `3396190 m`, origen geográfico 77,4° E y 18,45° N y paralelo de escala 18,45° N. La entrada geográfica es `[longitud,latitud]` positiva al este en `[0,360)` y planetocéntrica. Leer el CRS original de cada fuente antes de transformar. Las alturas preservan el datum vertical del DTM seleccionado. La escena usa `x = E-E0` hacia el este, `y = (h-h0)*verticalExaggeration` hacia arriba y `z = N0-N` hacia el sur. El offset vertical y la exageración son de render. [Proyección equirectangular PROJ](https://proj.org/en/stable/operations/projections/eqc.html)

Emitir los triángulos `(NW,SW,NE)` y `(NE,SW,SE)` de cada cuadrilátero solo si sus tres vértices son válidos. La malla termina en los centros extremos. Drapear rutas y POIs sobre los mismos triángulos por interpolación baricéntrica, con su altura renderizada. Marcar como hueco cualquier posición sin triángulo válido.

### Registro térmico

`thermal.asset` es PNG RGBA, 8 bits por canal. `R=G=B` conserva el nivel IR de la celda preparada. `A=255` identifica una muestra válida y `A=0` identifica NoData, con RGB 0 en celdas inválidas. La máscara térmica es independiente. Usar el mismo CRS y extensión del terreno, con `thermal.grid` de dimensiones propias y cobertura por alfa. Calcular el espaciado derivado de esas dimensiones y guardar `nativeResolutionMpp` por separado. `legend` rotula intensidad IR relativa y `acquisition` identifica noche o día, tipo de producto y fechas verificadas o `null` con motivo.

Para textura, `u=(E-W)/(Emax-W)` y `vNorth=(Nmax-N)/(Nmax-S)`. Fuera de `[0,1)` en cualquiera de las dos coordenadas se ve solo el terreno. Para `TextureLoader` con `flipY=true`, usar UV `[u,1-vNorth]`. Confirmar la orientación con el PNG asimétrico del ejemplo. Usar vecino más próximo, sin mipmaps para esta máscara, y multiplicar opacidad de usuario por `A/255`. La capa expresa contraste cualitativo y queda fuera del cálculo de autonomía. [Mosaicos USGS](https://stac.astrogeology.usgs.gov/docs/data/mars/themis_controlled_mosaics/)

## scenario/v1

`terrainId` y `frameId` deben coincidir con `terrain.id` y `frame.id`. `geometryVersion` identifica las posiciones y trazas que se comprobarán y cambia si cambian sus coordenadas. `base` y `stops` declaran posición `[x,z]` en metros de la misma escena, ID y condición simulada. Cada movimiento declara `fromId`, `toId` y `pathXzM` con dos o más vértices y extremos coincidentes con los POI. `routes` contiene las idas A y B. `shared` contiene observación principal, acceso y observación de parada extra, regreso desde ella y regreso directo. `evidence` referencia la foto local, producto, fecha/sol, crédito y geolocalización comprobada o motivo de ausencia. `contextCards` conserva lugar, fecha o sol, variables, unidades y fuente de la ficha histórica MEDA.

`budgetMin` y `minutes` son números finitos no negativos y simulados. `reserveMin` es finito y estrictamente positivo. Los tiempos A/B vienen del spec. [Spec 0.3](https://github.com/OriolPalacios/memorias-deadhack/blob/895e5e5067332ad802a809360c1d4dd883f583aa/docs/SPEC.md)

| Evento de coste | Transición al completarlo |
|---|---|
| `outbound` de la ruta elegida | `outbound → observing` al llegar a la parada principal. |
| `shared.observe` | `observing → deciding` al completar la observación. |
| `shared.extra` | `extra_stop → returning` al completar acceso y observación extra. Su coste de 15 min cubre ambos. |
| `shared.direct` o `shared.returnAfterExtra` | `returning → completed` al llegar a base por la rama elegida. Costes respectivos 30 y 35 min. |

Iniciar mueve `planning → outbound` y elegir en `deciding` mueve a `returning` o `extra_stop` sin débito adicional. El dominio consume el `eventId` único una vez por ejecución al completar la transición válida. Un evento repetido o una transición inválida conserva el estado. Reiniciar limpia los IDs aplicados.

## Ejemplo sintético

Los dos JSON y cuatro binarios de abajo forman el ejemplo. Las ubicaciones, alturas, señal IR y datos de contexto son sintéticos.

### terrain.json

~~~json
{
  "contract": "terrain/v1",
  "id": "jezero-fixture",
  "scenarioAsset": "scenario.json",
  "frame": {
    "id": "mars-eqc-jezero-fixture",
    "projection": "+proj=eqc +lat_ts=18.45 +lat_0=18.45 +lon_0=77.4 +R=3396190 +x_0=0 +y_0=0 +units=m +type=crs",
    "latitudeType": "planetocentric",
    "longitudeDomain": "0_to_360_east",
    "sceneOriginProjectedM": [100, 230],
    "verticalDatum": "areoide sintético de prueba",
    "heightOriginM": 1.25,
    "verticalExaggeration": 1
  },
  "grid": {"width": 3, "height": 2, "extentM": [100, 30, 400, 230]},
  "heightAsset": {"path": "height.f32", "format": "float32-le", "byteLength": 24, "sha256": "b993a9be8021489b36cdfa7bebac0424443f12f5bbc21754119bb3fc6d7c525a"},
  "heightMaskAsset": {"path": "height-mask.u8", "format": "uint8", "byteLength": 6, "sha256": "d029ad93978df7e6ee64f4f3b5e5be70df48ce3cbee6d56fd5651ff4bcfa7323"},
  "heightSourceId": "fixture-dtm",
  "elevationLegend": {"unit": "m", "minM": -3.5, "maxM": 4.5},
  "coverage": {"validSamples": 5, "totalSamples": 6},
  "textureAsset": null,
  "thermal": {
    "sourceId": "fixture-ir",
    "asset": {"path": "thermal.png", "format": "png-rgba8", "byteLength": 82, "sha256": "4201ed7993b04da57786e3452dc82688043362b250a90bf490e2bf294f4c315c"},
    "grid": {"width": 2, "height": 2, "extentM": [100, 30, 400, 230]},
    "nativeResolutionMpp": 100,
    "legend": {"label": "IR nocturno · intensidad relativa", "scale": "relative_ir_dn", "lowDN": 0, "highDN": 255},
    "acquisition": {"kind": "mosaic", "illumination": "night", "startUtc": null, "endUtc": null, "missingReason": "synthetic_fixture"},
    "coverage": {"validSamples": 3, "totalSamples": 4}
  },
  "sources": [
    {"id": "fixture-dtm", "kind": "synthetic", "productId": "fixture-relief", "nativeResolutionMpp": 1, "credit": "DeadHack"},
    {"id": "fixture-ir", "kind": "synthetic", "productId": "fixture-ir-night", "nativeResolutionMpp": 100, "credit": "DeadHack"}
  ]
}
~~~

### scenario.json

~~~json
{
  "contract": "scenario/v1",
  "id": "una-parada-mas-fixture",
  "terrainId": "jezero-fixture",
  "frameId": "mars-eqc-jezero-fixture",
  "geometryVersion": "synthetic-1",
  "budgetMin": 120,
  "reserveMin": 20,
  "base": {"id": "base", "xzM": [70, 70], "simulated": true},
  "stops": [
    {"id": "science", "xzM": [170, 70], "simulated": true, "evidenceId": "science-photo", "contextIds": ["weather"]},
    {"id": "extra-stop", "xzM": [130, 130], "simulated": true, "evidenceId": null, "contextIds": []}
  ],
  "routes": [
    {"id": "A", "simulated": true, "outbound": {"eventId": "a_outbound", "minutes": 35, "fromId": "base", "toId": "science", "pathXzM": [[70, 70], [170, 70]]}},
    {"id": "B", "simulated": true, "outbound": {"eventId": "b_outbound", "minutes": 45, "fromId": "base", "toId": "science", "pathXzM": [[70, 70], [70, 130], [130, 130], [170, 70]]}}
  ],
  "shared": {
    "observe": {"eventId": "observe_science", "minutes": 20, "stopId": "science"},
    "extra": {"eventId": "reach_and_observe_extra", "minutes": 15, "fromId": "science", "toId": "extra-stop", "pathXzM": [[170, 70], [130, 130]]},
    "returnAfterExtra": {"eventId": "return_after_extra", "minutes": 35, "fromId": "extra-stop", "toId": "base", "pathXzM": [[130, 130], [70, 70]]},
    "direct": {"eventId": "return_direct", "minutes": 30, "fromId": "science", "toId": "base", "pathXzM": [[170, 70], [70, 70]]}
  },
  "evidence": [
    {"id": "science-photo", "kind": "synthetic", "productId": "fixture-photo", "asset": {"path": "fixture-photo.png", "format": "png-rgba8", "byteLength": 70, "sha256": "7e03c9ca2745c5ab6b91b80823e96ea8baf8868670227a5697852437c88cd351"}, "credit": "DeadHack", "captureDate": null, "captureSol": null, "captureLocation": null, "sourceUrl": null, "missingReason": "synthetic_fixture"}
  ],
  "contextCards": [
    {"id": "weather", "kind": "synthetic", "site": "Jezero de prueba", "sol": 42, "dateUtc": null, "credit": "DeadHack", "sourceUrl": null, "variables": [{"name": "presión", "value": 700, "unit": "Pa"}]}
  ]
}
~~~

### Binarios de prueba

| Archivo | Base64 |
|---|---|
| `height.f32` | `AABgwAAAoD8AAAAAAADAvwAAkEAAAAAA` |
| `height-mask.u8` | `AQEBAQEA` |
| `thermal.png` | `iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGUlEQVR4nGNgYGD439TU9J/h0qVL/4EcBgBAdwb6C3w4nAAAAABJRU5ErkJggg==` |
| `fixture-photo.png` | `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPYmu32HwAFpQJmgu+f4QAAAABJRU5ErkJggg==` |

DTM de 100 × 100 m de paso, con centros extremos proyectados `(150,180)` y `(350,80)`. El vértice NW queda en `[50,-4.75,50]`. El NE conserva el 0 m válido. Triángulos esperados `[0,3,1]`, `[1,3,4]` y `[1,4,2]`. La térmica tiene paso 150 × 100 m. Los vértices NW/NE/SW del terreno leen DN `0/130/210` con alfa 255. En `[x,z]=[180,115]` hay terreno y alfa térmico 0.

### evaluation/v1

Se incluye `route-a` completo. Derivar `availableMin=120−35−20=65`, reserva 20 y costes pendientes extra 50 y directo 30. Comparar la salida del dominio con `expected`. B deja 55 disponibles y proyecta 5 y 25 min. A y B recomiendan `direct` con `direct_meets_reserve`. Los fixtures corresponden al punto de decisión después de observar. [Nueve casos de evaluación](examples/evaluation-v1-casos.json)

~~~json
{
  "id": "route-a",
  "qa": "QA-04",
  "given": {
    "availableMin": 65,
    "reserveMin": 20,
    "pendingCostMinByOptionId": {"extra": 50, "direct": 30}
  },
  "expected": {
    "options": [
      {
        "optionId": "extra", "pendingCostMin": 50, "projectedAtBaseMin": 15, "reserveMin": 20,
        "reserveDeltaMin": -5, "reserveDeficitMin": 5, "budgetDeficitMin": 0,
        "status": "below_reserve", "reasonCode": "reserve_shortfall"
      },
      {
        "optionId": "direct", "pendingCostMin": 30, "projectedAtBaseMin": 35, "reserveMin": 20,
        "reserveDeltaMin": 15, "reserveDeficitMin": 0, "budgetDeficitMin": 0,
        "status": "meets_reserve", "reasonCode": "reserve_met"
      }
    ],
    "recommendedOptionId": "direct",
    "reasonCode": "direct_meets_reserve"
  }
}
~~~

Están acordados `extra`, `direct`, `projectedAtBaseMin` y `reasonCode` conjunto, con razones `extra_meets_reserve`, `direct_meets_reserve`, `insufficient_data` y `reserve_unmet`. Los últimos dos llevan `recommendedOptionId: null`. En `unknown` los valores derivados se expresan como `null` y se muestra la razón. La nota histórica del fixture es anterior a ese acuerdo. Los códigos por opción y el envoltorio de salida siguen propuestos. La UI presenta el resultado de dominio. [Arquitectura aprobada](https://github.com/OriolPalacios/memorias-deadhack/blob/895e5e5067332ad802a809360c1d4dd883f583aa/docs/ARCHITECTURE.md#convenciones-de-evaluationv1-confirmadas-por-sol)

## Fuentes y procesamiento

| Fuente | Evidencia y verificación pendiente |
|---|---|
| HiRISE `DTEEC_002387_1985_003798_1985_A01.IMG` | La etiqueta PDS3 recuperada por rango indica 6934 × 11538, PC_REAL de 32 bits little-endian, 1,0096476466229 m/píxel y NoData `0xFF7FFFFB`. Equirectangular planetocéntrico E+, esfera local 3394839,8133163 m, paralelo de escala 15° y meridiano 77,41°. Alturas del areoide ajustado a MOLA. Las lecturas por rango fueron −2520,6824 m en Mageik `[77.40143554,18.45068664]` (col 3260, fila 8102) y −2508,4331 m en Kukaklek `[77.39911421,18.45363597]` (3128,7929), índices base 0. Un recorte preliminar en el CRS original de 233 × 274 celdas dio 63 842 válidas y 319 210 B de alturas y máscara. Quedan pendientes el marco acordado y A/B. [Catálogo](https://hirise.lpl.arizona.edu/dtm/PSP_002387_1985) · [PDS](https://www.uahirise.org/PDS/DTM/PSP/ORB_002300_002399/PSP_002387_1985_PSP_003798_1985/) · [Alternativa USGS TRN](https://doi.org/10.5066/P9REJ9JN) |
| THEMIS nocturno `mc13_syrtis_major_nir` | COG de 26674 × 17783, 100 m/píxel, Mars 2015 esférico planetocéntrico E+, cilindro simple con meridiano 0, radio 3396190 m. La geometría geográfica contiene 77,4° E y 18,45° N. Los primeros 2048 bytes se leyeron con HTTP 206 y firma TIFF `49492a00`. Quedan pendientes recorte y máscara. En el Item, el `bbox` llega en metros con extremos verticales invertidos. Contrastar la geometría geográfica con el afín del binario. Las fechas del intervalo STAC están invertidas, usar contexto nocturno y fechas de adquisición `null` con motivo hasta cotejar procedencia. [STAC](https://stac.astrogeology.usgs.gov/api/collections/mo_themis_controlled_mosaics/items/mc13_syrtis_major_nir) · [COG](https://astrogeo-ard.s3.us-west-2.amazonaws.com/mars/mo/themis/controlled_mosaics/mc13_syrtis_major_nir/mc13_syrtis_major_nir.tif) |
| Hazcam `PIA25325` | JPEG original recuperado. Perseverance, sol 424, 30 de abril de 2022, NASA/JPL-Caltech. Sigue pendiente determinar la ubicación exacta con el producto y RMC de la toma y las localizaciones PDS, y servir la imagen en el paquete de la app. [JPL](https://www.jpl.nasa.gov/images/pia25325-enchanted-view-of-jezero-rocks/) |
| MEDA | Seleccionar una observación histórica de Jezero con lugar, fecha o sol, variable, unidad y producto PDS. [Archivo PDS](https://pdsatmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html) |

1. Reutilizar originales existentes tras cotejar ID, etiqueta y tamaño. Registrar URL, alcance de las lecturas por rango y SHA-256 cuando se disponga del original completo. Mantener originales pesados en el área local de datos.
2. Obtener `gdalinfo -json` de cada fuente. Identificar CRS y afín originales, banda, escala, offset, unidad y NoData. Transformar los dos controles a E,N del DTM original y verificar `gdallocationinfo -xml -geoloc` y la máscara de esas celdas. [Muestreo GDAL](https://gdal.org/en/stable/programs/gdallocationinfo.html)
3. Elegir el rectángulo de bordes y dos dimensiones de rejilla en el CRS de destino. Mantener versiones y parámetros de GDAL/PROJ. Patrón propuesto `gdalwarp -s_srs <CRS-origen-verificado> -t_srs <CRS-marco> -te W S Emax Nmax -ts ANCHO ALTO -r near -ovr NONE -et 0 -novshift -dstalpha <origen> <recorte.tif>`. Si el driver oculta NoData, convertirlo a máscara antes de reproyectar. Aplicar escala y offset originales una sola vez a las alturas válidas al exportarlas a Float32. Empaquetar alturas/máscara en el orden definido. Para el PNG térmico replicar el DN válido en RGB y trasladar cobertura al alfa. [Reproyección GDAL](https://gdal.org/en/stable/programs/gdalwarp.html)
4. Con las trazas versionadas, rasterizar el buffer acordado en el CRS del DTM. Contar celdas interceptadas válidas y totales, incluidas las celdas fuera del footprint como faltantes. Verificar continuidad sobre la malla exportada y registrar los tramos con huecos. La cobertura de un recorte preliminar de los controles solo corresponde a su propia extensión.

La entrega aplica las ecuaciones EQC esféricas y reproyección por centros con vecino más próximo. Los scripts reproducibles y la evidencia documentan el método usado en esta versión. [Reproducción](../../scripts/data/README.md) · [Validación de Jezero](examples/jezero-v1-ground-validation.json)

## Verificación reproducible

1. Guardar los bloques `terrain.json` y `scenario.json` en un directorio de pruebas. Decodificar los cuatro valores Base64 en ese directorio con los nombres indicados en la tabla.
2. Comparar longitud y SHA-256 de cada binario con su JSON. Leer seis alturas Float32 little-endian y verificar `[-3.5,1.25,0,-1.5,4.5,0]`. La máscara `[1,1,1,1,1,0]` conserva válido el primer cero. Comprobar los centros, triángulos y DN/alfa esperados del ejemplo.
3. Pasar `given` de cada caso al evaluador de dominio y contrastar con `expected`. La ejecución de los códigos por opción y del envoltorio completo presupone el acuerdo de esos campos. [Fixture de evaluación](examples/evaluation-v1-casos.json)

La comprobación documental verificó tres JSON, cuatro binarios, tamaños y hashes, geometría y registro sintéticos, y el recálculo de los nueve casos. La verificación del paquete servido y la cobertura completa quedan pendientes.

| Prueba | Criterio |
|---|---|
| Registro y huecos | Reproducir centros, DN/alfa y triángulos esperados. La traza de prueba `[70,70] → [230,120] → [170,70]` tiene extremos válidos y atraviesa una zona sin triángulo. Verificar esquinas y controles en fuentes y derivados con tolerancia ligada a cada resolución. |
| Dominio | Ejecutar los nueve casos del fixture de evaluación. Repetir un evento no vuelve a consumir, el reinicio restablece el estado y cambiar opacidad o capa conserva el resultado. |
| Paquete servido | Cargar desde la app con solicitudes de datos externas bloqueadas, verificar cámara, leyenda, fuente, capa térmica y diferencia entre asset faltante y píxel transparente. Medir tamaño con objetivo aproximado ≤15 MB. |
| Corredores | Validar base, paradas, trazas A/B y ambos regresos sobre máscara y malla, registrando revisión, proporción válida y huecos. |

## Prueba de integración

Cargar el manifiesto con el candidato de la Issue #9 y verificar los cinco recorridos simulados sobre la malla y el registro de la capa THEMIS. Registrar la prueba de la app y el tamaño de todo el `dist` en la misma revisión. [Relevo de integración](issue-8-handoff.md) · [Plan QA](../QA.md)
