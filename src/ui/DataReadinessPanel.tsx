import {
  DATA_LAYER_ORDER,
  isLayerReady,
  type DataRequirementTier,
  type SceneDataPort,
} from '../data/dataSeam.ts';

interface DataReadinessPanelProps {
  readonly dataPort: SceneDataPort;
}

function getTierLabel(tier: DataRequirementTier): string {
  switch (tier) {
    case 'required_mvp':
      return 'Obligatorio';
    case 'optional_mvp':
      return 'Opcional';
    case 'historical_context':
      return 'Contexto';
  }
}

export function DataReadinessPanel({ dataPort }: DataReadinessPanelProps) {
  const layers = DATA_LAYER_ORDER.map((id) => dataPort.layers[id]);
  const readyCount = layers.filter(isLayerReady).length;

  return (
    <section className="panel data-panel" aria-labelledby="data-panel-heading">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 id="data-panel-heading">Capas y fuentes de datos</h2>
        </div>
        <span className="pill neutral num">
          {readyCount}/{layers.length} listas
        </span>
      </header>

      <ul className="layer-list">
        {layers.map((layer) => {
          const ready = isLayerReady(layer);
          const reasonId = `layer-reason-${layer.id}`;
          return (
            <li key={layer.id} className="layer-row">
              <div className="layer-top">
                <div className="layer-head">
                  <span className="layer-title">{layer.label}</span>
                  <span className="layer-tier">{getTierLabel(layer.requirement)}</span>
                </div>
                <button
                  type="button"
                  className="layer-toggle-btn"
                  disabled={!ready}
                  aria-pressed={false}
                  aria-describedby={reasonId}
                >
                  {ready ? 'Activar' : 'Pendiente'}
                </button>
              </div>
              <p id={reasonId} className="layer-reason">
                {layer.sourceHint} · {ready ? 'Recurso validado y disponible.' : layer.unavailableReason}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="seam-note">{dataPort.adapterEntrypointNote}</p>
    </section>
  );
}
