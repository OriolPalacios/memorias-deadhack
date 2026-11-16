import type { PlaybackState } from '../app/missionPlayback.ts';
import type { ScenarioConfigAuthority } from '../data/jezeroLoader.ts';
import type { DecisionOptionId, OptionEvaluation } from '../domain/autonomy.ts';
import {
  getMissionPhaseMeta,
  getSimulatedMissionReserveOutcome,
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
  readonly playback: PlaybackState;
  readonly configAuthority: ScenarioConfigAuthority;
  readonly baseline?: MissionBaselineConstants;
  readonly scenarioId?: string | null;
  readonly usingFallbackTimings?: boolean;
  readonly scenarioError?: string | null;
  readonly hasValidatedGeometry?: boolean;
  readonly onSelectRoute: (routeId: RouteId) => void;
  readonly onStartSimulation: () => void;
  readonly onTogglePause: () => void;
  readonly onChooseBranch: (branch: DecisionOptionId) => void;
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
      return evalData.atReserveLimit ? 'límite exacto' : 'cumple reserva';
    case 'below_reserve':
      return `bajo reserva (${evalData.reserveDeficitMin ?? 'N/D'} min déficit)`;
    case 'exhausted':
      return `agotada (${evalData.reserveDeficitMin ?? 'N/D'} min déficit)`;
    case 'unknown':
      return 'sin datos suficientes';
  }
}

