import { Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitRig } from './OrbitRig.tsx';
import { DEFAULT_ORBIT_CAMERA_POSITION } from './orbitDefaults.ts';
import { ReferenceStage } from './ReferenceStage.tsx';
import type { WebGLRenderStatus } from '../app/missionState.ts';

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
  readonly hasOrbitedView: boolean;
  readonly reducedMotion: boolean;
  readonly hasRealTerrain: boolean;
  readonly onUserOrbit: () => void;
  readonly onResetCamera: () => void;
  readonly onWebGLUnavailable: () => void;
  readonly onWebGLRestored: () => void;
}

export function OrbitalViewport({
  webglStatus,
  resetSignal,
  hasOrbitedView,
  reducedMotion,
  hasRealTerrain,
  onUserOrbit,
  onResetCamera,
  onWebGLUnavailable,
  onWebGLRestored,
}: OrbitalViewportProps) {
  const isCanvasActive = webglStatus === 'ready';

  const fallbackView = (
    <div className="webgl-fallback" role="status">
      <p className="fallback-title">
        Visor 3D no disponible en este navegador o contexto WebGL interrumpido.
      </p>
      <p className="fallback-copy">
        La selección de rutas A/B, la reserva simulada de 20 min y la verificación
        de fuentes continúan operativas sin bloqueo.
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
          <span className="pill neutral">
            {hasRealTerrain ? 'DEM activo' : 'Referencia · Sin DEM'}
          </span>
        </div>

        <div className="panel-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={onResetCamera}
            disabled={!isCanvasActive}
            aria-describedby={!isCanvasActive ? 'reset-view-disabled-note' : undefined}
          >
            Restablecer vista
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled
            aria-describedby="focus-target-pending-reason"
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
              <ReferenceStage />
              <OrbitRig
                resetSignal={resetSignal}
                reducedMotion={reducedMotion}
                onUserOrbit={onUserOrbit}
              />
            </Canvas>
          </CanvasErrorBoundary>
        ) : (
          fallbackView
        )}
      </div>

      <div className="viewport-footer">
        <p className="viewport-caption">
          Escena geométrica de referencia a la espera del DTM/DEM real de Jezero (Issue #6 / #8).
          Sin relieve marciano ni coordenadas métricas inventadas.
        </p>
        <span className="viewport-state num">
          {isCanvasActive
            ? hasOrbitedView
              ? 'Vista orbitada · Arrastrar/rueda · Restablecer disponible'
              : 'Vista orbital inicial · Arrastrar para orbitar'
            : 'Modo sin WebGL'}
        </span>
      </div>

      {!isCanvasActive && (
        <p id="reset-view-disabled-note" className="sr-only">
          Restablecer vista está deshabilitado mientras WebGL no está disponible.
        </p>
      )}
      <p id="focus-target-pending-reason" className="sr-only">
        Centrar en Enchanted Lake requiere ubicación georreferenciada verificada dentro del recorte DEM.
      </p>
    </section>
  );
}
