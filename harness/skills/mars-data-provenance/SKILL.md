---
name: mars-data-provenance
description: Seleccionar, transformar o revisar datos e imágenes de Marte para DeadHack, verificando elevación numérica, cobertura, coordenadas y procedencia antes de incorporarlos a la demo 3D.
---

# Procedencia de datos marcianos

Lee el Issue y [RESOURCES.md](../../../docs/RESOURCES.md). El catálogo de recursos, un producto candidato y un asset integrado son estados distintos; conserva esa distinción en el reporte.

- Para terreno, exige un DTM/DEM numérico identificado. CTX/HiRISE ópticos y tiles sombreados no son altura. No derivar pendientes de colores o inventar relieve para llenar NoData.
- Verifica footprint del producto contra el objetivo. El centro de un DTM de Jezero no es la posición de Enchanted Lake. Una foto de superficie necesita evidencia adicional para ubicarse con precisión en la escena.
- Registra ID de producto, fuente/URL, misión/instrumento, fecha/sol, crédito/uso, checksum, resolución, extensión, unidades, NoData y transformación. Explicita latitud planetocéntrica/planetográfica, longitud este/oeste, datum/radio y proyección; no usar WGS84 terrestre por defecto.
- Al preparar el derivado, conserva la transformación reproducible, la máscara y el vínculo a la fuente. Comprueba elevación, puntos de control y esquinas; si incorporas una textura orbital opcional, verifica también su alineación. Una malla bonita no verifica registro espacial.
- Sigue el contrato de coordenadas aceptado en [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md). La exageración vertical es visual; no altera valores científicos ni tiempos de escenario.
- Etiqueta base, rutas, posición y autonomía simuladas. Conserva fecha/lugar de MEDA y RAD; Worldview es una referencia terrestre y Mount Sharp está en Gale.

Devuelve un reporte compacto de hechos, verificaciones, artefactos y ausentes. Si falta cobertura o georreferenciación, propone a Sol la decisión que hace falta y la evidencia; no cambia silenciosamente el lugar o el objetivo de la misión. No escribas en `memorias/` ni subas originales pesados fuera del alcance del Issue.