export function RouteSelectorPanel({
  selectedRouteId,
  mission,
  playback,
  configAuthority,
  baseline = SIMULATED_MISSION_BASELINE,
  scenarioId = null,
  usingFallbackTimings = false,
  scenarioError = null,
  hasValidatedGeometry = false,
  onSelectRoute,
  onStartSimulation,
  onTogglePause,
  onChooseBranch,
  onResetScenario,
  onRetryScenario,
}: RouteSelectorPanelProps) {
  const isRouteLocked = mission.phase !== 'planning';
  const isConfigLoading = configAuthority === 'loading';
  const activeProjection = buildRouteProjection(mission.selectedRouteId, baseline);
  const phaseMeta = getMissionPhaseMeta(
    mission.phase,
    baseline,
    mission.selectedRouteId,
  );
  const reserveOutcome = getSimulatedMissionReserveOutcome(mission);
  const phaseTone = getPhaseToneClass(mission.phase, reserveOutcome.status);

  const extraEval = activeProjection.evaluation.options.extra;
  const directEval = activeProjection.evaluation.options.direct;
  const isAnimatedLeg =
    playback.activeLeg !== 'none' &&
    (mission.phase === 'outbound' ||
      mission.phase === 'observing' ||
      mission.phase === 'extra_stop' ||
      mission.phase === 'returning');
  const legProgressPct = Math.round(
    Math.max(0, Math.min(1, playback.legProgress01)) * 100,
  );

  return (
    <section className="panel route-panel" aria-labelledby="route-panel-heading">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 id="route-panel-heading">Trayecto y decisión</h2>
          <span className="pill neutral">Simulada</span>
        </div>
        <span className="panel-meta">
          {isConfigLoading
            ? 'Cargando escenario…'
            : usingFallbackTimings
              ? 'Respaldo simulado'
              : scenarioId
                ? scenarioId
                : isRouteLocked
                  ? 'En curso'
                  : 'Listo'}
        </span>
      </header>

      {usingFallbackTimings ? (
        <div className="scenario-fallback-banner" role="alert">
          <p className="scenario-fallback-text">
            <strong>Escenario real no disponible:</strong>{' '}
            {scenarioError ?? 'Error al cargar el escenario.'} Usando tiempos de respaldo
            explícitamente simulados.
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
                    {isConfigLoading ? '…' : `${projection.mainRouteTotalMin} min`}
                  </span>
                </div>
                <div className="route-legs num">
                  <span>Ida {isConfigLoading ? '…' : route.outboundMin}</span>
                  <span aria-hidden="true">·</span>
                  <span>Obs {isConfigLoading ? '…' : route.primaryObservationMin}</span>
                  <span aria-hidden="true">·</span>
                  <span>Dir {isConfigLoading ? '…' : route.directReturnMin}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Decisión{' '}
                    {isConfigLoading
                      ? '…'
                      : `${projection.availableAtCheckpointMin} min`}
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      {isRouteLocked ? (
        <p id="route-lock-reason" className="disabled-reason">
          Ruta bloqueada durante la simulación. Usa Reiniciar a Ruta A para cambiar.
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
            <span className="mission-metric-label">Restante</span>
            <strong className="mission-metric-value" data-testid="mission-remaining-min">
              {isConfigLoading ? '…' : `${mission.remainingMin} min`}
            </strong>
          </div>
          <div className="mission-metric">
            <span className="mission-metric-label">Consumido</span>
            <strong className="mission-metric-value" data-testid="mission-consumed-min">
              {mission.consumedMin} min
            </strong>
          </div>
          <div className="mission-metric">
            <span className="mission-metric-label">Reserva</span>
            <strong className="mission-metric-value">
              {isConfigLoading ? '…' : `${mission.reserveMin} min`}
            </strong>
          </div>
        </div>

        <p className="mission-guidance">{phaseMeta.guidance}</p>

        {mission.phase === 'planning' ? (
          <div className="mission-start-wrap">
            <button
              type="button"
              className="btn primary mission-primary-btn"
              data-testid="mission-advance-btn"
              disabled={isConfigLoading}
              onClick={onStartSimulation}
            >
              {isConfigLoading
                ? 'Esperando escenario…'
                : `Iniciar simulación (${activeProjection.route.code})`}
            </button>
            {isConfigLoading ? (
              <p className="disabled-reason" data-testid="config-gate-reason">
                Validando parámetros del escenario antes de habilitar el inicio.
              </p>
            ) : null}
          </div>
        ) : null}

        {isAnimatedLeg ? (
          <div className="playback-status-box" data-testid="playback-status-box">
            <div className="playback-progress-meta num">
              <span>
                {playback.isPaused
                  ? 'Pausada (sin coste adicional)'
                  : mission.phase === 'observing'
                    ? 'Observación automática…'
                    : 'Caminata automática en curso…'}
              </span>
              <span data-testid="playback-progress-pct">{legProgressPct}%</span>
            </div>
            <div
              className="playback-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={legProgressPct}
              aria-label="Progreso del tramo simulado"
            >
              <div
                className="playback-progress-fill"
                style={{ width: `${legProgressPct}%` }}
              />
            </div>
            <button
              type="button"
              className="btn secondary mission-primary-btn"
              data-testid="playback-pause-btn"
              aria-pressed={playback.isPaused}
              onClick={onTogglePause}
            >
              {playback.isPaused ? 'Reanudar caminata' : 'Pausar'}
            </button>
          </div>
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
              onClick={() => onChooseBranch('direct')}
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
              onClick={() => onChooseBranch('extra')}
            >
              <span>Elegir parada extra simulada</span>
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
                {mission.chosenBranch === 'extra' ? 'Parada extra' : 'Regreso directo'}
              </span>
            </div>
            <p className="mission-completion-copy num">
              Balance final en {activeProjection.route.code}: {mission.remainingMin} min
              restantes tras {mission.consumedMin} min consumidos (reserva{' '}
              {mission.reserveMin} min).
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

        {mission.appliedEvents.length > 0 || mission.observations.length > 0 ? (
          <details className="mission-log-details" open={mission.phase === 'completed'}>
            <summary className="mission-log-summary num">
              Registro temporal ({mission.appliedEvents.length} hitos)
            </summary>
            {mission.observations.length > 0 ? (
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
            ) : null}
            {mission.appliedEvents.length > 0 ? (
              <ol className="mission-history-list num" data-testid="mission-history-list">
                {mission.appliedEvents.map((entry) => (
                  <li key={entry.eventId} className="mission-history-item">
                    <span>{entry.summary}</span>
                    <span className="mission-history-rem">
                      {entry.remainingAfterMin} min
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </details>
        ) : null}

        <p className="disabled-reason">
          {hasValidatedGeometry
            ? 'Tiempos, rutas y caminata son simulados; la cobertura DEM no certifica seguridad EVA.'
            : 'Simulación de fases predefinidas; no certifica seguridad para una EVA real.'}
        </p>
      </div>
    </section>
  );
}
