import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  createInitialMissionState,
  missionShellReducer,
} from './app/missionState.ts';
import {
  createPendingDataPort,
  isLayerReady,
  type SceneDataPort,
} from './data/dataSeam.ts';
import {
  buildRouteProjection,
  SIMULATED_MISSION_BASELINE,
} from './domain/scenario.ts';
import { getMissionPhaseMeta } from './domain/missionEngine.ts';
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
  const resolvedPort = useMemo(
    () => dataPort ?? createPendingDataPort(),
    [dataPort],
  );
  const reducedMotion = usePrefersReducedMotion();

  const [state, dispatch] = useReducer(
    missionShellReducer,
    undefined,
    () => createInitialMissionState(detectWebGLSupport() ? 'ready' : 'unavailable'),
  );

  const projection = useMemo(
    () => buildRouteProjection(state.selectedRouteId, SIMULATED_MISSION_BASELINE),
    [state.selectedRouteId],
  );
  const phaseMeta = getMissionPhaseMeta(state.mission.phase);

  const hasRealTerrain = isLayerReady(resolvedPort.layers.terrain_dem);
  const hasConnectedAssets = resolvedPort.integrationStage === 'connected';

  return (
    <div className="app-shell">
      <HeaderBar
        productName={SIMULATED_MISSION_BASELINE.productName}
        missionTitle={SIMULATED_MISSION_BASELINE.missionTitle}
        scientificContext={SIMULATED_MISSION_BASELINE.scientificContext}
        hasConnectedAssets={hasConnectedAssets}
        onResetScenario={() => dispatch({ type: 'reset_scenario' })}
      />

      <main className="workspace">
        <div className="title-row">
          <div className="title-copy">
            <h1>¿Conserva otra parada la reserva de regreso?</h1>
            <p className="title-sub">
              Escenario simulado previo a la caminata en Jezero. Los tiempos de
              ruta aún no derivan de terreno DEM ni de trazas reales.
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
              onSelectRoute={(routeId) => dispatch({ type: 'select_route', routeId })}
              onDispatchMissionEvent={(event) =>
                dispatch({ type: 'mission_event', event })
              }
              onResetScenario={() => dispatch({ type: 'reset_scenario' })}
            />
          </div>

          <div className="grid-slot slot-viewport">
            <OrbitalViewport
              webglStatus={state.webglStatus}
              resetSignal={state.cameraResetCount}
              hasOrbitedView={state.hasOrbitedView}
              reducedMotion={reducedMotion}
              hasRealTerrain={hasRealTerrain}
              onUserOrbit={() => dispatch({ type: 'orbit_changed' })}
              onResetCamera={() => dispatch({ type: 'reset_camera' })}
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
            <DataReadinessPanel dataPort={resolvedPort} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
