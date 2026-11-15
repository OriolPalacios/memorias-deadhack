import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  createInitialMissionState,
  missionShellReducer,
  type MissionShellAction,
  type MissionShellState,
} from './app/missionState.ts';
import {
  isLayerReady,
  type ReadyTerrainRef,
  type ReadyThermalRef,
  type SceneDataPort,
} from './data/dataSeam.ts';
import { useJezeroPackageLoader } from './data/jezeroLoader.ts';
import { getMissionPhaseMeta } from './domain/missionEngine.ts';
import {
  buildRouteProjection,
  SIMULATED_MISSION_BASELINE,
} from './domain/scenario.ts';
import type { InspectablePoiId } from './scene/JezeroTerrainStage.tsx';
import { OrbitalViewport } from './scene/OrbitalViewport.tsx';
import { detectWebGLSupport } from './scene/webglSupport.ts';
import { AutonomyComparisonPanel } from './ui/AutonomyComparisonPanel.tsx';
import { DataReadinessPanel } from './ui/DataReadinessPanel.tsx';
import { HeaderBar } from './ui/HeaderBar.tsx';
import { RouteSelectorPanel } from './ui/RouteSelectorPanel.tsx';

export interface AppProps {
  readonly dataPort?: SceneDataPort;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };
    query.addEventListener('change', handleChange);
    return () => {
      query.removeEventListener('change', handleChange);
    };
  }, []);

  return reduced;
}

