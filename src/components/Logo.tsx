interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 30 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="logo-mark"
    >
      <rect width="32" height="32" rx="9" fill="#0b1512" />
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8.25" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
      <ellipse
        cx="16"
        cy="16"
        rx="10.2"
        ry="6.1"
        transform="rotate(-26 16 16)"
        stroke="currentColor"
        strokeWidth="2.1"
      />
      <circle cx="16" cy="16" r="3.5" stroke="#eafff7" strokeOpacity="0.92" strokeWidth="1.3" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="24" cy="10" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`wordmark ${compact ? 'wordmark-compact' : ''}`}>
      <LogoMark size={compact ? 24 : 30} />
      <span className="wordmark-text" aria-label="Orbita">
        <span className="wm-orb">ORB</span>
        <span className="wm-ita">ITA</span>
      </span>
      <span className="wordmark-badge">HQ</span>
    </div>
  );
}
