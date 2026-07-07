export default function BFPCrest({ size = 56, ring = true, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Bureau of Fire Protection crest"
      className={className}
    >
      {ring && <circle cx="32" cy="32" r="31" fill="#1A2B4A" stroke="#D4AF37" strokeWidth="2" />}
      <path d="M32 12 50 19v13.5c0 12.1-7.4 19.6-18 22.5-10.6-2.9-18-10.4-18-22.5V19l18-7Z" fill="#F8FAFC" />
      <path d="M32 15.5 47 21.2v11.8c0 9.2-5.1 15.3-15 18-9.9-2.7-15-8.8-15-18V21.2l15-5.7Z" fill="#CC0000" />
      <path
        d="M34.5 45.3c5.9-1.9 9.2-6.6 8.3-11.8-.5-3.2-2.6-6.1-5.8-8.6.4 3.4-.5 5.9-2.7 7.2-1.4-4.9-4.8-8.8-9.6-11.7.9 4.8-.7 7.4-2.6 10.3-1.4 2.1-2.6 4.3-2.3 7.2.6 4.2 4.4 7.3 9.7 7.9-2.3-1.6-3.4-4.3-2.4-6.8.7-2 2.4-3.3 4-5 .2 3.2 1.4 5 3.3 6.5 1.4 1 1.5 3.1 0 4.8Z"
        fill="#D4AF37"
      />
    </svg>
  );
}
