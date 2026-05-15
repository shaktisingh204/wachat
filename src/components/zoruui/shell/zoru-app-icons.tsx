import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Zoru dock-rail icon set.
 *
 * Design system:
 *  - 24×24 viewBox, rendered at 18px in the rail.
 *  - Stroke 1.75 (≈1.31px at render) — heavier than default lucide
 *    because of the 75% downscale; thinner strokes vanish.
 *  - Round caps + joins everywhere.
 *  - Optical centroid at (12, 12); shapes snapped to 0.5 grid.
 *  - Filled accent dots use r=1 with `fill="currentColor" stroke="none"`
 *    to give each icon a single hot-spot of visual weight.
 *
 * Every icon inherits `currentColor`, so they invert cleanly when the
 * rail button switches to its active (dark-tile) state.
 */

const STROKE = 1.75;

function base(props: IconProps): IconProps {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: STROKE,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    xmlns: "http://www.w3.org/2000/svg",
    ...props,
  };
}

// Roof apex (12, 3.5), base y=11, floor y=20.5. Door 4w × 6.5h, centered.
export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 11.25 12 3.75l8.5 7.5V20a.5.5 0 0 1-.5.5h-5.5V14h-5v6.5H4a.5.5 0 0 1-.5-.5v-8.75Z" />
    </svg>
  );
}

// Phone 13×19 at (5.5,2.5), rx=2.5. Speaker line. WA-style bubble inside.
export function WaChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5.5" y="2.5" width="13" height="19" rx="2.5" />
      <path d="M10.25 5h3.5" />
      <path d="M8 11.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3.25l-2.25 1.75V15.5H9a1 1 0 0 1-1-1v-3Z" />
    </svg>
  );
}

// Three QR finder squares + WhatsApp chat bubble in the fourth corner.
export function SabWaIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
      <path d="M14 14.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H17l-2 2v-2h-.5a.5.5 0 0 1-.5-.5v-4.5Z" />
    </svg>
  );
}

// Two interlocked circles — Meta infinity. r=4.25 each, centers 8 apart.
export function MetaSuiteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="12" r="4.25" />
      <circle cx="16" cy="12" r="4.25" />
    </svg>
  );
}

// Megaphone tilted up-right with sound arc + handle.
export function AdManagerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.75 10v4l13 5.25V4.75L3.75 10Z" />
      <path d="M3.75 10h-.75a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 .75.75h.75" />
      <path d="M18.5 9a3.25 3.25 0 0 1 0 6" />
      <path d="M7.75 14.75V17a2 2 0 1 0 4 0v-1.25" />
    </svg>
  );
}

// Three nodes in a downward triangle, connected by edges.
export function SabFlowIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="5.5" cy="6.5" r="2.25" />
      <circle cx="18.5" cy="6.5" r="2.25" />
      <circle cx="12" cy="18" r="2.25" />
      <path d="M7.75 6.5h8.5" />
      <path d="m7 8.5 4 7.25" />
      <path d="m17 8.5-4 7.25" />
    </svg>
  );
}

// Chat-bubble bot head with antenna dot, two eyes, mouth line.
export function SabChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.75v2" />
      <circle cx="12" cy="2.25" r="0.85" fill="currentColor" stroke="none" />
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4.75L10 19.75V17H6a2 2 0 0 1-2-2V7Z" />
      <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
      <path d="M9.75 13.75h4.5" />
    </svg>
  );
}

// Paper plane — diagonal body with fold crease.
export function TelegramIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m21.5 3-19 8.25 6.5 2.25L21.5 3Z" />
      <path d="m9 13.5 2.5 7.5L21.5 3" />
      <path d="m9 13.5 4-1.5" />
    </svg>
  );
}

// Rounded-square camera. Lens centered. Flash dot in top-right.
export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.25" cy="6.75" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Briefcase with top handle + center latch slot.
export function CrmIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.75" y="7" width="18.5" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M2.75 13h18.5" />
      <rect x="10.5" y="12" width="3" height="2" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Org chart: manager up top with two reports below, connected.
