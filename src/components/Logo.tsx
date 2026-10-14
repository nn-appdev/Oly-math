export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill={light ? '#F2B134' : '#0B6B63'} />
        <path d="M12 20h16M20 12v16" stroke={light ? '#06312D' : '#fff'} strokeWidth="3.2" strokeLinecap="round" />
        {!light && <circle cx="29.5" cy="10.5" r="3.2" fill="#F2B134" />}
      </svg>
      <span className={`font-display text-[22px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-teal-800'}`}>
        MathQuest <span className={`font-semibold ${light ? 'text-teal-100' : 'text-teal-600'}`}>Junior</span>
      </span>
    </span>
  );
}
