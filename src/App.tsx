import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  authoritativeMissionReducer,
  createAuthoritativeMissionState,
  getAuthoritativeBaseline,
  isPlaybackActivelyAnimating,
} from './app/missionPlayback.ts';
import { isLayerReady, type ReadyTerrainRef, type ReadyThermalRef, type SceneDataPort } from './data/dataSeam.ts';
import { useJezeroPackageLoader } from './data/jezeroLoader.ts';
import { buildRouteProjection, SIMULATED_MISSION_BASELINE } from './domain/scenario.ts';
import type { InspectablePoiId, TerrainSurfaceMode } from './scene/JezeroTerrainStage.tsx';
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
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function App({ dataPort }: AppProps) {
  const packageLoader = useJezeroPackageLoader(dataPort === undefined);
  const resolvedPort = dataPort ?? packageLoader.dataPort;
  const reducedMotion = usePrefersReducedMotion();

  const [controllerState, dispatch] = useReducer(
    authoritativeMissionReducer,
    undefined,
    () =>
      createAuthoritativeMissionState(
        detectWebGLSupport() ? 'ready' : 'unavailable',
        dataPort !== undefined ? 'ready' : 'loading',
        dataPort !== undefined ? SIMULATED_MISSION_BASELINE : null,
      ),
  );

  const [surfaceMode, setSurfaceMode] = useState<TerrainSurfaceMode>('illustrative');
  const [routesVisible, setRoutesVisible] = useState(true);
  const [poisVisible, setPoisVisible] = useState(true);
  const [thermalEnabled, setThermalEnabled] = useState(false);
  const [thermalOpacity, setThermalOpacity] = useState(0.75);
  const [selectedPoiId, setSelectedPoiId] = useState<InspectablePoiId>('science');
  const [focusSignal, setFocusSignal] = useState(0);

  // Sync loaded/fallback scenario config atomically without ever mixing an underway run
  useEffect(() => {
    if (dataPort !== undefined) {
      return;
    }
    dispatch({
      type: 'sync_config',
      authority: packageLoader.scenarioAuthority,
      baseline:
        packageLoader.scenarioAuthority === 'loading'
          ? null
          : packageLoader.activeBaseline,
    });
  }, [dataPort, packageLoader.scenarioAuthority, packageLoader.activeBaseline]);

  // Automatic mission playback loop completely outside R3F Canvas (runs in WebGL fallback too)
  const shouldAnimatePlayback = isPlaybackActivelyAnimating(controllerState);
  const activeGeneration = controllerState.playback.executionGeneration;
  const activePhase = controllerState.shell.mission.phase;

  useEffect(() => {
    if (!shouldAnimatePlayback) {
      return undefined;
    }

    let cancelled = false;
    let rafId = 0;
    const getNow = () =>
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    let lastTime = getNow();

    const advanceClock = (now: number) => {
      if (cancelled) return;
      const rawDt = Math.max(0, now - lastTime);
      if (rawDt <= 0) return;
      lastTime = now;
      // Cap single-step jumps (tab backgrounding / screenshot pauses) while keeping real-time cadence.
      const dtMs = Math.min(180, rawDt);
      dispatch({
        type: 'playback_tick',
        dtMs,
        reducedMotion,
        expectedGeneration: activeGeneration,
        expectedPhase: activePhase,
      });
    };

    const step = (now: number) => {
      if (cancelled) return;
      advanceClock(now);
      rafId = requestAnimationFrame(step);
    };

    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(step);
    }

    // Heartbeat ensures progress stays accurate even if rAF pauses/throttles under headless/software WebGL.
    const heartbeatMs = reducedMotion ? 16 : 36;
    const timer = window.setInterval(() => {
      const now = getNow();
      if (now - lastTime >= heartbeatMs - 4) {
        advanceClock(now);
      }
    }, heartbeatMs);

    return () => {
      cancelled = true;
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
      window.clearInterval(timer);
    };
  }, [shouldAnimatePlayback, reducedMotion, activeGeneration, activePhase]);

  const shell = controllerState.shell;
  const activeBaseline = getAuthoritativeBaseline(controllerState);
  const configPending =
    dataPort === undefined &&
    shell.mission.phase === 'planning' &&
    controllerState.configAuthority === 'loading';

  const projection = useMemo(
    () => buildRouteProjection(shell.selectedRouteId, activeBaseline),
    [shell.selectedRouteId, activeBaseline],
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
        ? { tone: 'pos' as const, label: 'Datos disponibles' }
        : { tone: 'warn' as const, label: 'Simulación previa' };
    }
    if (controllerState.configAuthority === 'fallback' || packageLoader.usingFallbackTimings) {
      return { tone: 'warn' as const, label: 'Escenario · Respaldo' };
    }
    if (
      hasRealTerrain &&
      controllerState.configAuthority === 'ready' &&
      packageLoader.drapedGeometry !== null
    ) {
      return { tone: 'pos' as const, label: 'Jezero DEM · Escenario listo' };
    }
    if (
      terrainLayer.status === 'loading' ||
      controllerState.configAuthority === 'loading'
    ) {
      return { tone: 'neutral' as const, label: 'Cargando paquete Jezero…' };
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
        initialBudgetMin={shell.mission.initialBudgetMin}
        reserveMin={shell.mission.reserveMin}
        remainingMin={shell.mission.remainingMin}
        configPending={configPending}
        statusTone={headerStatus.tone}
        statusLabel={headerStatus.label}
        onResetScenario={() => dispatch({ type: 'reset_scenario' })}
      />

      <main className="workspace">
        <div className="cockpit-grid" data-testid="cockpit-grid">
          <aside className="grid-slot slot-left-rail" aria-label="Contexto de datos">
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
                shell.webglStatus === 'ready' && hasRealTerrain
                  ? handleFocusScience
                  : undefined
              }
            />
          </aside>

          <div className="grid-slot slot-viewport">
            <OrbitalViewport
              webglStatus={shell.webglStatus}
              resetSignal={shell.cameraResetCount}
              focusSignal={focusSignal}
              hasOrbitedView={shell.hasOrbitedView}
              reducedMotion={reducedMotion}
              hasRealTerrain={hasRealTerrain}
              terrainStatusLabel={terrainStatusLabel}
              terrainGrid={packageLoader.terrainGrid}
              terrainRef={terrainRef}
              thermalBundle={packageLoader.thermalBundle}
              thermalRef={thermalRef}
              thermalEnabled={thermalEnabled && thermalRef !== null}
              thermalOpacity={thermalOpacity}
              surfaceMode={surfaceMode}
              routesVisible={routesVisible}
              poisVisible={poisVisible}
              drapedGeometry={packageLoader.drapedGeometry}
              selectedRouteId={shell.selectedRouteId}
              inspectedOptionId={shell.inspectedOptionId}
              mission={shell.mission}
              playback={controllerState.playback}
              selectedPoiId={selectedPoiId}
              onUserOrbit={() => dispatch({ type: 'orbit_changed' })}
              onResetCamera={() => dispatch({ type: 'reset_camera' })}
              onFocusScience={handleFocusScience}
              onToggleThermal={handleToggleThermal}
              onThermalOpacityChange={setThermalOpacity}
              onSurfaceModeChange={setSurfaceMode}
              onToggleRoutes={() => setRoutesVisible((v) => !v)}
              onTogglePois={() => setPoisVisible((v) => !v)}
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

          <aside className="grid-slot slot-right-dock" aria-label="Planificación y autonomía">
            <RouteSelectorPanel
              selectedRouteId={shell.selectedRouteId}
              mission={shell.mission}
              playback={controllerState.playback}
              configAuthority={
                dataPort !== undefined ? 'ready' : controllerState.configAuthority
              }
              baseline={activeBaseline}
              scenarioId={packageLoader.scenarioManifest?.id ?? null}
              usingFallbackTimings={
                dataPort === undefined &&
                controllerState.configAuthority === 'fallback' &&
                shell.mission.phase === 'planning'
              }
              scenarioError={packageLoader.scenarioError}
              hasValidatedGeometry={packageLoader.drapedGeometry !== null}
              onSelectRoute={(routeId) => dispatch({ type: 'select_route', routeId })}
              onStartSimulation={() =>
                dispatch({ type: 'start_simulation', reducedMotion })
              }
              onTogglePause={() => dispatch({ type: 'toggle_pause' })}
              onChooseBranch={(branch) =>
                dispatch({ type: 'choose_branch', branch, reducedMotion })
              }
              onResetScenario={() => dispatch({ type: 'reset_scenario' })}
              onRetryScenario={
                dataPort === undefined ? packageLoader.retryScenario : undefined
              }
            />

            <AutonomyComparisonPanel
              projection={projection}
              mission={shell.mission}
              configPending={configPending}
              inspectedOptionId={shell.inspectedOptionId}
              onInspectOption={(optionId) =>
                dispatch({ type: 'inspect_option', optionId })
              }
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;
