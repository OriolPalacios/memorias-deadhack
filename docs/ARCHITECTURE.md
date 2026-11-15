# Arquitectura del MVP

**Estado:** base de aplicación aprobada por el usuario el 15-11-2026: React, TypeScript, Vite, React Three Fiber y cámara orbital. Los contratos de datos siguen en su frente específico. Esta actualización no implementa la app.

**Actualización 15-11:** demo a las 22:00, Perú. El usuario confirmó recomendaciones explicadas sin chat libre e inclusión de una capa térmica. Lucian atiende datos y revisión de contratos en [Issue #6](https://github.com/OriolPalacios/memorias-deadhack/issues/6); estas decisiones de producto no declaran que los assets ya estén preparados.

La entrada de datos es el [relevo de Lucian en PR #3](https://github.com/OriolPalacios/memorias-deadhack/pull/3#issuecomment-6898767349), complementado por [PR #7](https://github.com/OriolPalacios/memorias-deadhack/pull/7). Allí siguen por acordar serialización del terreno, orden/origen de la rejilla y máscara, eventos y ejemplos de evaluación. Son entregables del frente de contratos; las fuentes localizadas no sustituyen esos ejemplos.

## Base aceptada

Una SPA con **React + TypeScript + Vite + Three.js mediante React Three Fiber**. Drei se usa solo para utilidades concretas de cámara/controles si reduce trabajo. CSS para paneles; lógica de autonomía en funciones TypeScript puras; datos de escenario y assets estáticos locales. Vitest para reglas/contratos y Playwright o computer use de Terra para el recorrido en Chrome.

React Three Fiber es un renderer de Three.js para React; su [documentación de instalación](https://r3f.docs.pmnd.rs/getting-started/installation) exige emparejar las versiones mayores de React y Fiber. En el bootstrap Gemini deberá elegir una combinación compatible, fijar el lockfile y registrar versiones. No usar un `latest` flotante como contrato.

| Opción | Encaje para esta demo | Decisión para el MVP |
|---|---|---|
| Three.js + React Three Fiber | Escena local, control de malla/materiales/cámara y paneles React; permite servir un recorte preparado sin servicios geoespaciales en vivo. | Aprobada por el usuario. |
| Three.js directo | Ofrece el mismo motor con gestión manual del ciclo de vida y sincronización con React. | Útil si el equipo ya tiene una escena reutilizable; evita mantener dos enfoques a la vez. |
| CesiumJS | Su [modelo de terreno](https://cesium.com/learn/cesiumjs-learn/cesiumjs-terrain/) favorece terreno teselado y grandes extensiones; Mars requiere configurar referencia planetaria y proveedor de terreno propios. | Su preparación añade riesgo para un recorte y una entrega mañana; reconsiderar para expansión planetaria. |
| Visor cartográfico 2D | Simplifica navegación de capas, pero no satisface el requisito 3D elegido por el usuario. | Solo posible vista auxiliar futura. |

La elección es una evaluación de alcance/plazo, no un benchmark realizado. No se ha verificado todavía el rendimiento de una malla real en el equipo de demo.

## Capas y responsabilidad de la aplicación

- El DTM determina la geometría del terreno. Las capas óptica y térmica se representan sobre esa misma geometría con un selector y opacidad; cambiar una capa no altera la elevación ni la evaluación de autonomía.
- La térmica forma parte del MVP. La ortoimagen y la superposición geológica son adicionales según disponibilidad; la foto de superficie aparece en la parada científica y MEDA en una ficha histórica.
- Lucian define el producto y cómo expresarlo en los contratos de datos: cobertura, resolución nativa, referencia espacial, archivo preparado, leyenda/unidades y contexto temporal. La app debe poder distinguir un asset ausente de una zona sin cobertura; no deduce grados Celsius de colores sin una calibración explícita del producto.
- Preparar recorte/alineación antes de servir los assets. La app consume el resultado y muestra las limitaciones; este documento no fija una serialización nueva por encima del trabajo de contratos de #6.

La base técnica y la cámara orbital están aprobadas. El usuario aplazó el hosting; la app se desarrolla y ensaya localmente. El estado de misión se organiza mediante eventos y un reducer de React. Los agentes del harness trabajan durante el desarrollo.

## Separación mínima

```text
src/
  app/          composición de la pantalla y estado de sesión
  domain/       eventos, autonomía, evaluación y recomendación (sin React/Three)
  scene/        malla, textura, rutas, marcadores, cámara
  ui/           comparación, controles, foto, fuentes y resultado
  data/         validación/carga de manifiestos y escenarios
public/demo/    assets pequeños preparados para la demo
scripts/data/  transformación reproducible de datos de origen
tests/         contratos, reglas y recorrido de demo
```

Es una organización propuesta, no un inventario existente. Un repositorio y una app; sin monorepo, servidor de agentes, base de datos ni API de recomendaciones. Los originales grandes permanecen en `data/raw/` ignorado por Git, conforme a la política actual. Los assets optimizados de demo se versionan solo si son pequeños y su redistribución está permitida.

## Contratos a congelar antes de escribir en paralelo

Estos campos son un borrador del contrato. Una vez aceptados, se versionan como `terrain/v1`, `scenario/v1` y `evaluation/v1` con ejemplos/pruebas. Sus referencias y aprobación se registran según [memorias/CONTRATOS.md](../memorias/CONTRATOS.md), sin editar ese índice desde tareas paralelas.

| Contrato | Contenido mínimo y dueño de producción |
|---|---|
| `terrain/v1` | Equipo de datos: `id`, `sourceIds`, `heightAsset`, `textureAsset` opcional, dimensiones de rejilla, extensión/CRS, convención de latitud/longitud, unidades horizontales/verticales, datum de elevación, transformación a escena, máscara NoData, resolución original y derivada, exageración vertical, límites de cobertura. |
| `scenario/v1` | Equipo de dominio: `id`, versión, presupuesto/reserva en min; base y POIs con coordenadas y `simulated`; dos rutas con geometría, eventos/tiempos; parada opcional y regreso. Cada referencia debe apuntar a un ID existente y quedar dentro del recorte válido. |
| `evaluation/v1` | Dominio → UI: por opción, coste pendiente, previsto en base, reserva, `reserveDeltaMin` firmado, `reserveDeficitMin`, `budgetDeficitMin`, estado y razón; a nivel conjunto, opción recomendada o `null` y razón. Umbrales, campos ausentes y precedencia están definidos en SPEC; los textos son responsabilidad de la UI. |

Valores científicos ausentes son `null` más motivo, no ceros inventados. Unidades y enums son explícitos. La UI no recalcula autonomía por su cuenta. `exhausted` se aplica a previsto ≤0; `below_reserve` a 0<previsto<reserva; `meets_reserve` a previsto≥reserva, con reserva>0. La selección se hace por la tabla de precedencia del SPEC, no por el orden accidental de condiciones en código. Una versión incompatible requiere acuerdo productor/consumidor antes de cambiarla.

### Convenciones de `evaluation/v1` confirmadas por Sol

Se acepta la propuesta del [comentario de Lucian](https://github.com/OriolPalacios/memorias-deadhack/pull/3#issuecomment-6899618403) para alinear dominio y visor, dentro del comportamiento del spec aprobado:

| Elemento | Nombre acordado |
|---|---|
| IDs de las opciones | `extra`, `direct` |
| Minutos previstos al llegar a base | `projectedAtBaseMin` (`number` o `null`) |
| Campo de razón de la recomendación conjunta | `reasonCode` |
| Recomendación de parada extra que cumple reserva | `extra_meets_reserve` |
| Recomendación de regreso directo que cumple reserva | `direct_meets_reserve` |
| Ninguna conocida cumple y hay datos desconocidos | `insufficient_data`; `recommendedOptionId: null` |
| Ambas conocidas incumplen | `reserve_unmet`; `recommendedOptionId: null` |

Los deltas, déficits y estados conservan la semántica de SPEC. La UI traduce los códigos a texto. Estas convenciones resuelven los nombres solicitados; el ejemplo completo/serialización de cada contrato y las geometrías A/B se acuerdan con Lucian antes de sus implementaciones consumidoras. No se atribuye revisión de los nueve casos completos a la tabla de cuatro casos publicada en el comentario.

## Coordenadas y terreno

1. Seleccionar un producto numérico DTM/DEM que cubra el área científica y comprobar su etiqueta geoespacial. El candidato HiRISE está en [RESOURCES.md](RESOURCES.md); su cobertura en Enchanted Lake aún no está validada.
2. Recortar y muestrear a una rejilla reducida o malla estática. Si se incorpora textura orbital, prepararla con la misma extensión/proyección; si no, usar color de elevación con leyenda. Guardar el comando y metadatos que permiten reproducir la transformación.
3. Usar coordenadas locales en metros para el render: `x` al este, `y` arriba y `z` al sur (norte hacia `−z`), con origen explicitado y altura relativa a un datum/offset registrado. Las transformaciones desde la fuente a este marco deben quedar documentadas y probadas; no sustituir el radio de Marte por el terrestre.
4. Compartir la misma transformación entre terreno, rutas y POIs. Validar al menos dos puntos de control y las esquinas del recorte; cuando haya textura orbital, comprobar además que no quede espejada o girada.
5. Aplicar exageración vertical solo al render y drapear las rutas coherentemente. Los costes temporales del MVP siguen siendo parámetros del escenario, independientes del render.

La rejilla puede convertirse en geometría al cargar; la transformación pesada y la descarga de rásteres completos ocurren antes, no en el navegador. La foto de rover aparece en una ficha del punto científico, no como una textura orbital georreferenciada.

## Estado y carga

Estados de misión: `planning → outbound → observing → deciding → returning → completed`, con `extra_stop` si se elige continuar y un estado de error de recursos. Una transición aplica su coste una vez. Cambiar ruta o presupuesto se limita a `planning` o a reiniciar.

Los assets esenciales se sirven desde la misma app. Enlaces de fuente externos pueden abrirse, pero el flujo principal funciona sin red externa una vez servida la app. No se promete una PWA ni apertura directa con `file://`.

Objetivos iniciales a medir: paquete de datos de demo ≤15 MB, malla inicial de aproximadamente 128×128 o 256×256 muestras según detalle, y cámara fluida en el portátil real. Son presupuestos de ingeniería propuestos; se reducirá textura/densidad para conservar la experiencia 3D si el ensayo lo exige. La primera prueba de terreno debe mostrar una malla real antes de invertir en pulido visual.

## Dependencias de ejecución pendientes

Localmente se observaron Node `v24.13.1`, npm `11.8.0` y Python `3.9.6`. El instalador de procesamiento geoespacial (GDAL/rasterio o alternativa capaz de leer el producto elegido) todavía no se comprobó. No imponer un pipeline Python que exija otra versión sin registrar el requisito. Hosting estático y operador de publicación siguen pendientes; no hace falta decidir un backend.
