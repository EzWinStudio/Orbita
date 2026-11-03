import { LogoMark } from './Logo';

/**
 * Kısa açılış animasyonu. Uygulama ilk açıldığında bir kez oynar; hareket
 * azaltma tercihi açıksa CSS tarafında sadeleşir.
 */
export function SplashIntro({ leaving }: { leaving: boolean }) {
  const letters = 'ORBITA'.split('');

  return (
    <div className={`intro${leaving ? ' intro-leaving' : ''}`} role="status" aria-label="Orbita açılıyor">
      <div className="intro-aurora" aria-hidden="true" />
      <div className="intro-mark" aria-hidden="true">
        <span className="intro-ring intro-ring-1" />
        <span className="intro-ring intro-ring-2" />
        <span className="intro-glyph">
          <LogoMark size={30} />
        </span>
      </div>
      <div className="intro-word" aria-hidden="true">
        {letters.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className="intro-letter"
            style={{ animationDelay: `${320 + index * 42}ms` }}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </span>
        ))}
      </div>
      <p className="intro-tag">komuta merkezi</p>
      <div className="intro-bar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
