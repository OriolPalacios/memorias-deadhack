import { Component, useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
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
import { JezeroTerrainStage, type InspectablePoiId } from './JezeroTerrainStage.tsx';
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
  readonly drapedGeometry: DrapedScenarioGeometry | null;
  readonly selectedRouteId: RouteId;
  readonly inspectedOptionId: DecisionOptionId | null;
  readonly mission: SimulatedMissionState;
  readonly selectedPoiId: InspectablePoiId;
  readonly onUserOrbit: () => void;
  readonly onResetCamera: () => void;
  readonly onFocusScience: () => void;
  readonly onToggleThermal: () => void;
  readonly onThermalOpacityChange: (value: number) => void;
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
  drapedGeometry,
  selectedRouteId,
  inspectedOptionId,
  mission,
  selectedPoiId,
  onUserOrbit,
  onResetCamera,
  onFocusScience,
  onToggleThermal,
  onThermalOpacityChange,
  onSelectPoi,
  onWebGLUnavailable,
  onWebGLRestored,
}: OrbitalViewportProps) {
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

  const fallbackView = (
    <div className="webgl-fallback" role="status">
      <p className="fallback-title">
        Visor 3D no disponible en este navegador o contexto WebGL interrumpido.
      </p>
      <p className="fallback-copy">
        La selección de rutas A/B, la reserva simulada y la inspección de fuentes,
        fotografía y datos históricos continúan operativas sin bloqueo.
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
            Centrar en Enchanted Lake
          </button>
        </div>
      </header>

      <div className="viewport-stage">
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
                  thermalObjectUrl={thermalBundle?.objectUrl ?? null}
                  thermalEnabled={thermalEnabled}
                  thermalOpacity={thermalOpacity}
                  drapedGeometry={drapedGeometry}
                  selectedRouteId={selectedRouteId}
                  inspectedOptionId={inspectedOptionId}
                  mission={mission}
                  selectedPoiId={selectedPoiId}
                  reducedMotion={reducedMotion}
                  onSelectPoi={onSelectPoi}
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
      </div>

      {/* Elevation, Thermal IR, and Route Legend Strip */}
      {showRealTerrain && terrainRef ? (
        <div className="viewport-legends" aria-label="Leyendas y capa térmica">
          <div className="legend-card">
            <div className="legend-card-head">
              <span className="legend-card-title">
                Elevación física ({terrainRef.productId})
              </span>
              <span className="legend-card-meta num">
                {terrainRef.width}×{terrainRef.height} · {terrainRef.dxM.toFixed(2)} m/celda ·
                Exag. {terrainRef.verticalExaggeration}×
              </span>
            </div>
            <div className="elevation-ramp-bar" aria-hidden="true" />
            <div className="legend-scale-labels num">
              <span>{terrainRef.minElevationM.toFixed(1)} m</span>
              <span>Datum: {terrainRef.verticalDatum}</span>
              <span>{terrainRef.maxElevationM.toFixed(1)} m</span>
            </div>
            <p className="legend-sub-note num">
              Cobertura válida: {terrainRef.validSamples.toLocaleString('es-ES')} /{' '}
              {terrainRef.totalSamples.toLocaleString('es-ES')} muestras · Ortoimagen opcional no
              incluida
            </p>
          </div>

          <div className="legend-card">
            <div className="legend-card-head">
              <span className="legend-card-title">Capa térmica IR (THEMIS)</span>
              {thermalRef ? (
                <div className="thermal-inline-controls">
                  <button
                    type="button"
                    className={`btn secondary btn-compact${thermalEnabled ? ' is-active' : ''}`}
                    data-testid="thermal-toggle-btn"
                    aria-pressed={thermalEnabled}
                    onClick={onToggleThermal}
                  >
                    {thermalEnabled ? 'Ocultar térmica' : 'Activar térmica'}
                  </button>
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
                </div>
              ) : (
                <span className="legend-card-meta">No disponible</span>
              )}
            </div>

            {thermalRef ? (
              <>
                <div className="thermal-ramp-bar" aria-hidden="true" />
                <div className="legend-scale-labels num">
                  <span>DN {thermalRef.lowDN} (menor IR)</span>
                  <span>
                    {thermalRef.minObservedDn !== null && thermalRef.maxObservedDn !== null
                      ? `Observado: ${thermalRef.minObservedDn}–${thermalRef.maxObservedDn} DN`
                      : 'Señal IR relativa'}
                  </span>
                  <span>DN {thermalRef.highDN} (mayor IR)</span>
                </div>
                <p className="legend-sub-note">
                  {thermalRef.productId} · {thermalRef.acquisitionContext} ·{' '}
                  {Math.round(thermalRef.nativeResolutionMpp)} m/píxel nativo (rejilla{' '}
                  {thermalRef.width}×{thermalRef.height}, {thermalRef.validSamples}/
                  {thermalRef.totalSamples} válidas). {thermalRef.acquisitionDetail}. Señal
                  relativa sin conversión a °C ni coste de autonomía.
                </p>
              </>
            ) : (
              <p className="legend-sub-note">
                La capa térmica no pudo validarse; el relieve DEM y la simulación permanecen
                activos.
              </p>
            )}
          </div>

          <div className="route-key-strip">
            <span className="route-key-item">
              <span className="route-key-swatch is-active-route" />
              Ruta activa ({selectedRouteId})
            </span>
            <span className="route-key-item">
              <span className="route-key-swatch is-alt-route" />
              Ruta alternativa
            </span>
            <span className="route-key-item">
              <span className="route-key-swatch is-direct" />
              Regreso directo
            </span>
            <span className="route-key-item">
              <span className="route-key-swatch is-extra" />
              Parada extra y retorno
            </span>
            <span className="route-key-item">
              <span className="route-key-swatch is-marker" />
              Marcador simulado por fase
            </span>
            <span className="route-key-caveat">
              Base, paradas, trazas y marcador son simulados (no certifica seguridad EVA).
            </span>
          </div>
        </div>
      ) : null}

      <div className="viewport-footer">
        <div className="viewport-notes">
          <p className="viewport-caption">
            {showRealTerrain
              ? 'Malla DEM real de Jezero en marco planetocéntrico este positivo (+x este, +y arriba, +z sur). Trazas y paradas simuladas.'
              : 'Escena geométrica de referencia a la espera del DTM/DEM de Jezero. Sin relieve marciano ni coordenadas métricas inventadas.'}
          </p>
          {isCanvasActive && (
            <p id="viewport-keyboard-hint" className="viewport-kbd-hint">
              Teclado sobre el visor: Shift+Flechas orbita, Flechas desplazan y Tab avanza.
            </p>
          )}
        </div>
        <span className="viewport-state num">
          {isCanvasActive
            ? hasOrbitedView
              ? 'Vista orbitada · Arrastrar, rueda o teclado · Restablecer disponible'
              : 'Vista orbital inicial · Arrastrar o Shift+Flechas para orbitar'
            : 'Modo sin WebGL'}
        </span>
      </div>

      {!isCanvasActive && (
        <p id="reset-view-disabled-note" className="sr-only">
          Restablecer vista está deshabilitado mientras WebGL no está disponible.
        </p>
      )}
      <p id="focus-target-pending-reason" className="sr-only">
        Centrar en Enchanted Lake requiere terreno DEM y parada científica validados dentro del
        recorte.
      </p>
    </section>
  );
}
