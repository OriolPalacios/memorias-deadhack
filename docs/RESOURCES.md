# Recursos del reto y datos de la demo

**Actualizado:** 2026-11-14. Los cinco enlaces del primer bloque fueron facilitados directamente por el usuario. Abrir una página confirma la referencia, no que los datasets se hayan descargado, alineado o integrado.

## Catálogo entregado por el reto

| ID | Recurso | Uso previsto en el MVP |
|---|---|---|
| R-01 | [Mars Perseverance Raw Images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Buscar vistas reales de superficie y sus fechas/instrumentos. Seleccionar pocas imágenes, descargarlas y acreditarlas para la demo. |
| R-02 | [NASA Worldview](https://worldview.earthdata.nasa.gov/) | Referencia de interacción de capas, leyendas y tiempo. Es un visor terrestre, no una fuente de terreno o clima de Marte. |
| R-03 | [Curiosity’s Proposed Path up Mount Sharp](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | Referencia visual de ruta científica y relieve. Corresponde a Gale/Mount Sharp; no es geometría ni terreno de Jezero. |
| R-04 | [USGS — Interactive Maps: Mars](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | Entrada a productos cartográficos/geológicos y metadatos. Seleccionar productos con cobertura y escala adecuadas. |
| R-05 | [NASA/JPL Mars Trek](https://trek.nasa.gov/mars/) | Descubrir capas ópticas/topográficas y los identificadores de productos. El enlace del usuario usa una vista global; todavía no define el recorte de demo. |

Los recursos de referencia visual no se presentan como datasets consumidos. En la entrega se documenta exactamente qué producto de R-04/R-05 y qué imagen de R-01 se utilizaron. No es necesario conectar cinco servicios durante la demo para aprovechar estos recursos.

## Productos y referencias complementarias verificadas

| ID | Referencia primaria | Hecho observado y estado |
|---|---|---|
| D-01 | [HiRISE DTM — Depositional Fan](https://hirise.lpl.arizona.edu/dtm/PSP_002387_1985) | Candidato: `DTEEC_002387_1985_003798_1985_A01`; el catálogo indica escala de 1 m/píxel y ofrece DTM de unos 320 MB y ortoimágenes. **No descargado; footprint en Enchanted Lake y CRS pendientes.** No tratar el centro del producto como posición del afloramiento. |
| D-02 | [USGS SIM 3464 — Jezero y Nili Planum](https://www.usgs.gov/maps/geologic-map-jezero-crater-and-nili-planum-region-mars) | Mapa geológico regional a 1:75.000, publicado en 2020. Útil para contexto científico; no resuelve obstáculos peatonales. No se ha extraído una capa para la app. |
| D-03 | [Enchanted View of Jezero Rocks](https://science.nasa.gov/resource/enchanted-view-of-jezero-rocks/) | Imagen Hazcam de Perseverance capturada el 30-04-2022, sol 424; publicación del 29-06-2022; crédito NASA/JPL-Caltech. Documenta rocas sedimentarias cerca de la base del delta. Foto todavía no descargada ni ubicada en la escena. |
| D-04 | [Primer informe MEDA de Jezero](https://www.jpl.nasa.gov/news/nasas-first-weather-report-from-jezero-crater-on-mars/) | Referencia histórica: 718 Pa en febrero de 2021; el 3–4 de abril de 2021 se informaron temperaturas entre −83 y −22 °C y ráfagas de alrededor de 10 m/s. Fechas distintas; contexto informativo, sin efecto automático sobre la ruta. |
| D-05 | [Curiosity RAD — Radiation Measurements on Mars](https://science.nasa.gov/resource/radiation-measurements-on-mars/) | Observaciones de agosto de 2012 a junio de 2013 en Gale; unos 210 µGy/día de dosis absorbida medida por el instrumento. No es dosis personal de una astronauta ni previsión en Jezero. Referencia opcional, fuera del cálculo de autonomía. |
| D-06 | [Mars Trek WMTS API](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) | Documenta consulta de `GetCapabilities`, matrices y cobertura de tiles. Las teselas de imagen no proporcionan alturas numéricas por sí solas; revisar producto y proyección. |

HiRISE es una vía complementaria de producto de misión NASA para obtener elevación numérica, no un sexto recurso atribuido al listado del usuario. Si el producto elegido se encuentra a través de Trek/USGS, guardar también esa relación de descubrimiento.

## Ficha exigida para cada asset incorporado

Registrar junto al manifiesto: ID interno; recurso de entrada y URL de origen; misión/instrumento; ID de producto; fecha/sol de captura y fecha de consulta; crédito/condiciones de uso; archivo fuente y checksum; extensión y resolución nativa; CRS, datum, latitud planetocéntrica/planetográfica y longitud este/oeste; unidades y NoData; script/comando de recorte/reproyección/muestreo; resolución y checksum del derivado; referencias que lo consumen.

Para una imagen de superficie sin georreferenciación disponible, marcar la posición como desconocida o aproximada con fundamento. No inventar coordenadas a partir del título. Para un terreno sin cobertura en el punto principal, cambiar de producto o llevar la decisión de ubicación a Sol y al operador antes de colocar allí la foto.

## Prueba temprana de datos

En los primeros 90 minutos de la futura ejecución, demostrar: descarga accesible de elevación numérica, área de interés dentro de cobertura válida y una malla 3D pequeña con metadatos y controles de registro espacial. La textura orbital es opcional: si se incorpora, debe estar alineada; si no, usar color de elevación con leyenda. Si HiRISE no sirve, evaluar un DTM/DEM accesible desde Trek/USGS y declarar su menor resolución. Reducir recorte/densidad conserva el requisito 3D; generar relieve de ruido o extruir una imagen sombreada no lo satisface.

El paquete final debe separar en la interfaz y en los manifiestos los hechos observados, las transformaciones y los supuestos de misión. [Skill de procedencia](../harness/skills/mars-data-provenance/SKILL.md).
