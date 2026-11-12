/** The SFCode mark: a cloud holding a pair of code brackets. Same art as app/icon.svg. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="sfc-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#sfc-logo-g)" />
      <path d="M19 45h27a10 10 0 0 0 1.5-19.9A13 13 0 0 0 22.6 22 11.5 11.5 0 0 0 19 45z" fill="#fff" fillOpacity=".18" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M28 29l-5 5 5 5M36 29l5 5-5 5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
