import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas } from '@react-three/fiber';
import type { PlaybackState } from '../app/missionPlayback.ts';
import type { WebGLRenderStatus } from '../app/missionState.ts';
import type { ReadyTerrainRef, ReadyThermalRef } from '../data/dataSeam.ts';
import {
  buildTerrainMeshData,
  type DrapedScenarioGeometry,
  type TerrainGridData,
} from '../data/jezeroContracts.ts';
import type { ThermalLoadedBundle } from '../data/jezeroLoader.ts';
import type { DecisionOptionId } from '../domain/autonomy.ts';
import type { SimulatedMissionState } from '../domain/missionEngine.ts';
import type { RouteId } from '../domain/scenario.ts';
import {
  JezeroTerrainStage,
  type InspectablePoiId,
  type MapOverlayLabelId,
  type TerrainSurfaceMode,
} from './JezeroTerrainStage.tsx';
import { OrbitRig } from './OrbitRig.tsx';
import {
  createTerrainCameraPreset,
  DEFAULT_ORBIT_CAMERA_POSITION,
  REFERENCE_CAMERA_PRESET,
} from './orbitDefaults.ts';
import { ReferenceStage } from './ReferenceStage.tsx';

interface CanvasErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
  readonly onError: () => void;
}

interface CanvasErrorBoundaryState {
  readonly hasError: boolean;
}

