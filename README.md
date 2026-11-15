# DeadHack — NASA Space Apps 2026

Repositorio compartido del equipo DeadHack para **Interplanetary Survival Guide: Martian Map** (**Una parada más**, contexto Jezero / Enchanted Lake).

## Estado actual: integración local de Jezero / Enchanted Lake

La raíz del proyecto ejecuta la aplicación web interactiva (`React + TypeScript + Vite + Three.js / React Three Fiber`) conectada al paquete científico local empaquetado en [public/demo/jezero/terrain.json](public/demo/jezero/terrain.json) (`terrain/v1` y `scenario/v1`), manteniendo un modo explícito de referencia temporal únicamente como respaldo en caso de fallo de carga.

### Alcance implementado

- **Consumidor tipado y validación local (`src/data/jezeroContracts.ts`, `src/data/jezeroLoader.ts`)**: resuelve rutas relativas respecto al manifiesto local (honrando `BASE_URL`), verifica longitud de bytes y huella `SHA-256` antes de habilitar capas, decodifica explícitamente `float32-le` + máscara `uint8` (`0`/`1`), valida la proyección planetocéntrica marciana EQC (`+R=3396190`, datum MOLA-adjusted areoid, rechazando proyecciones WGS84) y mantiene errores y reintentos granulares por recurso sin realizar peticiones externas en segundo plano.
- **Visor orbital 3D sobre recorte DEM real (`src/scene/JezeroTerrainStage.tsx`, `src/scene/OrbitalViewport.tsx`, `src/scene/OrbitRig.tsx`)**: construye una malla indexada (`256×256`, `1,5625 m/celda`) con triangulación condicionada a celdas válidas sin rellenar huecos `NoData`, rampa hipsométrica física en metros sobre areoide MOLA (con ortoimagen opcional marcada como no disponible), iluminación del relieve, encuadre inicial al recorte (~400 m), **Restablecer vista**, **Centrar en Enchanted Lake**, soporte de teclado y `prefers-reduced-motion`, y respaldo HTML completo si WebGL no está disponible.
- **Capa térmica nocturna relativa THEMIS sobre el mismo terreno**: alterna activación y opacidad multiplicada por el canal alfa independiente (`NearestFilter`, `flipY=true`, sin mipmaps, fuera de cobertura muestra terreno base), acompañada de leyenda de señal IR relativa (`DN 0..255`), producto, resolución nativa (`100 m`), malla `4×4`, mosaico nocturno y ventana de adquisición desconocida. No convierte a °C ni altera autonomía ni rutas.
- **Geometrías simuladas sobre terreno y selector A/B (`src/domain/scenario.ts`, `src/domain/missionEngine.ts`, `src/domain/autonomy.ts`)**: consume el presupuesto, reserva y duraciones desde `scenario.json` (`una-parada-mas-jezero-v1`), drapa sobre los triángulos válidos del DEM los 5 trazos simulados (`Ruta A`, `Ruta B`, `Parada extra`, `Regreso tras extra` y `Regreso directo`) con indicador posicional por fase y conserva los balances discretos por defecto (`A/directo 35 min`, `A/extra 15 min`, `B/directo 25 min`, `B/extra 5 min`, reserva `20 min`; orbitar o cambiar la capa térmica consume `0 min`).
- **Evidencia contextual, contexto MEDA e inspección de puntos (`src/ui/DataReadinessPanel.tsx`)**: permite inspeccionar `Base`, `Objetivo principal · Mageik` y `Parada extra · Kukaklek` (cota DEM y DN térmico local), muestra la fotografía `PIA25325` (`2022-04-30`, Sol 424) con aviso explícito de ubicación exacta de captura no verificada y presenta la ficha histórica MEDA de Jezero (`718 Pa`, `19 de febrero de 2021 según JPL`) sin inventar marcas temporales ni acoplarla al cálculo de autonomía.

### Cómo recorrer la simulación temporal discreta

1. En **Selección de ruta**, elige **Ruta A** (`120 -> 85 -> 65 min` en decisión) o **Ruta B** (`120 -> 75 -> 55 min`) y pulsa **Iniciar simulación**. Mientras la simulación esté en curso el cambio de ruta queda bloqueado.
2. Avanza manualmente cada tramo discreto (**Completar ida**, **Completar observación principal**); esperar u orbitar el visor 3D o alternar la capa térmica consume `0 min`.
3. En **Punto de decisión**, elige libremente **Elegir regreso directo** (`-30 min`, cierra en `35 min` en Ruta A o `25 min` en Ruta B, cumpliendo la reserva de `20 min`) o **Elegir parada extra** (`-15 min` de desvío y `-35 min` de regreso, cerrando en `15 min` en Ruta A con déficit `5 min` o `5 min` en Ruta B con déficit `15 min`, ambos **bajo reserva**).
4. Completa el regreso (o la parada extra y después el regreso) para consultar el balance final frente a la reserva objetivo de `20 min` y el registro cronológico simulado. Usa **Reiniciar a Ruta A** en cualquier momento para restaurar ruta, simulación y posición simulada.

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
