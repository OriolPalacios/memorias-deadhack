import {
  buildRouteProjection,
  SIMULATED_MISSION_BASELINE,
  type RouteId,
} from '../domain/scenario.ts';

interface RouteSelectorPanelProps {
  readonly selectedRouteId: RouteId;
  readonly onSelectRoute: (routeId: RouteId) => void;
}

const ROUTE_IDS: readonly RouteId[] = ['A', 'B'];

export function RouteSelectorPanel({
  selectedRouteId,
  onSelectRoute,
}: RouteSelectorPanelProps) {
  return (
    <section className="panel route-panel" aria-labelledby="route-panel-heading">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 id="route-panel-heading">Selección de ruta</h2>
          <span className="pill neutral">Simulada</span>
        </div>
        <span className="panel-meta">Escenario previo</span>
      </header>

      <fieldset className="route-fieldset">
        <legend className="sr-only">
          Elegir ruta simulada para proyectar autonomía en el punto de decisión
        </legend>

        {ROUTE_IDS.map((routeId) => {
          const projection = buildRouteProjection(routeId, SIMULATED_MISSION_BASELINE);
          const { route } = projection;
          const isSelected = selectedRouteId === routeId;

          return (
            <label
              key={route.id}
              className={`route-option${isSelected ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                className="route-radio"
                name="mission-route"
                value={route.id}
                checked={isSelected}
                onChange={() => onSelectRoute(route.id)}
              />
              <span className="route-radio-dot" aria-hidden="true" />
              <div className="route-option-body">
                <div className="route-option-head">
                  <span className="route-option-title">
                    {route.code} · {route.name}
                  </span>
                  <span className="route-total num">
                    Total base {projection.mainRouteTotalMin} min
                  </span>
                </div>
                <p className="route-option-purpose">{route.purpose}</p>
                <div className="route-legs num">
                  <span>Ida {route.outboundMin} min</span>
                  <span aria-hidden="true">·</span>
                  <span>Obs. {route.primaryObservationMin} min</span>
                  <span aria-hidden="true">·</span>
                  <span>Regreso dir. {route.directReturnMin} min</span>
                  <span aria-hidden="true">·</span>
                  <span>Disponible {projection.availableAtCheckpointMin} min</span>
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      <div className="panel-foot-action">
        <button
          type="button"
          className="btn secondary"
          disabled
          aria-describedby="start-walk-pending-reason"
        >
          Iniciar caminata en terreno
        </button>
        <p id="start-walk-pending-reason" className="disabled-reason">
          Pendiente: requiere terreno DEM y geometrías A/B preparadas (Issue #6 / #8).
          La selección actual proyecta tiempos simulados antes de salir.
        </p>
      </div>
    </section>
  );
}
