import orbitaMark from '../assets/orbita-mark.png';

interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 30 }: LogoMarkProps) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img src={orbitaMark} alt="" width={size} height={size} draggable={false} />
    </span>
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
