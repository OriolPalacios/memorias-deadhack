import type {
  DecisionOptionId,
  OptionAutonomyStatus,
  OptionEvaluation,
  RecommendationReasonCode,
} from '../domain/autonomy.ts';
import type { RouteProjection } from '../domain/scenario.ts';
import { ReserveComparisonChart } from './ReserveComparisonChart.tsx';

interface AutonomyComparisonPanelProps {
  readonly projection: RouteProjection;
  readonly inspectedOptionId: DecisionOptionId | null;
  readonly onInspectOption: (optionId: DecisionOptionId) => void;
}

function getStatusPillProps(evaluation: OptionEvaluation): {
  readonly label: string;
  readonly toneClass: 'pos' | 'warn' | 'neg' | 'neutral';
} {
  switch (evaluation.status) {
    case 'meets_reserve':
      return {
        label: evaluation.atReserveLimit ? 'En el límite' : 'Cumple reserva',
        toneClass: 'pos',
      };
    case 'below_reserve':
      return {
        label: 'Bajo reserva',
        toneClass: 'warn',
      };
    case 'exhausted':
      return {
        label: 'Agotada',
        toneClass: 'neg',
      };
    case 'unknown':
    default:
      return {
        label: 'Sin datos',
        toneClass: 'neutral',
      };
  }
}

function getRecommendationBadge(reasonCode: RecommendationReasonCode): {
  readonly label: string;
  readonly toneClass: 'pos' | 'warn' | 'neg';
} {
  switch (reasonCode) {
    case 'extra_meets_reserve':
      return { label: 'Recomendación: Parada extra', toneClass: 'pos' };
    case 'direct_meets_reserve':
      return { label: 'Recomendación: Regreso directo', toneClass: 'pos' };
    case 'insufficient_data':
      return { label: 'Sin recomendación: Datos insuficientes', toneClass: 'warn' };
    case 'reserve_unmet':
      return { label: 'Sin recomendación: Reserva incumplida', toneClass: 'neg' };
  }
}

function formatSignedMin(value: number | null): string {
  if (value === null) {
    return '—';
  }
  if (value > 0) {
    return `+${value} min`;
  }
  if (value < 0) {
    return `−${Math.abs(value)} min`;
  }
  return '0 min';
}

function formatMin(value: number | null): string {
  return value === null ? '—' : `${value} min`;
}

function describeRecommendationReason(
  projection: RouteProjection,
): string {
  const { evaluation, reserveMin, extraAccessAndObsMin, extraReturnToBaseMin } = projection;
  const { extra, direct } = evaluation.options;

  switch (evaluation.reasonCode) {
    case 'direct_meets_reserve': {
      const extraText =
        extra.status === 'unknown'
          ? 'La parada extra carece de coste válido completo (incertidumbre).'
          : `La parada extra (${extraAccessAndObsMin} + ${extraReturnToBaseMin} = ${extra.pendingCostMin} min) deja ${extra.projectedAtBaseMin} min previstos: déficit de ${extra.reserveDeficitMin} min respecto a la reserva de ${reserveMin} min.`;
      return `Corresponde Regreso directo (${direct.projectedAtBaseMin} min previstos en base, ${formatSignedMin(direct.reserveDeltaMin)} respecto a ${reserveMin} min). ${extraText}`;
    }
    case 'extra_meets_reserve':
      return `Corresponde Parada extra (${extra.projectedAtBaseMin} min previstos en base, ${extra.atReserveLimit ? 'en el límite exacto de' : `${formatSignedMin(extra.reserveDeltaMin)} respecto a`} la reserva de ${reserveMin} min).`;
    case 'insufficient_data':
      return 'No es posible recomendar una acción porque faltan datos válidos de autonomía para evaluar al menos una alternativa.';
    case 'reserve_unmet':
      return `Ninguna alternativa alcanza la reserva mínima de ${reserveMin} min (extra: déficit ${extra.reserveDeficitMin} min; directo: déficit ${direct.reserveDeficitMin} min).`;
  }
}

function renderStatusDescription(status: OptionAutonomyStatus): string {
  switch (status) {
    case 'meets_reserve':
      return 'Conserva o iguala el umbral mínimo de retorno.';
    case 'below_reserve':
      return 'Regresa con remanente positivo pero por debajo de la reserva objetivo.';
    case 'exhausted':
      return 'Agota la autonomía proyectada antes o al llegar a base.';
    case 'unknown':
      return 'Evaluación pendiente por ausencia o invalidez de datos.';
  }
}

