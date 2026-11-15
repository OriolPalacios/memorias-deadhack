import type { OptionEvaluation } from '../domain/autonomy.ts';
import {
  getMissionPhaseMeta,
  getNextSimulatedStepInfo,
  getSimulatedMissionReserveOutcome,
  type MissionEvent,
  type SimulatedMissionState,
} from '../domain/missionEngine.ts';
import {
  buildRouteProjection,
  SIMULATED_MISSION_BASELINE,
  type MissionBaselineConstants,
  type RouteId,
} from '../domain/scenario.ts';

interface RouteSelectorPanelProps {
  readonly selectedRouteId: RouteId;
  readonly mission: SimulatedMissionState;
  readonly baseline?: MissionBaselineConstants;
  readonly scenarioId?: string | null;
  readonly usingFallbackTimings?: boolean;
  readonly scenarioError?: string | null;
  readonly hasValidatedGeometry?: boolean;
  readonly onSelectRoute: (routeId: RouteId) => void;
  readonly onDispatchMissionEvent: (event: MissionEvent) => void;
  readonly onResetScenario: () => void;
  readonly onRetryScenario?: () => void;
}

const ROUTE_IDS: readonly RouteId[] = ['A', 'B'];

function getPhaseToneClass(
  phase: SimulatedMissionState['phase'],
  reserveStatus: 'pending' | 'meets_reserve' | 'below_reserve',
): 'neutral' | 'pos' | 'warn' {
  if (phase === 'completed') {
    return reserveStatus === 'meets_reserve' ? 'pos' : 'warn';
  }
  if (phase === 'deciding') {
    return 'warn';
  }
  return 'neutral';
}

function formatBranchStatusSummary(evalData: OptionEvaluation): string {
  switch (evalData.status) {
    case 'meets_reserve':
      return evalData.atReserveLimit ? 'en el límite exacto de reserva' : 'cumple reserva';
    case 'below_reserve':
      return `bajo reserva, déficit ${evalData.reserveDeficitMin ?? 'N/D'} min`;
    case 'exhausted':
      return `agotada, déficit ${evalData.reserveDeficitMin ?? 'N/D'} min`;
    case 'unknown':
      return 'sin datos suficientes';
  }
}

