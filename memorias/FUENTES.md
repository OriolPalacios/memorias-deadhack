# Fuentes científicas (directorio inicial, no selección final)

Todos los productos deben registrar misión, instrumento, ID de producto, enlace, fecha/sol, cobertura, resolución, CRS/proyección, unidades, valores ausentes y condiciones de uso cuando correspondan.

| Fuente | Qué aporta | Entrada |
|---|---|---|
| NASA Mars Trek / JPL | Capas y servicios cartográficos (WMTS) | https://trek.nasa.gov/mars/ |
| NASA PDS Orbital Data Explorer | Búsqueda de observaciones orbitales y metadatos | https://ode.rsl.wustl.edu/mars/ |
| HiRISE / Univ. Arizona | Imágenes detalladas; DTM donde existen productos estéreo | https://www.uahirise.org/ |
| USGS Geologic Map SIM 3292 | Contexto de unidades geológicas a escala global | https://pubs.usgs.gov/sim/3292/ |
| JMARS / ASU | Exploración y comparación de capas científicas | https://jmars.asu.edu/ |
| Mars Odyssey THEMIS | Infrarrojo y mosaicos térmicos | https://mars.asu.edu/data/ |
| Perseverance MEDA | Observaciones atmosféricas locales | https://pds-atmospheres.nmsu.edu/ |
| NASA Mars 2020 | Recorrido y fotografías de superficie | https://science.nasa.gov/mission/mars-2020-perseverance/ |

## Cautelas metodológicas
- CTX y HiRISE **imágenes** no proporcionan pendientes cuantitativas por sí solas: se necesita un DTM/DEM compatible.
- MOLA global es útil para contexto; su resolución no certifica obstáculos a escala peatonal.
- Unidades USGS globales no sirven de mapa de obstáculos locales.
- MEDA/REMS/RAD observan ubicaciones y períodos concretos; no extrapolar sin modelo.
- Productos en diferentes sistemas planetocéntricos/planetográficos o longitudes este/oeste deben reconciliarse.
- Una zona no observada ≠ zona segura. Identificar incertidumbre.
- Cualquier cálculo de oxígeno, autonomía o dosis requiere supuestos y validación propios.

**Estado:** catálogo preliminar. No declara que un dataset esté descargado o disponible para la región que se elija.
