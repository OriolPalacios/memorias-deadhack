# API de Mars Trek y datos de Jezero

Usa **Mars Trek WMTS** para descargar imágenes por tesela. La matriz de la capa indica la posición de cada imagen. Para calcular elevaciones o pendientes, lee el DTM HiRISE. Para visualizar el infrarrojo nocturno, lee el mosaico THEMIS. El punto de partida para integrar los derivados es `demo/jezero/terrain.json` en la app. [Manifiesto del recorte](https://github.com/OriolPalacios/memorias-deadhack/blob/a788b9dbde6f27d4230b56fb0c10ab8ad22a7017/public/demo/jezero/terrain.json) · [Contrato y rejillas](https://github.com/OriolPalacios/memorias-deadhack/blob/a788b9dbde6f27d4230b56fb0c10ab8ad22a7017/docs/contracts/jezero-v1.md)

## Descargar imágenes del recorte

Busca **MRO HiRISE, Jezero Mosaic, Controlled** en el catálogo de la API. Los botones **WMTS Endpoint**, **WMTS Capabilities** y **Metadata** muestran la URL, la matriz de teselas y los metadatos. El visor permite explorar otras capas y zonas de Marte. [Catálogo oficial de la API](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) · [Visor Mars Trek](https://trek.nasa.gov/mars/)

Las solicitudes son `GET` sin clave. Lee `ResourceURL` y `TileMatrixSet` en el XML para conocer el formato y la cuadrícula de la capa. En esta capa el orden es **nivel, fila, columna**. [GetCapabilities de Jezero](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml) · [PNG de ejemplo](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/15/13024/46857.png)

Estos comandos en Bash descargan el XML y las seis teselas del nivel 15 que cubren el recorte de **400 × 400 m** de `jezero-dem-20261115-v1`.

```bash
wmts='https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0'
curl -fsSL "$wmts/WMTSCapabilities.xml" -o jezero-wmts.xml

for row in 13024 13025; do
  for col in 46857 46858 46859; do
    curl -fsSL "$wmts/default/default028mm/15/$row/$col.png" \
      -o "jezero-15-${row}-${col}.png" || exit 1
  done
done
```

Si cambia el recorte, transforma las esquinas de `grid.extentM` del manifiesto a longitud este en `[-180°, 180°)` y latitud planetocéntrica. Para `default028mm` de esta capa, con origen `[-180°, 90°]`, el siguiente cálculo da índices desde cero. Usa `MatrixWidth` y `MatrixHeight` del nivel elegido y pide todas las teselas que intersecten la extensión.

```text
columna = floor((lonEste + 180) * MatrixWidth / 360)
fila    = floor((90 - lat) * MatrixHeight / 180)
```

Para obtener los bordes de cada tesela, invierte las fórmulas en `columna` y `columna + 1`, y en `fila` y `fila + 1`. En el nivel 15 del ejemplo, `MatrixWidth = 65536` y `MatrixHeight = 32768`. Conserva el CRS marciano y el origen noroeste indicados en el XML.

## Obtener GeoTIFF mediante USGS STAC

| Dato | Producto | Campo con la URL del raster |
| --- | --- | --- |
| Elevación y pendiente | [HiRISE `DTEEC_002387_1985_003798_1985_A01`](https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms/items/DTEEC_002387_1985_003798_1985_A01) · [Ficha HiRISE](https://hirise.lpl.arizona.edu/dtm/PSP_002387_1985) | `assets.dtm.href` |
| Intensidad IR nocturna relativa | [THEMIS `mc13_syrtis_major_nir`](https://stac.astrogeology.usgs.gov/api/collections/mo_themis_controlled_mosaics/items/mc13_syrtis_major_nir) · [Documentación USGS](https://stac.astrogeology.usgs.gov/docs/data/mars/themis_controlled_mosaics/) | `assets.image.href` |

Este ejemplo resuelve el enlace del DTM desde el JSON y comprueba que el servidor acepta lecturas parciales. Para THEMIS, usa la URL y la clave `image` de la tabla.

```bash
item='https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms/items/DTEEC_002387_1985_003798_1985_A01'
asset_url=$(curl -fsSL "$item" | python3 -c \
  'import json, sys; print(json.load(sys.stdin)["assets"][sys.argv[1]]["href"])' dtm)
curl -fsSL --range 0-15 -D - -o /dev/null "$asset_url"
```

Lee una ventana del GeoTIFF con GDAL sobre `/vsicurl/` en el CRS nativo del raster. Aplica escala y offset de la altura según los metadatos y conserva la máscara NoData. El COG THEMIS es de 8 bits a 100 m/píxel y se rotula como intensidad IR relativa. Para buscar otras observaciones usa el [catálogo STAC de USGS](https://stac.astrogeology.usgs.gov/api/) o el [servicio REST de NASA PDS ODE](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Additional_Resources/ODE_REST_API.htm). [Lecturas parciales con GDAL](https://gdal.org/en/stable/user/virtual_file_systems.html#vsicurl-http-https-ftp-files-random-access)

## Integrar una textura en el visor

1. Une las teselas con norte arriba. Reproyecta y recorta a `frame.projection` y `grid.extentM` del manifiesto. Conserva la máscara de la imagen.
2. Si el consumidor admite la textura, exporta una imagen local WebP o PNG y registra su fuente, rejilla y máscara en `textureAsset` según el contrato. Guarda el ID de capa, la URL de capacidades, el crédito de **Metadata**, el nivel, las filas y columnas y el comando de transformación.
3. Comprueba el registro en las esquinas, la posición de las rutas A/B y el peso total de `dist/` frente a 15 MB. Si se incorpora la imagen, acredita el recorte de Mars Trek como recurso R-05 en la entrega. [Recursos del reto](RESOURCES.md) · [Integración de app](https://github.com/OriolPalacios/memorias-deadhack/issues/9)

**Verificación del 15 de noviembre de 2026 (Lima).** El XML y las seis teselas respondieron `HTTP 200`. Los PNG de 256 × 256 sumaron 324 616 bytes. La ventana del recorte en el mosaico de origen tuvo alfa 255 en todos sus píxeles. El XML y las imágenes incluyeron `Access-Control-Allow-Origin: *`. Ambos GeoTIFF respondieron `HTTP 206` a una solicitud de rango. Quedan por comprobar la reproyección y su alineación en el visor.
