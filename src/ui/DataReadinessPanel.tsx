import {
  DATA_LAYER_ORDER,
  isLayerReady,
  type DataLayerId,
  type DataLayerStatus,
  type DataRequirementTier,
  type ReadyMedaContextRef,
  type ReadySurfacePhotoRef,
  type ReadyTerrainRef,
  type ReadyThermalRef,
  type SceneDataPort,
} from '../data/dataSeam.ts';
import {
  sampleTerrainAtXz,
  sampleThermalPixelAtXz,
  type ScenarioManifestV1,
  type TerrainGridData,
} from '../data/jezeroContracts.ts';
import type { ThermalLoadedBundle } from '../data/jezeroLoader.ts';
import type { InspectablePoiId } from '../scene/JezeroTerrainStage.tsx';

interface DataReadinessPanelProps {
  readonly dataPort: SceneDataPort;
  readonly terrainGrid?: TerrainGridData | null;
  readonly thermalBundle?: ThermalLoadedBundle | null;
  readonly scenarioManifest?: ScenarioManifestV1 | null;
  readonly thermalEnabled?: boolean;
  readonly selectedPoiId?: InspectablePoiId;
  readonly layerRetries?: Readonly<Partial<Record<DataLayerId, () => void>>>;
  readonly onToggleThermal?: () => void;
  readonly onSelectPoi?: (poiId: InspectablePoiId) => void;
  readonly onFocusScience?: () => void;
}

function getTierLabel(tier: DataRequirementTier): string {
  switch (tier) {
    case 'required_mvp':
      return 'Oblig.';
    case 'optional_mvp':
      return 'Opc.';
    case 'historical_context':
      return 'Contexto';
  }
}

function getStatusPillText(status: DataLayerStatus): string {
  switch (status) {
    case 'ready':
      return 'Lista';
    case 'loading':
      return 'Cargando';
    case 'error':
      return 'Error';
    case 'unavailable':
      return 'No incl.';
    case 'awaiting_contract':
      return 'Pend.';
  }
}

function getStatusTone(status: DataLayerStatus): 'pos' | 'warn' | 'neg' | 'neutral' {
  switch (status) {
    case 'ready':
      return 'pos';
    case 'error':
      return 'neg';
    case 'loading':
      return 'warn';
    default:
      return 'neutral';
  }
}

function describeLayerDetail(id: DataLayerId, payload: unknown): string {
  switch (id) {
    case 'terrain_dem': {
      const ref = payload as ReadyTerrainRef;
      return `${ref.sourceAttribution} · ${ref.width}×${ref.height} (${ref.dxM.toFixed(2)} m) · ${ref.minElevationM.toFixed(1)} a ${ref.maxElevationM.toFixed(1)} m.`;
    }
    case 'thermal_ir': {
      const ref = payload as ReadyThermalRef;
      return `${ref.sourceAttribution} · ${ref.acquisitionContext} · ${Math.round(ref.nativeResolutionMpp)} m/px (${ref.width}×${ref.height}).`;
    }
    case 'surface_photo': {
      const ref = payload as ReadySurfacePhotoRef;
      return `${ref.title} · ${ref.capturedAt}${ref.captureSol !== null ? ` (Sol ${ref.captureSol})` : ''} · ${ref.credit}.`;
    }
    case 'meda_context': {
      const ref = payload as ReadyMedaContextRef;
      const summary = ref.variables.map((v) => `${v.name}: ${v.value} ${v.unit}`).join(' · ');
      return `${ref.siteLabel} · ${ref.observedPeriod} · ${summary}.`;
    }
    default:
      return 'Recurso validado localmente.';
  }
}

const POI_TABS: readonly {
  readonly id: InspectablePoiId;
  readonly shortLabel: string;
  readonly title: string;
  readonly roleNote: string;
}[] = [
  {
    id: 'base',
    shortLabel: 'Base',
    title: 'Base (simulada)',
    roleNote: 'Punto simulado de partida y retorno.',
  },
  {
    id: 'science',
    shortLabel: 'Científico',
    title: 'Objetivo científico (simulado)',
    roleNote: 'Parada principal simulada (control Mageik); evidencia PIA25325 sin geolocalización verificada.',
  },
  {
    id: 'extra-stop',
    shortLabel: 'Extra',
    title: 'Parada extra (simulada)',
    roleNote: 'Desvío opcional «otra parada» (control Kukaklek).',
  },
];

