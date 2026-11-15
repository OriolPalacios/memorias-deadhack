# DeadHack — NASA Space Apps 2026

Repositorio compartido del equipo DeadHack para **Interplanetary Survival Guide: Martian Map** (**Una parada más**, contexto Jezero / Enchanted Lake).

## Estado actual: esqueleto local de aplicación (Issue #9)

La raíz del proyecto contiene un **esqueleto local ejecutable** para el spec aprobado 0.3, mientras el frente de datos y contratos ([Issue #6](https://github.com/OriolPalacios/memorias-deadhack/issues/6) / Issue #8) prepara los recortes científicos reales (DTM/DEM, capa térmica THEMIS, ortoimagen, fotografía de Perseverance y serie histórica MEDA).

### Alcance implementado en este esqueleto

- **Interfaz de planificación en español** (`React + TypeScript + Vite + Three.js / React Three Fiber`) con dirección visual `true-black-flat` y tipografía `Inter` autoalojada.
- **Visor orbital 3D de referencia** con `OrbitControls`, botón funcional **Restablecer vista**, escena geométrica neutra explícitamente rotulada a la espera de DEM (sin relieve ni coordenadas inventadas) y fallback no bloqueante si WebGL no está disponible.
- **Selector de ruta simulada A/B** conectado a una fuente única de constantes (`src/domain/scenario.ts`) y botón **Reiniciar a Ruta A**.
- **Módulo puro de autonomía** (`src/domain/autonomy.ts`) independiente de React/Three, con evaluación determinista de márgenes, déficits (`reserveDeficitMin`, `budgetDeficitMin`), estados (`meets_reserve`, `below_reserve`, `exhausted`, `unknown`) y códigos de razón (`extra_meets_reserve`, `direct_meets_reserve`, `insufficient_data`, `reserve_unmet`).
- **Frontera aislada de integración de datos** (`src/data/dataSeam.ts`) con estado honesto de disponibilidad y controles dependientes de assets reales explícitamente deshabilitados con motivo accesible.

### Lo que permanece pendiente de datos científicos

- Malla 3D derivada de DTM/DEM real de Jezero y verificación espacial de Enchanted Lake.
- Geometrías reales de las rutas A y B dentro del recorte válido.
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