export function App({ dataPort }: AppProps) {
  const packageLoader = useJezeroPackageLoader(dataPort === undefined);
  const resolvedPort = dataPort ?? packageLoader.dataPort;
  const activeBaseline =
    dataPort === undefined ? packageLoader.activeBaseline : SIMULATED_MISSION_BASELINE;
  const reducedMotion = usePrefersReducedMotion();

  const [state, dispatch] = useReducer(
    (prevState: MissionShellState, action: MissionShellAction) =>
      missionShellReducer(prevState, action, activeBaseline),
    undefined,
    () => createInitialMissionState(detectWebGLSupport() ? 'ready' : 'unavailable'),
  );

  const [thermalEnabled, setThermalEnabled] = useState(false);
  const [thermalOpacity, setThermalOpacity] = useState(0.75);
  const [selectedPoiId, setSelectedPoiId] = useState<InspectablePoiId>('science');
  const [focusSignal, setFocusSignal] = useState(0);

  // Sync loaded scenario budget/reserve/times into initial planning state without resetting view
  useEffect(() => {
    if (dataPort === undefined && packageLoader.scenarioStatus === 'ready') {
      dispatch({ type: 'sync_baseline', baseline: activeBaseline });
    }
  }, [dataPort, packageLoader.scenarioStatus, activeBaseline]);

  const projection = useMemo(
    () => buildRouteProjection(state.selectedRouteId, activeBaseline),
    [state.selectedRouteId, activeBaseline],
  );
  const phaseMeta = getMissionPhaseMeta(
    state.mission.phase,
    activeBaseline,
    state.selectedRouteId,
  );

  const terrainLayer = resolvedPort.layers.terrain_dem;
  const thermalLayer = resolvedPort.layers.thermal_ir;
  const hasRealTerrain =
    isLayerReady(terrainLayer) &&
    (dataPort !== undefined || packageLoader.terrainGrid !== null);
  const terrainRef = isLayerReady(terrainLayer)
    ? (terrainLayer.payload as ReadyTerrainRef)
    : null;
  const thermalRef = isLayerReady(thermalLayer)
    ? (thermalLayer.payload as ReadyThermalRef)
    : null;

  const terrainStatusLabel = (() => {
    if (hasRealTerrain) return 'DEM activo';
    if (terrainLayer.status === 'loading') return 'Referencia · Cargando DEM';
    if (terrainLayer.status === 'error') return 'Referencia · Error DEM';
    return 'Referencia · Sin DEM';
  })();

  const headerStatus = (() => {
    if (dataPort !== undefined) {
      return resolvedPort.integrationStage === 'connected'
        ? { tone: 'pos' as const, label: 'Datos de misión disponibles' }
        : { tone: 'warn' as const, label: 'Simulación previa · Datos en espera' };
    }
    if (packageLoader.usingFallbackTimings) {
      return { tone: 'warn' as const, label: 'Escenario no disponible · Respaldo' };
    }
    if (
      hasRealTerrain &&
      packageLoader.scenarioStatus === 'ready' &&
      packageLoader.drapedGeometry !== null
    ) {
      return { tone: 'pos' as const, label: 'Jezero DEM · Escenario simulado' };
    }
    if (
      terrainLayer.status === 'loading' ||
      packageLoader.scenarioStatus === 'loading'
    ) {
      return { tone: 'neutral' as const, label: 'Cargando paquete Jezero...' };
    }
    return { tone: 'warn' as const, label: 'Carga parcial · Revisar capas' };
  })();

  const handleFocusScience = useCallback(() => {
    setSelectedPoiId('science');
    setFocusSignal((n) => n + 1);
  }, []);

  const handleToggleThermal = useCallback(() => {
    if (!thermalRef) return;
    setThermalEnabled((prev) => !prev);
  }, [thermalRef]);

  return (
    <div className="app-shell">
      <HeaderBar
        productName={activeBaseline.productName}
        missionTitle={activeBaseline.missionTitle}
        scientificContext={activeBaseline.scientificContext}
        statusTone={headerStatus.tone}
        statusLabel={headerStatus.label}
        onResetScenario={() =>
          dispatch({ type: 'reset_scenario', baseline: activeBaseline })
        }
      />

      <main className="workspace">
        <div className="title-row">
          <div className="title-copy">
            <h1>¿Conserva otra parada la reserva de regreso?</h1>
            <p className="title-sub">
              {hasRealTerrain && packageLoader.scenarioStatus === 'ready'
                ? 'Escenario simulado sobre recorte DEM real de Jezero (HiRISE) y capa térmica THEMIS. Las posiciones, rutas y tiempos son parámetros simulados; no certifica seguridad EVA.'
                : 'Escenario simulado previo a la caminata en Jezero. Los tiempos de ruta y las posiciones son parámetros simulados del escenario.'}
            </p>
          </div>
          <div className="title-summary-note num">
            <span>{projection.route.code}</span>
            <span aria-hidden="true">·</span>
            <span>{phaseMeta.label}</span>
            <span aria-hidden="true">·</span>
            <span>Restante {state.mission.remainingMin} min</span>
          </div>
        </div>

        <div className="cockpit-grid">
          <div className="grid-slot slot-route">
            <RouteSelectorPanel
              selectedRouteId={state.selectedRouteId}
              mission={state.mission}
              baseline={activeBaseline}
              scenarioId={packageLoader.scenarioManifest?.id ?? null}
              usingFallbackTimings={
                dataPort === undefined && packageLoader.usingFallbackTimings
              }
              scenarioError={packageLoader.scenarioError}
              hasValidatedGeometry={packageLoader.drapedGeometry !== null}
              onSelectRoute={(routeId) =>
                dispatch({ type: 'select_route', routeId, baseline: activeBaseline })
              }
              onDispatchMissionEvent={(event) =>
                dispatch({ type: 'mission_event', event, baseline: activeBaseline })
              }
              onResetScenario={() =>
                dispatch({ type: 'reset_scenario', baseline: activeBaseline })
              }
              onRetryScenario={
                dataPort === undefined ? packageLoader.retryScenario : undefined
              }
            />
          </div>

          <div className="grid-slot slot-viewport">
            <OrbitalViewport
              webglStatus={state.webglStatus}
              resetSignal={state.cameraResetCount}
              focusSignal={focusSignal}
              hasOrbitedView={state.hasOrbitedView}
              reducedMotion={reducedMotion}
              hasRealTerrain={hasRealTerrain}
              terrainStatusLabel={terrainStatusLabel}
              terrainGrid={packageLoader.terrainGrid}
              terrainRef={terrainRef}
              thermalBundle={packageLoader.thermalBundle}
              thermalRef={thermalRef}
              thermalEnabled={thermalEnabled && thermalRef !== null}
              thermalOpacity={thermalOpacity}
              drapedGeometry={packageLoader.drapedGeometry}
              selectedRouteId={state.selectedRouteId}
              inspectedOptionId={state.inspectedOptionId}
              mission={state.mission}
              selectedPoiId={selectedPoiId}
              onUserOrbit={() => dispatch({ type: 'orbit_changed' })}
              onResetCamera={() => dispatch({ type: 'reset_camera' })}
              onFocusScience={handleFocusScience}
              onToggleThermal={handleToggleThermal}
              onThermalOpacityChange={setThermalOpacity}
              onSelectPoi={setSelectedPoiId}
              onWebGLUnavailable={() =>
                dispatch({ type: 'set_webgl_status', status: 'unavailable' })
              }
              onWebGLRestored={() =>
                dispatch({
                  type: 'set_webgl_status',
                  status: detectWebGLSupport() ? 'ready' : 'unavailable',
                })
              }
            />
          </div>

          <div className="grid-slot slot-comparison">
            <AutonomyComparisonPanel
              projection={projection}
              mission={state.mission}
              inspectedOptionId={state.inspectedOptionId}
              onInspectOption={(optionId) =>
                dispatch({ type: 'inspect_option', optionId })
              }
            />
          </div>

          <div className="grid-slot slot-data">
            <DataReadinessPanel
              dataPort={resolvedPort}
              terrainGrid={packageLoader.terrainGrid}
              thermalBundle={packageLoader.thermalBundle}
              scenarioManifest={packageLoader.scenarioManifest}
              thermalEnabled={thermalEnabled && thermalRef !== null}
              selectedPoiId={selectedPoiId}
              layerRetries={
                dataPort === undefined ? packageLoader.layerRetries : undefined
              }
              onToggleThermal={thermalRef ? handleToggleThermal : undefined}
              onSelectPoi={setSelectedPoiId}
              onFocusScience={
                state.webglStatus === 'ready' && hasRealTerrain
                  ? handleFocusScience
                  : undefined
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
