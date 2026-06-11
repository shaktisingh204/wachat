/**
 * SabSheet product glyph — a green spreadsheet tile (works in server and client components).
 */
export function SheetIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden focusable="false">
      <rect x="1" y="1" width="24" height="24" rx="5" fill="#188038" />
      <rect x="6" y="7" width="14" height="12" rx="1.5" fill="#ffffff" />
      <path
        d="M6 11h14M6 15h14M11 7v12"
        stroke="#188038"
        strokeWidth="1.4"
      />
    </svg>
  );
}
