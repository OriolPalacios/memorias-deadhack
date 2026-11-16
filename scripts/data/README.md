# Preparación del recorte de Jezero

El paquete usa `jezero-geometry-proposal-20261115-1` y el recorte EQC de 400 × 400 m confirmado por Oriol. [Geometrías y costes](https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6901693527) · [Acuerdo del consumidor](https://github.com/OriolPalacios/memorias-deadhack/pull/10#issuecomment-6902087995)

## Reproducir desde la raíz del repo

Se verificó con Python 3.13.3, NumPy 2.4.1 y Pillow 13.0.0. Se requiere acceso HTTPS a los proveedores para recuperar originales o rangos cuando la caché esté vacía.

```text
python -m pip install numpy==2.4.1 Pillow==13.0.0
python -c "from pathlib import Path; from urllib.request import urlretrieve; p=Path('data/raw'); p.mkdir(parents=True, exist_ok=True); urlretrieve('https://stac.astrogeology.usgs.gov/api/collections/mo_themis_controlled_mosaics/items/mc13_syrtis_major_nir', p/'mc13_syrtis_major_nir.stac.json')"
python scripts/data/prepare_hirise_jezero.py --geometry scripts/data/jezero-geometry-v1.json --cache data/raw --out public/demo/jezero
python scripts/data/prepare_jezero_thermal.py data/raw/mc13_syrtis_major_nir.stac.json --output data/raw/jezero-thermal
python scripts/data/assemble_jezero_package.py --geometry scripts/data/jezero-geometry-v1.json --cache data/raw --thermal data/raw/jezero-thermal --out public/demo/jezero --evidence-out docs/contracts/examples
```

El validador HiRISE comprueba cada recorrido y su corredor de 5 m dentro de los límites de la malla de centros. Para la térmica se lee la ventana del COG a resolución completa y se comprueba la decodificación con LibTIFF. El ensamblador verifica versiones, dimensiones y hashes. El proceso genera archivos estáticos para el visor.

El consumidor comienza en `demo/jezero/terrain.json` bajo la URL base de la app. Los enlaces entre assets son relativos al JSON que los declara. Las alturas son metros respecto del areoide de origen. La señal THEMIS es intensidad relativa en escala de grises con validez en alfa. La ubicación exacta de la Hazcam sigue sin verificarse. [Contrato](../../docs/contracts/jezero-v1.md) · [Evidencia de cobertura](../../docs/contracts/examples/jezero-v1-ground-validation.json)
