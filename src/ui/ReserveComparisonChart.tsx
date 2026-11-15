import type { OptionEvaluation } from '../domain/autonomy.ts';

interface ReserveComparisonChartProps {
  readonly extra: OptionEvaluation;
  readonly direct: OptionEvaluation;
  readonly reserveMin: number;
  readonly availableAtCheckpointMin: number | null;
}

const CHART_WIDTH = 680;
const CHART_HEIGHT = 136;
const LABEL_X = 0;
const PLOT_LEFT = 128;
const PLOT_RIGHT = 496;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;

function formatMinutesLabel(value: number | null): string {
  if (value === null) {
    return 'Sin datos';
  }
  return `${value} min`;
}

export function ReserveComparisonChart({
  extra,
  direct,
  reserveMin,
  availableAtCheckpointMin,
}: ReserveComparisonChartProps) {
  const maxVal = Math.max(
    65,
    availableAtCheckpointMin ?? 0,
    extra.projectedAtBaseMin ?? 0,
    direct.projectedAtBaseMin ?? 0,
    reserveMin + 10,
  );
  const scaleMax = Math.ceil(maxVal / 10) * 10;
  const xOf = (val: number) => {
    const clamped = Math.max(0, Math.min(scaleMax, val));
    return PLOT_LEFT + (clamped / scaleMax) * PLOT_WIDTH;
  };

  const reserveX = xOf(reserveMin);
  const gridTicks = [0, reserveMin, 40, 60].filter(
    (tick, index, arr) => tick <= scaleMax && arr.indexOf(tick) === index,
  );

  const rows: ReadonlyArray<{
    readonly key: 'extra' | 'direct';
    readonly title: string;
    readonly evaluation: OptionEvaluation;
    readonly y: number;
  }> = [
    {
      key: 'extra',
      title: 'Parada extra',
      evaluation: extra,
      y: 34,
    },
    {
      key: 'direct',
      title: 'Regreso directo',
      evaluation: direct,
      y: 78,
    },
  ];

  return (
    <div className="reserve-chart-block">
      <div className="chart-head">
        <h3>Previsto en base frente a la reserva de {reserveMin} min</h3>
        <div className="chart-legend" aria-hidden="true">
          <span className="legend-item">
            <span className="legend-swatch is-reserve" />
            Reserva {reserveMin} min
          </span>
          <span className="legend-item">
            <span className="legend-swatch is-meets" />
            Cumple
          </span>
          <span className="legend-item">
            <span className="legend-swatch is-deficit" />
            Déficit bajo reserva
          </span>
        </div>
      </div>

      <svg
        className="reserve-chart-svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-labelledby="reserve-chart-title"
      >
        <title id="reserve-chart-title">
          Comparación de autonomía prevista al volver a base frente al umbral de reserva de {reserveMin} minutos
        </title>

        {/* Reference gridlines */}
        {gridTicks.map((tick) => {
          const tx = xOf(tick);
          const isReserve = tick === reserveMin;
          return (
            <g key={tick}>
              <line
                x1={tx}
                y1={24}
                x2={tx}
                y2={112}
                stroke={isReserve ? '#d4a373' : tick === 0 ? '#444444' : '#262626'}
                strokeWidth={isReserve ? 2 : 1}
                strokeDasharray={isReserve ? '4 4' : undefined}
              />
              <text
                x={tx}
                y={128}
                textAnchor="middle"
                fill={isReserve ? '#d4a373' : '#949494'}
                fontSize="12"
                fontWeight={isReserve ? 600 : 400}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {tick} min
              </text>
            </g>
          );
        })}

        {/* Signature 20-min return-reserve marker label */}
        <text
          x={reserveX}
          y={14}
          textAnchor="middle"
          fill="#d4a373"
          fontSize="12"
          fontWeight={600}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          Reserva {reserveMin} min
        </text>

        {/* Data bars */}
        {rows.map((row) => {
          const { evaluation, title, y } = row;
          const projected = evaluation.projectedAtBaseMin;
          const barHeight = 22;
          const barMidY = y + barHeight / 2 + 4;

          const barWidth =
            projected !== null && projected > 0 ? Math.max(2, xOf(projected) - PLOT_LEFT) : 0;
          const barEndX = PLOT_LEFT + barWidth;
          const hasShortfall =
            projected !== null && evaluation.reserveDeficitMin !== null && evaluation.reserveDeficitMin > 0;
          const barFill =
            evaluation.status === 'meets_reserve'
              ? '#d4a373'
              : evaluation.status === 'below_reserve'
                ? '#6b6b6b'
                : '#444444';

          let readoutText: string;
          if (projected === null) {
            readoutText = 'Sin datos';
          } else if (evaluation.atReserveLimit) {
            readoutText = `${projected} min · en el límite`;
          } else if (evaluation.status === 'meets_reserve') {
            readoutText = `${projected} min · +${evaluation.reserveDeltaMin} min`;
          } else {
            readoutText = `${projected} min · déficit ${evaluation.reserveDeficitMin} min`;
          }

          return (
            <g key={row.key}>
              <text
                x={LABEL_X}
                y={barMidY}
                fill="#ffffff"
                fontSize="13"
                fontWeight={500}
              >
                {title}
              </text>

              {/* Background scale track */}
              <rect
                x={PLOT_LEFT}
                y={y}
                width={PLOT_WIDTH}
                height={barHeight}
                rx={3}
                fill="#1a1a1a"
              />

              {/* Projected remaining autonomy bar */}
              {barWidth > 0 && (
                <rect
                  x={PLOT_LEFT}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={3}
                  fill={barFill}
                />
              )}

              {/* Shortfall gap bracket between projected value and 20-min reserve marker */}
              {hasShortfall && (
                <g>
                  <rect
                    x={barEndX}
                    y={y}
                    width={Math.max(2, reserveX - barEndX)}
                    height={barHeight}
                    fill="#2c1a20"
                  />
                  <line
                    x1={barEndX}
                    y1={y + 1}
                    x2={reserveX}
                    y2={y + 1}
                    stroke="#e5566f"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={barEndX}
                    y1={y + barHeight - 1}
                    x2={reserveX}
                    y2={y + barHeight - 1}
                    stroke="#e5566f"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Unknown indicator */}
              {projected === null && (
                <text
                  x={PLOT_LEFT + 10}
                  y={barMidY}
                  fill="#949494"
                  fontSize="12"
                >
                  {formatMinutesLabel(null)}
                </text>
              )}

              {/* Right-aligned value + shortfall/margin readout */}
              <text
                x={PLOT_RIGHT + 14}
                y={barMidY}
                fill={hasShortfall ? '#e5566f' : '#e6e6e6'}
                fontSize="13"
                fontWeight={500}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {readoutText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
