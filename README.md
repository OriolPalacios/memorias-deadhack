# DeadHack — NASA Space Apps 2026

Repositorio compartido del equipo DeadHack para **Interplanetary Survival Guide: Martian Map** (**Una parada más**, contexto Jezero / Enchanted Lake).

## Estado actual: esqueleto local de aplicación (Issue #9)

La raíz del proyecto contiene un **esqueleto local ejecutable** para el spec aprobado 0.3, mientras el frente de datos y contratos ([Issue #6](https://github.com/OriolPalacios/memorias-deadhack/issues/6) / Issue #8) prepara los recortes científicos reales (DTM/DEM, capa térmica THEMIS, ortoimagen, fotografía de Perseverance y serie histórica MEDA).

### Alcance implementado en este esqueleto

- **Interfaz de planificación en español** (`React + TypeScript + Vite + Three.js / React Three Fiber`) con dirección visual `true-black-flat` y tipografía `Inter` autoalojada.
- **Visor orbital 3D de referencia** con `OrbitControls`, botón funcional **Restablecer vista**, escena geométrica neutra explícitamente rotulada a la espera de DEM (sin relieve ni coordenadas inventadas) y fallback no bloqueante si WebGL no está disponible.
- **Selector de ruta simulada A/B y simulación discreta de misión** conectados a una fuente única de constantes (`src/domain/scenario.ts` y `src/domain/missionEngine.ts`) con botón **Reiniciar a Ruta A**.
- **Máquina de estados pura de fases y autonomía** (`src/domain/missionEngine.ts` + `src/domain/autonomy.ts`) independiente de React/Three: recorre `planning -> outbound -> observing -> deciding -> returning -> completed` (más `extra_stop` en la rama de parada extra), valida idempotencia por evento/fase sin dobles descuentos y conserva el evaluador determinista (`meets_reserve`, `below_reserve`, `exhausted`, `unknown`).
- **Frontera aislada de integración de datos** (`src/data/dataSeam.ts`) con estado honesto de disponibilidad y controles dependientes de terreno/instrumentos marcados como simulados mientras las capas reales permanecen en espera.

### Cómo recorrer la simulación temporal discreta

1. En **Selección de ruta**, elige **Ruta A** (`120 -> 85 -> 65 min` en decisión) o **Ruta B** (`120 -> 75 -> 55 min`) y pulsa **Iniciar simulación**. Mientras la simulación esté en curso el cambio de ruta queda bloqueado.
2. Avanza manualmente cada tramo discreto (**Completar ida**, **Completar observación principal**); esperar u orbitar el visor 3D consume `0 min`.
3. En **Punto de decisión**, elige libremente **Elegir regreso directo** (`-30 min`, cierra en `35 min` en Ruta A o `25 min` en Ruta B, cumpliendo la reserva de `20 min`) o **Elegir parada extra** (`-15 min` de desvío y `-35 min` de regreso, cerrando en `15 min` en Ruta A con déficit `5 min` o `5 min` en Ruta B con déficit `15 min`, ambos **bajo reserva**).
4. Completa el regreso (o la parada extra y después el regreso) para consultar el balance final frente a la reserva objetivo de `20 min` y el registro cronológico simulado. Usa **Reiniciar a Ruta A** en cualquier momento para restaurar estado, ruta y cámara.

> Alcance y límites: esta simulación valida únicamente fases discretas y balance temporal predefinido; no simula telemetría física real, terreno DEM, exposición térmica THEMIS ni contexto ambiental MEDA.

### Lo que permanece pendiente de datos científicos

- Malla 3D derivada de DTM/DEM real de Jezero y verificación espacial de Enchanted Lake.
- Geometrías simuladas de los escenarios A y B validadas dentro del recorte real del terreno.
- Capa térmica infrarroja THEMIS alineada, leyenda y metadatos de adquisición.
- Ortoimagen orbital opcional, fotografía local de superficie y ficha histórica MEDA.

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

## Dónde se integrará el futuro adaptador de datos

La aplicación no define esquemas de manifiestos externos ni realiza consultas de red simuladas. Cuando los contratos de datos y assets científicos preparados ([Issue #6](https://github.com/OriolPalacios/memorias-deadhack/issues/6) / Issue #8) estén cerrados:

1. Crear el adaptador que valide y normalice el paquete externo hacia el marco de escena acordado (`+x` este, `+y` arriba, `+z` sur) en `src/data/`.
2. Poblar el contrato interno `SceneDataPort` definido en [src/data/dataSeam.ts](src/data/dataSeam.ts) e inyectarlo en `<App dataPort={...} />` ([src/App.tsx](src/App.tsx)).
3. Conectar la malla DEM y capas dentro de [src/scene/OrbitalViewport.tsx](src/scene/OrbitalViewport.tsx) sin alterar el módulo puro de autonomía (`src/domain/autonomy.ts`).

## Documentación y coordinación del repositorio

- `memorias/`: contexto persistente y protocolo de coordinación de agentes ([memorias/README.md](memorias/README.md), [memorias/PROTOCOLO.md](memorias/PROTOCOLO.md)).
- [Spec 0.3 aprobado](docs/SPEC.md) · [Arquitectura](docs/ARCHITECTURE.md) · [Recursos y procedencia](docs/RESOURCES.md) · [Decisiones](docs/DECISIONS.md) · [Plan de entrega](docs/DELIVERY.md) · [QA](docs/QA.md).
- [Harness: agentes, skills, workflows y arranque](harness/README.md) · [Asignación editable](harness/team.json).

> Importante: `memorias/` y `harness/` no ejecutan agentes ni sustituyen la coordinación en GitHub Issues y Pull Requests.