class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  public state: CanvasErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(): void {
    this.props.onError();
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface OrbitalViewportProps {
  readonly webglStatus: WebGLRenderStatus;
  readonly resetSignal: number;
  readonly focusSignal: number;
  readonly hasOrbitedView: boolean;
  readonly reducedMotion: boolean;
  readonly hasRealTerrain: boolean;
  readonly terrainStatusLabel?: string;
  readonly terrainGrid: TerrainGridData | null;
  readonly terrainRef: ReadyTerrainRef | null;
  readonly thermalBundle: ThermalLoadedBundle | null;
  readonly thermalRef: ReadyThermalRef | null;
  readonly thermalEnabled: boolean;
  readonly thermalOpacity: number;
  readonly surfaceMode: TerrainSurfaceMode;
  readonly routesVisible: boolean;
  readonly poisVisible: boolean;
  readonly drapedGeometry: DrapedScenarioGeometry | null;
  readonly selectedRouteId: RouteId;
  readonly inspectedOptionId: DecisionOptionId | null;
  readonly mission: SimulatedMissionState;
  readonly playback: PlaybackState;
  readonly selectedPoiId: InspectablePoiId;
  readonly onUserOrbit: () => void;
  readonly onResetCamera: () => void;
  readonly onFocusScience: () => void;
  readonly onToggleThermal: () => void;
  readonly onThermalOpacityChange: (value: number) => void;
  readonly onSurfaceModeChange: (mode: TerrainSurfaceMode) => void;
  readonly onToggleRoutes: () => void;
  readonly onTogglePois: () => void;
  readonly onSelectPoi: (poiId: InspectablePoiId) => void;
  readonly onWebGLUnavailable: () => void;
  readonly onWebGLRestored: () => void;
}

export function OrbitalViewport({
  webglStatus,
  resetSignal,
  focusSignal,
  hasOrbitedView,
  reducedMotion,
  hasRealTerrain,
  terrainStatusLabel,
  terrainGrid,
  terrainRef,
  thermalBundle,
  thermalRef,
  thermalEnabled,
  thermalOpacity,
  surfaceMode,
  routesVisible,
  poisVisible,
  drapedGeometry,
  selectedRouteId,
  inspectedOptionId,
  mission,
  playback,
  selectedPoiId,
  onUserOrbit,
  onResetCamera,
  onFocusScience,
  onToggleThermal,
  onThermalOpacityChange,
  onSurfaceModeChange,
  onToggleRoutes,
  onTogglePois,
  onSelectPoi,
  onWebGLUnavailable,
  onWebGLRestored,
}: OrbitalViewportProps) {
  const [layersOpen, setLayersOpen] = useState(false);
  const capasHudRef = useRef<HTMLDivElement | null>(null);
  const labelElementsRef = useRef<Partial<Record<MapOverlayLabelId, HTMLElement | null>>>({});

  const resolveLabelElement = useCallback(
    (id: MapOverlayLabelId) => labelElementsRef.current[id] ?? null,
    [],
  );

  const registerLabelRef = useCallback(
    (id: MapOverlayLabelId) => (node: HTMLElement | null) => {
      labelElementsRef.current[id] = node;
    },
    [],
  );

  useEffect(() => {
    if (!layersOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLayersOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        capasHudRef.current &&
        target instanceof Node &&
        !capasHudRef.current.contains(target)
      ) {
        setLayersOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [layersOpen]);

  const isCanvasActive = webglStatus === 'ready';
  const showRealTerrain = hasRealTerrain && terrainGrid !== null;

  const cameraPreset = useMemo(() => {
    if (!showRealTerrain || !terrainGrid) {
      return REFERENCE_CAMERA_PRESET;
    }
    const meshData = buildTerrainMeshData(terrainGrid);
    const sciencePt = drapedGeometry
      ? ([
          drapedGeometry.science.x,
          drapedGeometry.science.y,
          drapedGeometry.science.z,
        ] as const)
      : null;
    return createTerrainCameraPreset(
      terrainGrid.manifest.id,
      meshData.boundsMin,
      meshData.boundsMax,
      sciencePt,
    );
  }, [showRealTerrain, terrainGrid, drapedGeometry]);

  const canFocusScience =
    isCanvasActive && showRealTerrain && cameraPreset.focusTarget !== null;

  const pillLabel = showRealTerrain
    ? 'DEM activo'
    : (terrainStatusLabel ?? 'Referencia · Sin DEM');

  const surfaceTruthNote =
    surfaceMode === 'elevation'
      ? 'DEM real · rampa de elevación · sin ortofoto'
      : 'DEM real · material ilustrativo · sin ortofoto';

  const fallbackView = (
    <div className="webgl-fallback" role="status">
      <p className="fallback-title">
        Visor 3D no disponible en este navegador o contexto WebGL interrumpido.
      </p>
      <p className="fallback-copy">
        La selección de rutas A/B, la reproducción automática hasta la pausa de
        decisión y la inspección de fuentes, fotografía y MEDA continúan operativas.
      </p>
      <button
        type="button"
        className="btn secondary"
        onClick={onWebGLRestored}
      >
        Reintentar visor 3D
      </button>
    </div>
  );

  return (
    <section className="panel viewport-panel" aria-labelledby="viewport-heading">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 id="viewport-heading">Visor orbital 3D</h2>
          <span
            className={`pill ${showRealTerrain ? 'pos' : 'neutral'}`}
            data-testid="viewport-terrain-pill"
          >
            {pillLabel}
          </span>
        </div>

        <div className="panel-actions">
          <button
            type="button"
            className="btn secondary"
            data-testid="reset-camera-btn"
            onClick={onResetCamera}
            disabled={!isCanvasActive}
            aria-describedby={!isCanvasActive ? 'reset-view-disabled-note' : undefined}
          >
            Restablecer vista
          </button>
          <button
            type="button"
            className="btn secondary"
            data-testid="focus-science-btn"
            onClick={onFocusScience}
            disabled={!canFocusScience}
            aria-describedby={!canFocusScience ? 'focus-target-pending-reason' : undefined}
          >
            Centrar objetivo simulado
          </button>
        </div>
      </header>

      <div className="viewport-stage" data-testid="viewport-stage">
        {isCanvasActive ? (
          <CanvasErrorBoundary onError={onWebGLUnavailable} fallback={fallbackView}>
            <Canvas
              className="orbital-canvas"
              dpr={[1, 2]}
              camera={{
                position: [
                  DEFAULT_ORBIT_CAMERA_POSITION[0],
                  DEFAULT_ORBIT_CAMERA_POSITION[1],
                  DEFAULT_ORBIT_CAMERA_POSITION[2],
                ],
                fov: 42,
                near: 0.1,
                far: 100,
              }}
              gl={{ antialias: true, powerPreference: 'default' }}
              onCreated={({ gl }) => {
                const canvas = gl.domElement;
                canvas.tabIndex = 0;
                canvas.setAttribute(
                  'aria-label',
                  showRealTerrain
                    ? 'Visor orbital 3D del recorte DEM de Jezero'
                    : 'Visor orbital 3D de referencia de Jezero',
                );
                canvas.setAttribute('aria-describedby', 'viewport-keyboard-hint');
                const handleLost = (event: Event) => {
                  event.preventDefault();
                  onWebGLUnavailable();
                };
                const handleRestored = () => {
                  onWebGLRestored();
                };
                canvas.addEventListener('webglcontextlost', handleLost, false);
                canvas.addEventListener('webglcontextrestored', handleRestored, false);
              }}
            >
              {showRealTerrain && terrainGrid ? (
                <JezeroTerrainStage
                  terrainGrid={terrainGrid}
                  thermalData={thermalBundle?.decoded ?? null}
                  thermalEnabled={thermalEnabled}
                  thermalOpacity={thermalOpacity}
                  surfaceMode={surfaceMode}
                  routesVisible={routesVisible}
                  poisVisible={poisVisible}
                  drapedGeometry={drapedGeometry}
                  selectedRouteId={selectedRouteId}
                  inspectedOptionId={inspectedOptionId}
                  mission={mission}
                  playback={playback}
                  selectedPoiId={selectedPoiId}
                  reducedMotion={reducedMotion}
                  onSelectPoi={onSelectPoi}
                  resolveLabelElement={resolveLabelElement}
                />
              ) : (
                <ReferenceStage />
              )}
              <OrbitRig
                preset={cameraPreset}
                resetSignal={resetSignal}
                focusSignal={focusSignal}
                reducedMotion={reducedMotion}
                onUserOrbit={onUserOrbit}
              />
            </Canvas>
          </CanvasErrorBoundary>
        ) : (
          fallbackView
        )}

        {/* Projected 3D POI & route pill labels */}
        {isCanvasActive && showRealTerrain && drapedGeometry ? (
          <div className="map-poi-overlay" aria-label="Etiquetas sobre el mapa">
            <button
              type="button"
              ref={registerLabelRef('base')}
              className={`map-poi-label${selectedPoiId === 'base' ? ' is-selected' : ''}`}
              data-testid="map-label-base"
              onClick={() => onSelectPoi('base')}
            >
              <span className="poi-dot is-base" aria-hidden="true" />
              Base · simulada
            </button>
            <button
              type="button"
              ref={registerLabelRef('science')}
              className={`map-poi-label is-science${selectedPoiId === 'science' ? ' is-selected' : ''}`}
              data-testid="map-label-science"
              onClick={() => onSelectPoi('science')}
            >
              <span className="poi-dot is-science" aria-hidden="true" />
              Objetivo científico · posición simulada
            </button>
            <button
              type="button"
              ref={registerLabelRef('extra-stop')}
              className={`map-poi-label is-extra${selectedPoiId === 'extra-stop' ? ' is-selected' : ''}`}
              data-testid="map-label-extra-stop"
              onClick={() => onSelectPoi('extra-stop')}
            >
              <span className="poi-dot is-extra" aria-hidden="true" />
              Parada extra · simulada
            </button>

            <span
              ref={registerLabelRef('route-a')}
              className={`map-route-tag${selectedRouteId === 'A' ? ' is-active' : ''}`}
              data-testid="map-label-route-a"
            >
              Ruta A
            </span>
            <span
              ref={registerLabelRef('route-b')}
              className={`map-route-tag${selectedRouteId === 'B' ? ' is-active' : ''}`}
              data-testid="map-label-route-b"
            >
              Ruta B
            </span>
          </div>
        ) : null}

        {/* Floating top-left Capas HUD */}
        <div className="capas-hud" ref={capasHudRef}>
          <button
            type="button"
            className={`capas-trigger-btn${layersOpen ? ' is-open' : ''}`}
            data-testid="layers-toggle-btn"
            aria-expanded={layersOpen}
            aria-controls="capas-popover"
            onClick={() => setLayersOpen((open) => !open)}
          >
            Capas
          </button>

          {layersOpen ? (
            <div
              id="capas-popover"
              className="capas-popover"
              data-testid="capas-popover"
              role="region"
              aria-label="Control de capas del visor"
            >
              <div className="capas-section">
                <span className="capas-section-title">Superficie base</span>
                <div className="capas-segmented" role="group" aria-label="Modo de superficie">
                  <button
                    type="button"
                    className={`capas-seg-btn${surfaceMode === 'illustrative' ? ' is-selected' : ''}`}
                    data-testid="surface-mode-illustrative"
                    aria-pressed={surfaceMode === 'illustrative'}
                    onClick={() => onSurfaceModeChange('illustrative')}
                  >
                    Superficie ilustrativa
                  </button>
                  <button
                    type="button"
                    className={`capas-seg-btn${surfaceMode === 'elevation' ? ' is-selected' : ''}`}
                    data-testid="surface-mode-elevation"
                    aria-pressed={surfaceMode === 'elevation'}
                    onClick={() => onSurfaceModeChange('elevation')}
                  >
                    Elevación
                  </button>
                </div>
                {surfaceMode === 'elevation' && terrainRef ? (
                  <div className="capas-mini-ramp">
                    <div className="elevation-ramp-bar" aria-hidden="true" />
                    <div className="legend-scale-labels num">
                      <span>{terrainRef.minElevationM.toFixed(1)} m</span>
                      <span>{terrainRef.maxElevationM.toFixed(1)} m</span>
                    </div>
                    <span className="legend-sub-note">{terrainRef.verticalDatum}</span>
                  </div>
                ) : null}
              </div>

              <div className="capas-section">
                <div className="capas-toggle-row">
                  <span>Térmica IR (THEMIS)</span>
                  <button
                    type="button"
                    className={`capas-switch${thermalEnabled ? ' is-on' : ''}`}
                    data-testid="thermal-toggle-btn"
                    role="switch"
                    aria-checked={thermalEnabled}
                    disabled={!thermalRef}
                    onClick={onToggleThermal}
                  >
                    {thermalEnabled ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
                {thermalRef ? (
                  <>
                    <label className="thermal-slider-label num">
                      <span>Opacidad</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={thermalOpacity}
                        disabled={!thermalEnabled}
                        data-testid="thermal-opacity-slider"
                        aria-label="Opacidad de la capa térmica IR"
                        onChange={(e) => onThermalOpacityChange(Number(e.target.value))}
                      />
                      <span data-testid="thermal-opacity-value">
                        {Math.round(thermalOpacity * 100)}%
                      </span>
                    </label>
                    <div className="thermal-ramp-bar" aria-hidden="true" />
                    <div className="legend-scale-labels num">
                      <span>DN {thermalRef.lowDN}</span>
                      <span>
                        {thermalRef.minObservedDn !== null && thermalRef.maxObservedDn !== null
                          ? `Obs: ${thermalRef.minObservedDn}–${thermalRef.maxObservedDn} DN`
                          : 'Señal relativa'}
                      </span>
                      <span>DN {thermalRef.highDN}</span>
                    </div>
                    <p className="legend-sub-note" data-testid="thermal-provenance-note">
                      {`IR relativo (${thermalRef.width}×${thermalRef.height}) · ${Number(thermalRef.nativeResolutionMpp.toFixed(1))} m nativos · ${thermalRef.acquisitionContext.toLowerCase().replace(' · ', ' ')} · ${
                        thermalRef.acquisitionDatesKnown === false
                          ? 'adquisición desconocida'
                          : thermalRef.acquisitionDetail
                      }`}
                    </p>
                  </>
                ) : (
                  <p className="capas-muted-note">
                    Térmica IR no disponible; DEM y rutas permanecen activos.
                  </p>
                )}
              </div>

              <div className="capas-section">
                <div className="capas-toggle-row">
                  <span>Rutas simuladas</span>
                  <button
                    type="button"
                    className={`capas-switch${routesVisible ? ' is-on' : ''}`}
                    data-testid="toggle-routes-btn"
                    role="switch"
                    aria-checked={routesVisible}
                    onClick={onToggleRoutes}
                  >
                    {routesVisible ? 'Visible' : 'Oculta'}
                  </button>
                </div>
                <div className="capas-toggle-row">
                  <span>Puntos de interés</span>
                  <button
                    type="button"
                    className={`capas-switch${poisVisible ? ' is-on' : ''}`}
                    data-testid="toggle-pois-btn"
                    role="switch"
                    aria-checked={poisVisible}
                    onClick={onTogglePois}
                  >
                    {poisVisible ? 'Visible' : 'Oculta'}
                  </button>
                </div>
              </div>

              <div className="capas-section capas-unavailable">
                <div className="capas-disabled-row" aria-disabled="true">
                  <span>Ortoimagen</span>
                  <span className="capas-badge">No disponible</span>
                </div>
                <div className="capas-disabled-row" aria-disabled="true">
                  <span>Geología</span>
                  <span className="capas-badge">No disponible</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Bottom-left scientific truth & astronaut symbol note inside canvas */}
        {showRealTerrain ? (
          <div className="viewport-bottom-left-hud">
            <span className="hud-chip" data-testid="surface-truth-note">
              {surfaceTruthNote}
            </span>
            <span className="hud-chip" data-testid="astronaut-scale-note">
              Astronauta: símbolo ampliado
            </span>
          </div>
        ) : null}

        {/* Bottom-right compact route key & DEM span chip */}
        {showRealTerrain && terrainRef ? (
          <div className="viewport-bottom-right-hud" aria-label="Leyenda rápida de rutas">
            <span className="route-key-item">
              <span className="route-key-swatch is-active-route" />
              Activa ({selectedRouteId})
            </span>
            <span className="route-key-item">
              <span className="route-key-swatch is-alt-route" />
              Alternativa
            </span>
            <span className="route-key-item">
              <span className="route-key-swatch is-direct" />
              Directo
            </span>
            <span className="route-key-item">
              <span className="route-key-swatch is-extra" />
              Extra
            </span>
            <span className="hud-elev-span num">
              {terrainRef.minElevationM.toFixed(0)}…{terrainRef.maxElevationM.toFixed(0)} m
            </span>
          </div>
        ) : null}
      </div>

      <div className="viewport-footer">
        <div className="viewport-notes">
          <p className="viewport-caption">
            {showRealTerrain
              ? 'DEM real de Jezero (+x este, +y arriba, +z sur). Rutas, paradas y caminata simuladas; no certifica seguridad EVA.'
              : 'Escena geométrica de referencia a la espera del DTM/DEM de Jezero.'}
          </p>
          {isCanvasActive ? (
            <p id="viewport-keyboard-hint" className="viewport-kbd-hint">
              Shift+Flechas orbita · Flechas desplazan
            </p>
          ) : null}
        </div>
        <span className="viewport-state num">
          {isCanvasActive
            ? hasOrbitedView
              ? 'Vista orbitada · Restablecer disponible'
              : 'Vista orbital inicial'
            : 'Modo sin WebGL'}
        </span>
      </div>

      {!isCanvasActive && (
        <p id="reset-view-disabled-note" className="sr-only">
          Restablecer vista está deshabilitado mientras WebGL no está disponible.
        </p>
      )}
      <p id="focus-target-pending-reason" className="sr-only">
        Centrar objetivo simulado requiere terreno DEM y parada científica validados dentro del
        recorte.
      </p>
    </section>
  );
}
