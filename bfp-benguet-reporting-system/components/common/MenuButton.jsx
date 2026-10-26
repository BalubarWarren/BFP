'use client';

import { useEffect, useRef, useState } from 'react';
import menuIconAnimation from './animations/menu-icon.json';

// The hamburger used in both the sidebar's logo bar and the header (see toggleSidebar in
// app/(dashboard)/layout.jsx). The icon is a Lottie animation (animations/menu-icon.json) played
// with lottie-web: hovering plays it forward — the bars spread apart, the middle one shrinks and
// the icon tilts — and leaving plays it back. lottie-web's "light" player is used because it
// doesn't evaluate Lottie expressions (which needs eval, blocked by our CSP) and is much smaller.
export default function MenuButton({ onClick, label, className = '' }) {
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Loaded in the browser only: lottie-web touches `document` as soon as it's imported.
    import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;
      animationRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: menuIconAnimation,
      });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, []);

  const playTowards = (direction) => {
    const animation = animationRef.current;
    if (!animation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animation.setDirection(direction);
    animation.play();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => playTowards(1)}
      onMouseLeave={() => playTowards(-1)}
      onFocus={() => playTowards(1)}
      onBlur={() => playTowards(-1)}
      aria-label={label}
      title={label}
      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-200 active:scale-95 ${className}`}
    >
      {/* The animation's bars are drawn white; fill-current recolours them to the button's text
          colour, so the same file works on the dark sidebar and the light header. */}
      <span ref={containerRef} className="block h-6 w-6 [&_path]:fill-current" aria-hidden="true" />
      {/* Plain bars until the animation has loaded, so the button is never blank. */}
      {!loaded && (
        <span className="absolute flex h-6 w-6 flex-col justify-center gap-[3px] px-[3px]" aria-hidden="true">
          <span className="h-0.5 rounded-full bg-current" />
          <span className="h-0.5 rounded-full bg-current" />
          <span className="h-0.5 rounded-full bg-current" />
        </span>
      )}
    </button>
  );
}
