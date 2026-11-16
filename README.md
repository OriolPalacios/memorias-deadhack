# DeadHack — NASA Space Apps 2026

Repositorio compartido del equipo DeadHack para **Interplanetary Survival Guide: Martian Map** (**Una parada más**, contexto Jezero / Enchanted Lake).

## Estado actual: integración local de Jezero / Enchanted Lake

La raíz del proyecto ejecuta la aplicación web interactiva (`React + TypeScript + Vite + Three.js / React Three Fiber`) conectada al paquete científico local empaquetado en [public/demo/jezero/terrain.json](public/demo/jezero/terrain.json) (`terrain/v1` y `scenario/v1`), manteniendo un modo explícito de referencia temporal únicamente como respaldo en caso de fallo de carga.

### Alcance implementado

- **Consumidor tipado y validación local (`src/data/jezeroContracts.ts`, `src/data/jezeroLoader.ts`)**: resuelve rutas relativas respecto al manifiesto local (honrando `BASE_URL`), verifica longitud de bytes y huella `SHA-256` antes de habilitar capas, decodifica explícitamente `float32-le` + máscara `uint8` (`0`/`1`), decodifica `thermal.png` directamente desde bytes W3C PNG + `DecompressionStream('deflate')` sin usar Canvas `getImageData` (**alcance v1 explícito: PNG RGBA8 no entrelazado**, `bitDepth=8`, `colorType=6`), valida la proyección planetocéntrica marciana EQC (`+R=3396190`, datum MOLA-adjusted areoid, rechazando proyecciones WGS84) y mantiene errores y reintentos granulares por recurso sin realizar peticiones externas en segundo plano.
- **Visor orbital 3D e interacción sobre terreno (`src/scene/JezeroTerrainStage.tsx`, `src/scene/OrbitalViewport.tsx`, `src/scene/OrbitRig.tsx`, `src/scene/AstronautFigure.tsx`)**: construye una malla indexada (`256×256`, `1,5625 m/celda`) con triangulación condicionada a celdas válidas sin rellenar huecos `NoData` (partición exacta por cruces estructurales de celdas/diagonales), superficie **ilustrativa procedural de regolito** sin desplazamiento de vértices frente a modo **Elevación** por rampa física MOLA (`Capas` flotante en el lienzo), **Ortoimagen** y **Geología** marcadas honestamente como no disponibles, iluminación rasante cálida + relleno frío, encuadre oblicuo inicial (~54° con Base abajo-izquierda y objetivo simulado arriba-derecha), transiciones suaves de cámara (650 ms ease-out interrumpibles al orbitar) en **Restablecer vista** y **Centrar objetivo simulado**, astronauta articulado con primitivas locales (marcado explícitamente como símbolo ampliado), etiquetas POI sobre el mapa, soporte de teclado, `prefers-reduced-motion` y respaldo HTML completo si WebGL no está disponible.
- **Capa térmica nocturna relativa THEMIS sobre el mismo terreno**: alterna activación y opacidad multiplicada por el canal alfa independiente mediante `THREE.DataTexture` (`flipY=true`, `NearestFilter`, sin mipmaps, fuera de cobertura muestra terreno base), acompañada de leyenda de señal IR relativa (`DN 0..255`), producto, resolución nativa (`100 m`), malla `4×4`, mosaico nocturno y ventana de adquisición desconocida. No convierte a °C ni altera autonomía ni rutas.
- **Geometrías simuladas sobre terreno, bloqueo autoritativo de escenario y reproducción automática (`src/domain/scenario.ts`, `src/app/missionPlayback.ts`)**: espera la resolución válida de `scenario.json` (`una-parada-mas-jezero-v1`, o respaldo explícito ante error) antes de habilitar el inicio y congela la configuración al arrancar una ejecución; drapa los 5 trazos simulados sobre triángulos válidos del DEM (`Ruta A`, `Ruta B`, `Parada extra`, `Regreso tras extra` y `Regreso directo`) y anima al astronauta automáticamente conservando costes discretos fijos (`A/directo 35 min`, `A/extra 15 min`, `B/directo 25 min`, `B/extra 5 min`, reserva `20 min`). Orbitar, pausar/reanudar o cambiar capas consume `0 min`.
- **Evidencia contextual, contexto MEDA e inspección de puntos (`src/ui/DataReadinessPanel.tsx`)**: en el carril izquierdo de datos permite inspeccionar `Base`, `Objetivo científico (simulado)` y `Parada extra (simulada)` (cota DEM y DN térmico local), muestra la fotografía `PIA25325` (`2022-04-30`, Sol 424) con aviso explícito de ubicación exacta de captura no verificada (evidencia contextual, nunca geolocalización verificada de cámara) y presenta la ficha histórica MEDA de Jezero (`718 Pa`, `19 de febrero de 2021 según JPL`) sin inventar marcas temporales ni acoplarla al cálculo de autonomía.

