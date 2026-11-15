interface HeaderBarProps {
  readonly productName: string;
  readonly missionTitle: string;
  readonly scientificContext: string;
  readonly statusTone: 'pos' | 'warn' | 'neutral';
  readonly statusLabel: string;
  readonly onResetScenario: () => void;
}

export function HeaderBar({
  productName,
  missionTitle,
  scientificContext,
  statusTone,
  statusLabel,
  onResetScenario,
}: HeaderBarProps) {
  return (
    <header className="topbar">
      <div className="brand-group">
        <svg
          className="brand-mark"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="34 14"
          />
          <path
            d="M6.5 14.5c2.8-3.8 8-4.5 11-2"
            stroke="#b4b4b4"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="17.5" cy="12.5" r="2.25" fill="#d4a373" />
        </svg>
        <div className="brand-copy">
          <span className="brand-name">{productName}</span>
          <span className="brand-sep" aria-hidden="true">
            ·
          </span>
          <span className="brand-mission">{missionTitle}</span>
          <span className="brand-context">{scientificContext}</span>
        </div>
      </div>

      <div className="topbar-right">
        <span className={`pill ${statusTone}`} data-testid="topbar-status-pill">
          {statusLabel}
        </span>
        <button
          type="button"
          className="btn primary"
          onClick={onResetScenario}
        >
          Reiniciar a Ruta A
        </button>
      </div>
    </header>
  );
}
