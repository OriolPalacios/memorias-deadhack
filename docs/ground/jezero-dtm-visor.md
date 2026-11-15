# Jezero: verificación preliminar del terreno y revisión del visor

[Issue #6](https://github.com/OriolPalacios/memorias-deadhack/issues/6) · Lucian · 15 de noviembre de 2026, hora de Lima.
Referencia de revisión: [spec 0.2](https://github.com/OriolPalacios/memorias-deadhack/blob/a0d294320b9cdb3c62656fda1d85843a6aadd233/docs/SPEC.md) del PR #3. Los contratos de producto siguen en revisión.

## Terreno y puntos de control

| Evidencia | Resultado | Límite |
| --- | --- | --- |
| DTM HiRISE `DTEEC_002387_1985_003798_1985_A01`, rev. 01 | Raster de 320 MB, espaciado nominal de 1 m, proyección equirectangular y alturas referidas al areoide ajustado a MOLA. | Falta verificar la etiqueta del propio DTM y muestrear sus celdas. [Catálogo HiRISE](https://hirise.lpl.arizona.edu/dtm/PSP_002387_1985) · [Documentación del producto](https://www.uahirise.org/PDS/EXTRAS/DTM/PSP/ORB_002300_002399/PSP_002387_1985_PSP_003798_1985/README.TXT) |
| Ortoimagen compañera `PSP_002387_1985_RED_C_01_ORTHO` | Coordenadas planetocéntricas y longitud positiva al este. Rectángulo delimitador: 18.39214343°–18.58873500° N y 77.34394372°–77.46625400° E. | La máscara de elevación válida se comprueba directamente en el DTM. [Etiqueta PDS de la ortoimagen](https://www.uahirise.org/PDS/DTM/PSP/ORB_002300_002399/PSP_002387_1985_PSP_003798_1985/PSP_002387_1985_RED_C_01_ORTHO.LBL) |
| Mageik, Amalik / Enchanted Lake, sol 579 | Punto de muestreo `M2020-579-17` en 18.45068664° N, 77.40143554° E. | La Hazcam PIA25325 es del sol 424. Su posición exacta sigue sin comprobarse. [Informe PDS](https://pds-geosciences.wustl.edu/missions/mars2020/Mars%202020%20Initial%20Reports%20Volume%202%20Release%202.pdf) · [NASA Amalik](https://science.nasa.gov/blog/perseverance-activities-at-amalik-outcrop/) · [Hazcam](https://science.nasa.gov/resource/enchanted-view-of-jezero-rocks/) |
| Hidden Harbor / Kukaklek | Punto de muestreo `M2020-623-19` en 18.45363597° N, 77.39911421° E, en un afloramiento distinto. Está a unos 218 m de Mageik en línea recta, usando el radio local de la ortoimagen. | Candidato para el segundo punto de control. La distancia no valida el recorrido, su tiempo ni su transitabilidad. [Informe PDS, sección 19](https://pds-geosciences.wustl.edu/missions/mars2020/Mars%202020%20Initial%20Reports%20Volume%202%20Release%202.pdf) |
| Alternativa | Mosaico HiRISE TRN de Jezero, USGS, DOI `10.5066/P9REJ9JN`. | También requiere comprobar máscara y alineación. [USGS](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic) |

Ambos puntos caen en el rectángulo de la ortoimagen. Quedan pendientes los píxeles válidos del DTM y los corredores. En un entorno que pueda leer el binario, obtener con GDAL la etiqueta, CRS, unidades y máscara. Transformar los puntos a su CRS, muestrearlos y medir cobertura del corredor con la geometría versionada de la base y las rutas simuladas. Si se necesita geolocalizar la Hazcam, identificar la toma original y su RMC para cruzarla con [PDS PLACES](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/).

## Revisión desde el visor

| Contrato | Consume el visor | Acordar antes de implementar |
| --- | --- | --- |
| `terrain/v1` | Malla, leyenda, fuentes y huecos de datos. Ortoimagen opcional. | Formato del raster derivado, tipo y orden de valores, origen de las filas, máscara NoData, transformación a escena y tolerancia de los controles. |
| `scenario/v1` | Comparador A/B, geometrías, base, paradas, fotos acreditadas, eventos y reinicio. | Marco de coordenadas, referencias de geometría por fase, IDs de eventos idempotentes y procedencia o incertidumbre de cada parada. |
| `evaluation/v1` | Pantalla de costes, margen, reserva, déficits, recomendación y razón. | Un ejemplo dominio → interfaz con identificadores y códigos de razón, valores `null` y distinción entre planificación y decisión tras la observación. El visor muestra el resultado emitido por dominio. |

## Verificación y relevo

| Caso | Disponible | Extra al llegar | Directo al llegar | Resultado con reserva de 20 |
| --- | ---: | ---: | ---: | --- |
| Ruta A | 65 | 15 | 35 | Regresar |
| Ruta B | 55 | 5 | 25 | Regresar |
| Caso separado QA-12 | 65 | 30 | 15 | Continuar |

Se recalcularon los tres casos y la inclusión de ambos puntos en el rectángulo. También deben probarse igualdad con la reserva, `unknown` sin cifra y dos opciones bajo reserva con `recommendedOptionId = null` y razón `reserve_unmet`. Siguen pendientes el muestreo del raster, el render y el QA del visor.

Lucian puede continuar con el DTM y preparar con Oriol un ejemplo mínimo de los tres contratos. Para conciliar el tablero con el spec, priorizar la malla 3D de elevación real, dos rutas preparadas y el caso de autonomía. Si falta ortoimagen se permite color de elevación con leyenda. Worldview y la ruta de Curiosity son referencias visuales. MEDA/THEMIS son complementos para esta prueba de terreno.
