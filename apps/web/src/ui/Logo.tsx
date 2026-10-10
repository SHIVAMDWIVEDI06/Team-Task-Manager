export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M9 16.5l4.5 4.5L23 11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10h5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <path d="M9 22h3" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
