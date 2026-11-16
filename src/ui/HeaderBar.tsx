interface HeaderBarProps {
  readonly productName: string;
  readonly missionTitle: string;
  readonly scientificContext: string;
  readonly initialBudgetMin: number;
  readonly reserveMin: number;
  readonly remainingMin: number;
  readonly configPending?: boolean;
  readonly statusTone: 'pos' | 'warn' | 'neutral';
  readonly statusLabel: string;
  readonly onResetScenario: () => void;
}

export function HeaderBar({
  productName,
  missionTitle,
  scientificContext,
  initialBudgetMin,
  reserveMin,
  remainingMin,
  configPending = false,
  statusTone,
  statusLabel,
  onResetScenario,
}: HeaderBarProps) {
  return (
    <header className="topbar">
      <div className="brand-group">
        <svg
          className="brand-mark"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="#f2f5f3"
            strokeWidth="1.5"
            strokeDasharray="34 14"
          />
          <path
            d="M6.5 14.5c2.8-3.8 8-4.5 11-2"
            stroke="#abb9bf"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="17.5" cy="12.5" r="2.25" fill="#00d9c2" />
        </svg>
        <div className="brand-copy">
          <span className="brand-name">{productName}</span>
          <span className="brand-sep" aria-hidden="true">
            ·
          </span>
          <h1 className="brand-mission">{missionTitle}</h1>
          <span className="brand-context">{scientificContext}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-telemetry num" aria-label="Resumen de autonomía simulada">
          <span className="telemetry-chip">
            Escenario: <strong>{configPending ? '…' : `${initialBudgetMin} min`}</strong>
          </span>
          <span className="telemetry-chip">
            Reserva: <strong>{configPending ? '…' : `${reserveMin} min`}</strong>
          </span>
          <span className="telemetry-chip is-balance">
            Saldo: <strong>{configPending ? '…' : `${remainingMin} min`}</strong>
          </span>
        </div>

        <span className={`pill ${statusTone}`} data-testid="topbar-status-pill">
          {statusLabel}
        </span>
        <button
          type="button"
          className="btn primary"
          data-testid="reset-scenario-btn"
          onClick={onResetScenario}
        >
          Reiniciar a Ruta A
        </button>
      </div>
    </header>
  );
}