export function DataReadinessPanel({
  dataPort,
  terrainGrid = null,
  thermalBundle = null,
  scenarioManifest = null,
  thermalEnabled = false,
  selectedPoiId = 'science',
  layerRetries,
  onToggleThermal,
  onSelectPoi,
  onFocusScience,
}: DataReadinessPanelProps) {
  const layers = DATA_LAYER_ORDER.map((id) => dataPort.layers[id]);
  const readyCount = layers.filter(isLayerReady).length;
  const hasErrorLayer = layers.some((layer) => layer.status === 'error');

  const photoLayer = dataPort.layers.surface_photo;
  const photoRef = isLayerReady(photoLayer)
    ? (photoLayer.payload as ReadySurfacePhotoRef)
    : null;
  const medaLayer = dataPort.layers.meda_context;
  const medaRef = isLayerReady(medaLayer)
    ? (medaLayer.payload as ReadyMedaContextRef)
    : null;

  const selectedPoiCoords = (() => {
    if (!scenarioManifest) return null;
    if (selectedPoiId === 'base') {
      return {
        xzM: scenarioManifest.base.xzM,
      };
    }
    const stop = scenarioManifest.stops.find((s) => s.id === selectedPoiId);
    if (!stop) return null;
    return {
      xzM: stop.xzM,
    };
  })();

  const selectedPoiTerrainSample =
    selectedPoiCoords && terrainGrid
      ? sampleTerrainAtXz(terrainGrid, selectedPoiCoords.xzM[0], selectedPoiCoords.xzM[1])
      : null;

  const selectedPoiThermalSample =
    selectedPoiCoords && terrainGrid && thermalBundle
      ? sampleThermalPixelAtXz(
          terrainGrid.manifest.thermal.grid,
          thermalBundle.decoded.rgba,
          terrainGrid.manifest.frame,
          selectedPoiCoords.xzM[0],
          selectedPoiCoords.xzM[1],
        )
      : null;

  const selectedTabMeta =
    POI_TABS.find((t) => t.id === selectedPoiId) ?? POI_TABS[1]!;

  return (
    <section className="panel data-panel" aria-labelledby="data-panel-heading">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 id="data-panel-heading">Contexto de datos</h2>
        </div>
        <span className="pill neutral num" data-testid="layers-ready-count">
          {readyCount}/{layers.length} listas
        </span>
      </header>

      {/* Surface Photo error stays prominent when photo asset fails */}
      {photoLayer.status === 'error' ? (
        <div className="evidence-error-card" role="alert" data-testid="surface-photo-error">
          <p>
            <strong>Foto no disponible:</strong> {photoLayer.unavailableReason}
          </p>
          {layerRetries?.surface_photo ? (
            <button
              type="button"
              className="btn secondary btn-compact"
              data-testid="retry-photo-btn"
              onClick={layerRetries.surface_photo}
            >
              Reintentar fotografía
            </button>
          ) : null}
        </div>
      ) : null}

      {/* POI Inspector */}
      {scenarioManifest ? (
        <div className="poi-inspector-card" data-testid="poi-inspector-card">
          <div className="poi-inspector-head">
            <span className="poi-inspector-heading">Puntos (simulados)</span>
            <div className="poi-tabs" role="tablist" aria-label="Puntos del escenario">
              {POI_TABS.map((tab) => {
                const active = selectedPoiId === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`poi-tab-${tab.id}`}
                    className={`poi-tab-btn${active ? ' is-selected' : ''}`}
                    onClick={() => onSelectPoi?.(tab.id)}
                  >
                    {tab.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="poi-detail-body">
            <div className="poi-detail-title-row">
              <strong>{selectedTabMeta.title}</strong>
            </div>
            <p className="poi-detail-note">{selectedTabMeta.roleNote}</p>

            {selectedPoiCoords ? (
              <dl className="poi-metrics num">
                <div>
                  <dt>Escena [x, z]</dt>
                  <dd>
                    [{selectedPoiCoords.xzM[0].toFixed(1)},{' '}
                    {selectedPoiCoords.xzM[1].toFixed(1)}] m
                  </dd>
                </div>
                <div>
                  <dt>Elevación DEM</dt>
                  <dd data-testid="poi-elevation-readout">
                    {selectedPoiTerrainSample
                      ? `${selectedPoiTerrainSample.elevationM.toFixed(2)} m`
                      : 'No disponible'}
                  </dd>
                </div>
                <div>
                  <dt>IR THEMIS (DN)</dt>
                  <dd data-testid="poi-thermal-readout">
                    {selectedPoiThermalSample
                      ? selectedPoiThermalSample.alpha === 255
                        ? `DN ${selectedPoiThermalSample.dn} (relativo)`
                        : 'Sin datos IR (alfa 0)'
                      : thermalBundle
                        ? 'Fuera de cobertura'
                        : 'No disponible'}
                  </dd>
                </div>
              </dl>
            ) : null}

            {selectedPoiId === 'science' && onFocusScience && terrainGrid ? (
              <button
                type="button"
                className="btn secondary btn-compact"
                data-testid="rail-focus-science-btn"
                onClick={onFocusScience}
              >
                Centrar objetivo simulado
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Contextual Surface Photo Card */}
      {photoRef ? (
        <article className="evidence-card" data-testid="surface-photo-card">
          <div className="evidence-card-head">
            <div>
              <h3>{photoRef.title}</h3>
              <p className="evidence-meta num">
                {photoRef.capturedAt}
                {photoRef.captureSol !== null ? ` · Sol ${photoRef.captureSol}` : ''}
              </p>
            </div>
            {photoRef.sourceUrl ? (
              <a
                className="layer-source-link"
                href={photoRef.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                JPL
              </a>
            ) : null}
          </div>
          <img
            src={photoRef.objectUrl}
            alt={`Fotografía contextual ${photoRef.productId} capturada por Perseverance`}
            className="evidence-photo-img"
          />
          <p className="evidence-caveat">
            {photoRef.credit}. {photoRef.locationUnverifiedNote}; evidencia contextual, no es
            ortofoto del terreno.
          </p>
        </article>
      ) : null}

      {/* Historical MEDA Card */}
      {medaRef ? (
        <article className="meda-card" data-testid="meda-context-card">
          <div className="evidence-card-head">
            <div>
              <h3>Contexto MEDA</h3>
              <p className="evidence-meta">
                {medaRef.siteLabel} · {medaRef.observedPeriod}
              </p>
            </div>
            {medaRef.sourceUrl ? (
              <a
                className="layer-source-link"
                href={medaRef.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                JPL
              </a>
            ) : null}
          </div>
          <div className="meda-variables num">
            {medaRef.variables.map((v) => (
              <div key={v.name} className="meda-var-chip">
                <span className="meda-var-name">{v.name}</span>
                <strong className="meda-var-value">
                  {v.value} {v.unit}
                </strong>
              </div>
            ))}
          </div>
          <p className="evidence-caveat">
            {medaRef.sourceAttribution}. UTC/sol exactos no suministrados. No altera
            autonomía.
          </p>
        </article>
      ) : null}

      {/* Compact Provenance & Layers Accordion */}
      <details
        className="provenance-drawer"
        data-testid="provenance-drawer"
        open={hasErrorLayer || dataPort.integrationStage === 'skeleton_awaiting_assets'}
      >
        <summary className="provenance-summary num">
          <span>Capas y procedencia</span>
          <span>
            {readyCount}/{layers.length}
          </span>
        </summary>
        <ul className="layer-list">
          {layers.map((layer) => {
            const ready = isLayerReady(layer);
            const reasonId = `layer-reason-${layer.id}`;
            const retryFn = layerRetries?.[layer.id];
            const isThermal = layer.id === 'thermal_ir';
            const canToggleThermal = isThermal && ready && onToggleThermal !== undefined;
            const canRetry = !ready && layer.status === 'error' && retryFn !== undefined;

            return (
              <li key={layer.id} className="layer-row" data-testid={`layer-row-${layer.id}`}>
                <div className="layer-top">
                  <div className="layer-head">
                    <span className="layer-title">{layer.label}</span>
                    <span className="layer-tier">{getTierLabel(layer.requirement)}</span>
                    <span className={`pill ${getStatusTone(layer.status)}`}>
                      {getStatusPillText(layer.status)}
                    </span>
                  </div>

                  <div className="layer-actions">
                    {layer.externalUrl ? (
                      <a
                        className="layer-source-link"
                        href={layer.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Fuente
                      </a>
                    ) : null}

                    {canToggleThermal ? (
                      <button
                        type="button"
                        className="layer-toggle-btn is-interactive"
                        aria-pressed={thermalEnabled}
                        aria-describedby={reasonId}
                        onClick={onToggleThermal}
                      >
                        {thermalEnabled ? 'Ocultar' : 'Activar'}
                      </button>
                    ) : canRetry ? (
                      <button
                        type="button"
                        className="layer-toggle-btn is-retry"
                        data-testid={`retry-layer-${layer.id}`}
                        aria-describedby={reasonId}
                        onClick={retryFn}
                      >
                        Reintentar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="layer-toggle-btn"
                        disabled
                        aria-pressed={false}
                        aria-describedby={reasonId}
                      >
                        {getStatusPillText(layer.status)}
                      </button>
                    )}
                  </div>
                </div>
                <p id={reasonId} className="layer-reason">
                  {ready
                    ? describeLayerDetail(layer.id, layer.payload)
                    : `${layer.sourceHint} · ${layer.unavailableReason}`}
                </p>
              </li>
            );
          })}
        </ul>
      </details>

      <p className="seam-note">
        {readyCount === 0
          ? 'Capas en espera; autonomía usa solo tiempos simulados.'
          : 'Recursos locales verificados; rutas, paradas y caminata son simuladas.'}
      </p>
    </section>
  );
}