export function RouteSelectorPanel({
  selectedRouteId,
  mission,
  baseline = SIMULATED_MISSION_BASELINE,
  scenarioId = null,
  usingFallbackTimings = false,
  scenarioError = null,
  hasValidatedGeometry = false,
  onSelectRoute,
  onDispatchMissionEvent,
  onResetScenario,
  onRetryScenario,
}: RouteSelectorPanelProps) {
  const isRouteLocked = mission.phase !== 'planning';
  const activeProjection = buildRouteProjection(mission.selectedRouteId, baseline);
  const phaseMeta = getMissionPhaseMeta(
    mission.phase,
    baseline,
    mission.selectedRouteId,
  );
  const nextStep = getNextSimulatedStepInfo(mission, baseline);
  const reserveOutcome = getSimulatedMissionReserveOutcome(mission);
  const phaseTone = getPhaseToneClass(mission.phase, reserveOutcome.status);

  const extraEval = activeProjection.evaluation.options.extra;
  const directEval = activeProjection.evaluation.options.direct;

  return (
    <section className="panel route-panel" aria-labelledby="route-panel-heading">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 id="route-panel-heading">Selección de ruta</h2>
          <span className="pill neutral">Simulada</span>
        </div>
        <span className="panel-meta">
          {usingFallbackTimings
            ? 'Tiempos de respaldo'
            : scenarioId
              ? scenarioId
              : isRouteLocked
                ? 'Ruta bloqueada en curso'
                : 'Escenario previo'}
        </span>
      </header>

      {usingFallbackTimings ? (
        <div className="scenario-fallback-banner" role="alert">
          <p className="scenario-fallback-text">
            <strong>Escenario real no disponible:</strong>{' '}
            {scenarioError ?? 'Error al cargar el paquete del escenario.'} Se utilizan
            tiempos de referencia de respaldo explícitamente simulados.
          </p>
          {onRetryScenario ? (
            <button
              type="button"
              className="btn secondary btn-compact"
              data-testid="retry-scenario-btn"
              onClick={onRetryScenario}
            >
              Reintentar escenario
            </button>
          ) : null}
        </div>
      ) : null}

      <fieldset
        className="route-fieldset"
        disabled={isRouteLocked}
        aria-describedby={isRouteLocked ? 'route-lock-reason' : undefined}
      >
        <legend className="sr-only">
          Elegir ruta simulada para proyectar autonomía en el punto de decisión
        </legend>

        {ROUTE_IDS.map((routeId) => {
          const projection = buildRouteProjection(routeId, baseline);
          const { route } = projection;
          const isSelected = selectedRouteId === routeId;

          return (
            <label
              key={route.id}
              className={`route-option${isSelected ? ' is-selected' : ''}${
                isRouteLocked ? ' is-locked' : ''
              }`}
            >
              <input
                type="radio"
                className="route-radio"
                name="mission-route"
                value={route.id}
                checked={isSelected}
                disabled={isRouteLocked}
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
                  <span>En decisión {projection.availableAtCheckpointMin} min</span>
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      {isRouteLocked ? (
        <p id="route-lock-reason" className="disabled-reason">
          Cambio de ruta bloqueado durante la simulación en curso. Usa Reiniciar a Ruta
          A para evaluar otro trayecto desde el inicio.
        </p>
      ) : null}

      <div
        className="mission-runner"
        role="region"
        aria-labelledby="mission-runner-heading"
      >
        <div className="mission-runner-head">
          <div>
            <h3 id="mission-runner-heading" className="mission-runner-title">
              Simulación de misión
            </h3>
            <span className="mission-step-caption">{phaseMeta.stepCaption}</span>
          </div>
          <span className={`pill ${phaseTone}`} data-testid="mission-phase-badge">
            {phaseMeta.label}
          </span>
        </div>

        <div className="mission-balance-strip num" aria-live="polite">
          <div className="mission-metric">
            <span className="mission-metric-label">Restante actual</span>
            <strong className="mission-metric-value" data-testid="mission-remaining-min">
              {mission.remainingMin} min
            </strong>
          </div>
          <div className="mission-metric">
            <span className="mission-metric-label">Consumido</span>
            <strong className="mission-metric-value" data-testid="mission-consumed-min">
              {mission.consumedMin} min
            </strong>
          </div>
          <div className="mission-metric">
            <span className="mission-metric-label">Reserva objetivo</span>
            <strong className="mission-metric-value">{mission.reserveMin} min</strong>
          </div>
        </div>

        <p className="mission-guidance">{phaseMeta.guidance}</p>

        {nextStep ? (
          <button
            type="button"
            className="btn primary mission-primary-btn"
            data-testid="mission-advance-btn"
            onClick={() => onDispatchMissionEvent(nextStep.event)}
          >
            {nextStep.label}
            {nextStep.costMin > 0 ? ` (-${nextStep.costMin} min)` : ''}
          </button>
        ) : null}

        {mission.phase === 'deciding' ? (
          <div
            className="mission-branch-actions"
            role="group"
            aria-label="Elección en el punto de decisión"
          >
            <button
              type="button"
              className="btn primary mission-branch-btn"
              data-testid="choose-direct-btn"
              onClick={() =>
                onDispatchMissionEvent({ type: 'choose_branch', branch: 'direct' })
              }
            >
              <span>Elegir regreso directo</span>
              <span className="mission-branch-meta num">
                -{activeProjection.directPendingCostMin} min · termina en{' '}
                {directEval.projectedAtBaseMin ?? 'N/D'} min (
                {formatBranchStatusSummary(directEval)})
              </span>
            </button>

            <button
              type="button"
              className="btn secondary mission-branch-btn"
              data-testid="choose-extra-btn"
              onClick={() =>
                onDispatchMissionEvent({ type: 'choose_branch', branch: 'extra' })
              }
            >
              <span>Elegir parada extra</span>
              <span className="mission-branch-meta num">
                -{activeProjection.extraPendingCostMin} min · termina en{' '}
                {extraEval.projectedAtBaseMin ?? 'N/D'} min (
                {formatBranchStatusSummary(extraEval)})
              </span>
            </button>
          </div>
        ) : null}

        {mission.phase === 'completed' ? (
          <div className="mission-completion-box" data-testid="mission-completed-summary">
            <div className="mission-completion-row">
              <span
                className={`pill ${
                  reserveOutcome.status === 'meets_reserve' ? 'pos' : 'warn'
                }`}
                data-testid="mission-outcome-pill"
              >
                {reserveOutcome.status === 'meets_reserve'
                  ? `Cumple reserva (+${reserveOutcome.marginMin} min margen)`
                  : `Bajo reserva (déficit ${reserveOutcome.deficitMin} min)`}
              </span>
              <span className="mission-completion-branch">
                Rama:{' '}
                {mission.chosenBranch === 'extra' ? 'Parada extra' : 'Regreso directo'}
              </span>
            </div>
            <p className="mission-completion-copy num">
              Balance final simulado en {activeProjection.route.code}:{' '}
              {mission.remainingMin} min restantes tras {mission.consumedMin} min
              consumidos frente a {mission.reserveMin} min exigidos.
            </p>
            <button
              type="button"
              className="btn secondary mission-reset-btn"
              data-testid="mission-restart-btn"
              onClick={onResetScenario}
            >
              Reiniciar simulación
            </button>
          </div>
        ) : null}

        {mission.observations.length > 0 ? (
          <div className="mission-log-block">
            <h4 className="mission-log-heading">Observaciones registradas (simuladas)</h4>
            <ul className="mission-log-list">
              {mission.observations.map((obs) => (
                <li key={obs.id} className="mission-log-item">
                  <span className="mission-log-title">
                    {obs.title} ({obs.durationMin} min)
                  </span>
                  <span className="mission-log-note">{obs.note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {mission.appliedEvents.length > 0 ? (
          <div className="mission-log-block">
            <h4 className="mission-log-heading">Progreso temporal</h4>
            <ol className="mission-history-list num" data-testid="mission-history-list">
              {mission.appliedEvents.map((entry) => (
                <li key={entry.eventId} className="mission-history-item">
                  <span>{entry.summary}</span>
                  <span className="mission-history-rem">
                    {entry.remainingAfterMin} min rest.
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <p className="disabled-reason">
          {hasValidatedGeometry
            ? 'Tiempos, rutas y marcador son parámetros simulados del escenario; la cobertura DEM verificada no certifica seguridad para una EVA real.'
            : 'Esta simulación valida exclusivamente tiempos y fases predefinidos; no certifica seguridad para una EVA real.'}
        </p>
      </div>
    </section>
  );
}