export function HrmIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5.5" r="2.25" />
      <circle cx="5.75" cy="16.5" r="2.25" />
      <circle cx="18.25" cy="16.5" r="2.25" />
      <path d="M12 7.75V11" />
      <path d="M5.75 11h12.5V14.25" />
      <path d="M5.75 11v3.25" />
    </svg>
  );
}

// Two head/shoulder silhouettes — primary + secondary.
export function TeamIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8.25" r="3" />
      <circle cx="17" cy="9.25" r="2.25" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M14.75 17.5c.3-1.85 1.85-3.25 3.75-3.25 2 0 3.65 1.55 3.9 3.55" />
    </svg>
  );
}

// Envelope.
export function EmailIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.75" y="5.5" width="18.5" height="13" rx="2" />
      <path d="m3.25 6.75 8.75 6.5 8.75-6.5" />
    </svg>
  );
}

// Chat bubble with three dots.
export function SmsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8.75L6.5 20v-3.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      <circle cx="8.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Angle brackets with diagonal slash — code snippet.
export function ApiDevIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m8 7-5 5 5 5" />
      <path d="m16 7 5 5-5 5" />
      <path d="m14 4-4 16" />
    </svg>
  );
}

// Browser window — top bar dots + content blocks.
export function WebsiteBuilderIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.75" y="4.5" width="18.5" height="15" rx="2" />
      <path d="M2.75 9h18.5" />
      <circle cx="6" cy="6.75" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="8.25" cy="6.75" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="6.75" r="0.7" fill="currentColor" stroke="none" />
      <rect x="5.75" y="11.75" width="5" height="5.75" rx="0.75" />
      <rect x="12.75" y="11.75" width="5.5" height="2.5" rx="0.5" />
      <rect x="12.75" y="15" width="5.5" height="2.5" rx="0.5" />
    </svg>
  );
}

// Magnifying glass with ascending chart bars inside.
export function SeoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m14.95 14.95 5.55 5.55" />
      <path d="M8 12.25v-2" />
      <path d="M10.5 12.25V9" />
      <path d="M13 12.25V7.25" />
    </svg>
  );
}

// Two interlocking chain links on a diagonal.
export function UrlShortenerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10.25 14a3.75 3.75 0 0 0 5.3 0l2.5-2.5a3.75 3.75 0 1 0-5.3-5.3l-1.25 1.25" />
      <path d="M13.75 10a3.75 3.75 0 0 0-5.3 0l-2.5 2.5a3.75 3.75 0 0 0 5.3 5.3l1.25-1.25" />
    </svg>
  );
}

// Full QR: three finders + scatter in bottom-right.
export function QrCodeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="18.5" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="14" y="18.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="18.5" y="18.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Folder with file content lines.
export function SabFilesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.75 7.5a2 2 0 0 1 2-2h4l2 2h8.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-14.5a2 2 0 0 1-2-2v-11Z" />
      <path d="M7 12h10" />
      <path d="M7 15h10" />
      <path d="M7 18h6" />
    </svg>
  );
}

// Cogwheel silhouette with inner hub.
export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13.25 2.75h-2.5l-.5 2.05a7.5 7.5 0 0 0-1.9.8L6.6 4.4 4.4 6.6l1.2 1.75a7.5 7.5 0 0 0-.8 1.9l-2.05.5v2.5l2.05.5c.2.68.46 1.32.8 1.9L4.4 17.4l2.2 2.2 1.75-1.2c.58.34 1.22.6 1.9.8l.5 2.05h2.5l.5-2.05a7.5 7.5 0 0 0 1.9-.8l1.75 1.2 2.2-2.2-1.2-1.75c.34-.58.6-1.22.8-1.9l2.05-.5v-2.5l-2.05-.5a7.5 7.5 0 0 0-.8-1.9l1.2-1.75-2.2-2.2-1.75 1.2a7.5 7.5 0 0 0-1.9-.8l-.5-2.05Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}
