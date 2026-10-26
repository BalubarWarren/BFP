'use client';

// The hamburger used in both the sidebar's logo bar and the header (see toggleSidebar in
// app/(dashboard)/layout.jsx). Drawn as three bars rather than an icon so they can move on hover:
// the outer bars spread apart and the middle one shrinks, with a slight tilt of the whole button.
export default function MenuButton({ onClick, label, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:-rotate-6 hover:scale-110 active:scale-95 ${className}`}
    >
      <span className="relative block h-4 w-5" aria-hidden="true">
        <span className="absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:-translate-y-0.5" />
        <span className="absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-all duration-200 group-hover:w-3" />
        <span className="absolute bottom-0 left-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:translate-y-0.5" />
      </span>
    </button>
  );
}