### Cómo recorrer la simulación automática con pausa de decisión

1. Una vez validada la configuración del escenario, elige **Ruta A** (`120 -> 85 -> 65 min` en decisión) o **Ruta B** (`120 -> 75 -> 55 min`) y pulsa **Iniciar simulación**. Mientras la simulación esté en curso el cambio de ruta queda bloqueado.
2. El astronauta recorre automáticamente la ruta simulada (puedes pulsar **Pausar** / **Reanudar caminata** en cualquier instante con `0 min` de coste) y ejecuta la observación científica hasta alcanzar **Punto de decisión**, donde la reproducción se detiene indefinidamente esperando tu elección.
3. En **Punto de decisión**, elige libremente **Elegir regreso directo** (`-30 min`, cierra en `35 min` en Ruta A o `25 min` en Ruta B, cumpliendo la reserva de `20 min`) o **Elegir parada extra simulada** (`-15 min` de desvío y `-35 min` de regreso, cerrando en `15 min` en Ruta A con déficit `5 min` o `5 min` en Ruta B con déficit `15 min`, ambos **bajo reserva**).
4. La caminata completa automáticamente el tramo final hasta la base para mostrar el balance frente a la reserva objetivo de `20 min` y el registro cronológico simulado. Usa **Reiniciar a Ruta A** en cualquier momento para restaurar ruta, simulación, cámara y posición simulada.

> Alcance y límites: las posiciones, rutas y duraciones del escenario (`una-parada-mas-jezero-v1`) son simuladas para evaluación de autonomía; el prototipo **no** certifica la seguridad de una actividad extravehicular (EVA), no estima temperatura superficial ni convierte DN infrarrojos a °C, y las referencias geográficas de `PIA25325` permanecen sin verificar salvo su asociación contextual al escenario.

## Comandos locales

Requisitos verificados en este entorno: Node `24.x`, npm `11.x`.

```bash
npm ci               # Instala dependencias exactamente según package-lock.json
npm run dev          # Inicia el servidor local de desarrollo (Vite)
npm run typecheck    # Verifica tipos TypeScript sin emitir archivos
npm run lint         # Ejecuta ESLint sobre el proyecto
npm test             # Ejecuta la batería de pruebas unitarias (Vitest)
npm run build        # Verifica tipos y genera el bundle de producción en dist/
npm run preview      # Sirve localmente el bundle compilado en http://127.0.0.1:4173
```

### Acceso local y túneles Cloudflare (`vite.config.ts`)

Tanto `server` (`dev`) como `preview` mantienen el acceso normal por `localhost` / bucle local y admiten subdominios legítimos de `trycloudflare.com` mediante:

- `allowedHosts: ['.trycloudflare.com']` (permite el sufijo de túnel junto con `localhost`, `.localhost` e IPs locales sin habilitar `allowedHosts: true`).

Al editar `vite.config.ts`, Vite suele reiniciar automáticamente `npm run dev`; si el servidor de `dev` o `npm run preview` ya estaba en ejecución antes del cambio y no recargó la configuración, detén y vuelve a iniciar ese proceso manualmente para aplicar la nueva política.

## Arquitectura de datos y escena

1. El cargador local (`src/data/jezeroLoader.ts`) descarga y valida los recursos declarados en `public/demo/jezero/terrain.json` mediante [src/data/jezeroContracts.ts](src/data/jezeroContracts.ts).
2. El puerto interno `SceneDataPort` ([src/data/dataSeam.ts](src/data/dataSeam.ts)) refleja el estado real de cada capa y alimenta `<App />` ([src/App.tsx](src/App.tsx)) sin acoplar la lógica pura de autonomía (`src/domain/autonomy.ts`).
3. Mientras el DEM o el escenario están cargando (o en caso de fallo), el visor mantiene la etapa geométrica de referencia ([src/scene/ReferenceStage.tsx](src/scene/ReferenceStage.tsx)) sin anunciar terreno activo.

## Documentación y coordinación del repositorio

- `memorias/`: contexto persistente y protocolo de coordinación de agentes ([memorias/README.md](memorias/README.md), [memorias/PROTOCOLO.md](memorias/PROTOCOLO.md)).
- [Spec 0.3 aprobado](docs/SPEC.md) · [Arquitectura](docs/ARCHITECTURE.md) · [Recursos y procedencia](docs/RESOURCES.md) · [Decisiones](docs/DECISIONS.md) · [Plan de entrega](docs/DELIVERY.md) · [QA](docs/QA.md).
- [Harness: agentes, skills, workflows y arranque](harness/README.md) · [Asignación editable](harness/team.json).

> Importante: `memorias/` y `harness/` no ejecutan agentes ni sustituyen la coordinación en GitHub Issues y Pull Requests.
