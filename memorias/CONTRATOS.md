# Contratos de integración entre módulos

**Estado: por definir.** No fijar stack ni API antes de elegir caso de uso y datasets.

Cada contrato aprobado debe describir:
1. Nombre y versión (`terrain-grid/v1`, `route-result/v1`, etc.).
2. Dueño humano, productores y consumidores.
3. Formato, campos, tipos, unidades, códigos de error y valores ausentes.
4. Sistema de coordenadas de Marte: datum/radio, convención de longitud, latitud, proyección y transformación.
5. Cobertura, resolución y metadatos de procedencia.
6. Ejemplo mínimo verificable y pruebas de compatibilidad.
7. Supuestos, incertidumbre, limitaciones y política de cambios.

## Protocolo para cambiar contratos
- Abrir Issue de cambio con impacto sobre consumidor y productor.
- Aprobar decisión humana antes de romper compatibilidad.
- Actualizar contrato + pruebas + ejemplos en un PR.
- Los agentes paralelos pueden trabajar con mocks **solo** si el contrato está aprobado.

No tratar los valores visuales de tiles PNG como elevación numérica. No calcular un «índice de seguridad» sin especificar cómo se construye y valida.