export function AutonomyComparisonPanel({
  projection,
  inspectedOptionId,
  onInspectOption,
}: AutonomyComparisonPanelProps) {
  const { evaluation } = projection;
  const { extra, direct } = evaluation.options;
  const recBadge = getRecommendationBadge(evaluation.reasonCode);

  const optionRows: ReadonlyArray<{
    readonly id: DecisionOptionId;
    readonly title: string;
    readonly breakdown: string;
    readonly evalData: OptionEvaluation;
  }> = [
    {
      id: 'extra',
      title: 'Parada extra',
      breakdown: `${projection.extraAccessAndObsMin} acceso/obs. + ${projection.extraReturnToBaseMin} regreso`,
      evalData: extra,
    },
    {
      id: 'direct',
      title: 'Regreso directo',
      breakdown: `${projection.directPendingCostMin} min regreso directo`,
      evalData: direct,
    },
  ];

  const inspectedOption = inspectedOptionId
    ? optionRows.find((r) => r.id === inspectedOptionId) ?? null
    : null;

  return (
    <section className="panel comparison-panel" aria-labelledby="comparison-heading">
      <header className="panel-header">
        <div className="panel-title-group">
          <h2 id="comparison-heading">
            Proyección de autonomía · {projection.route.code}
          </h2>
          <span className="panel-meta">Punto de decisión futuro (simulado)</span>
        </div>
        <span className={`pill ${recBadge.toneClass}`}>{recBadge.label}</span>
      </header>

      {/* Explicitly separates initial 120 min, checkpoint projected 65/55 min, and target reserve 20 min */}
      <div className="kpis" role="region" aria-label="Horizontes de tiempo simulados">
        <div className="kpi">
          <div className="kpi-label">Presupuesto inicial</div>
          <div className="kpi-value num">
            {projection.initialBudgetMin} <small>min</small>
          </div>
          <div className="kpi-sub">Simulado al partir</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Disponible en decisión</div>
          <div className="kpi-value num">
            {projection.availableAtCheckpointMin ?? '—'} <small>min</small>
          </div>
          <div className="kpi-sub num">
            Proyección tras {projection.consumedBeforeDecisionMin} min (ida + obs.)
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Reserva objetivo</div>
          <div className="kpi-value num">
            {projection.reserveMin} <small>min</small>
          </div>
          <div className="kpi-sub">Mínimo exigido al volver</div>
        </div>
      </div>

      {/* Signature 20-minute return-reserve marker chart */}
      <ReserveComparisonChart
        extra={extra}
        direct={direct}
        reserveMin={projection.reserveMin}
        availableAtCheckpointMin={projection.availableAtCheckpointMin}
      />

      {/* Tabular numeric breakdown with right-aligned tabular figures */}
      <div className="table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col">Alternativa</th>
              <th scope="col" className="n">
                Coste
              </th>
              <th scope="col" className="n">
                En base
              </th>
              <th scope="col" className="n">
                Margen
              </th>
              <th scope="col" className="n">
                Déficit
              </th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {optionRows.map((row) => {
              const pill = getStatusPillProps(row.evalData);
              const isInspected = inspectedOptionId === row.id;
              return (
                <tr
                  key={row.id}
                  aria-selected={isInspected}
                  className={isInspected ? 'is-inspected' : undefined}
                >
                  <td className="cell-option">
                    <button
                      type="button"
                      className="row-inspect-btn"
                      aria-pressed={isInspected}
                      onClick={() => onInspectOption(row.id)}
                    >
                      <span className="row-option-name">{row.title}</span>
                      <span className="sub">{row.breakdown}</span>
                    </button>
                  </td>
                  <td className="n num" data-label="Coste">
                    {formatMin(row.evalData.pendingCostMin)}
                  </td>
                  <td className="n num" data-label="En base">
                    {formatMin(row.evalData.projectedAtBaseMin)}
                  </td>
                  <td className="n num" data-label="Margen">
                    {formatSignedMin(row.evalData.reserveDeltaMin)}
                  </td>
                  <td className="n num" data-label="Déficit">
                    {formatMin(row.evalData.reserveDeficitMin)}
                  </td>
                  <td className="cell-status" data-label="Estado">
                    <span className={`pill ${pill.toneClass}`}>{pill.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recommendation reason and shortfall callout */}
      <div className="recommendation-box" role="status" aria-live="polite">
        <p className="recommendation-text">
          {describeRecommendationReason(projection)}
        </p>
        {inspectedOption && (
          <p className="inspected-detail num">
            Inspección ({inspectedOption.title}):{' '}
            {projection.availableAtCheckpointMin ?? '—'} min disponibles −{' '}
            {formatMin(inspectedOption.evalData.pendingCostMin)} ={' '}
            {formatMin(inspectedOption.evalData.projectedAtBaseMin)} en base (déficit de
            presupuesto {formatMin(inspectedOption.evalData.budgetDeficitMin)}).{' '}
            {renderStatusDescription(inspectedOption.evalData.status)}
          </p>
        )}
      </div>
    </section>
  );
}
