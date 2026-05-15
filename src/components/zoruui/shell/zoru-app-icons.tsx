import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    xmlns: "http://www.w3.org/2000/svg",
    ...props,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.2 12 4l9 7.2V20a1.5 1.5 0 0 1-1.5 1.5h-3.5v-7h-6v7H4.5A1.5 1.5 0 0 1 3 20v-8.8Z" />
    </svg>
  );
}

export function WaChatIcon(props: IconProps) {
  // Phone with WhatsApp-style chat bubble inside — pairing UX
  return (
    <svg {...base(props)}>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M9 8.5h6" />
      <path d="M8.5 14.5a3.5 3.5 0 1 1 1.5 2.6L8 17.5l.6-1.5a3.5 3.5 0 0 1-.1-1.5Z" />
    </svg>
  );
}

export function SabWaIcon(props: IconProps) {
  // QR code with a chat bubble curling out — WhatsApp pairing
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
      <path d="M14 14.5a3.5 3.5 0 1 0 1.7 6.5l2.3.5-.6-2A3.5 3.5 0 0 0 14 14.5Z" />
    </svg>
  );
}

export function MetaSuiteIcon(props: IconProps) {
  // Interlocked loops evoking Meta's infinity mark
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="12" r="4.5" />
      <circle cx="16" cy="12" r="4.5" />
    </svg>
  );
}

export function AdManagerIcon(props: IconProps) {
  // Megaphone with sound burst
  return (
    <svg {...base(props)}>
      <path d="M4 10v4l13 5V5L4 10Z" />
      <path d="M4 10H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1" />
      <path d="M19 9a3 3 0 0 1 0 6" />
      <path d="M8 15v2.5a2 2 0 0 0 4 0v-1" />
    </svg>
  );
}

export function SabFlowIcon(props: IconProps) {
  // Three connected nodes — workflow graph
  return (
    <svg {...base(props)}>
      <circle cx="5" cy="6" r="2.2" />
      <circle cx="19" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M7 6.5h10" />
      <path d="M6.3 8 10.7 16" />
      <path d="M17.7 8 13.3 16" />
    </svg>
  );
}

export function SabChatIcon(props: IconProps) {
  // Bot head with antenna and chat bubble tail
  return (
    <svg {...base(props)}>
      <path d="M12 3v2" />
      <circle cx="12" cy="2.5" r="0.7" fill="currentColor" stroke="none" />
      <rect x="4" y="5" width="16" height="11" rx="3" />
      <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
      <path d="M10 13.5h4" />
      <path d="M9 19l3-3 3 3" />
    </svg>
  );
}

export function TelegramIcon(props: IconProps) {
  // Paper plane
  return (
    <svg {...base(props)}>
      <path d="m21 4-8 17-2.5-7L3 11l18-7Z" />
      <path d="M10.5 14 21 4" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  // Rounded square camera
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CrmIcon(props: IconProps) {
  // Briefcase with a contact card pulse
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 13h6l1.5-2 1.5 3 1.5-2H21" />
    </svg>
  );
}

export function HrmIcon(props: IconProps) {
  // Org chart: one person above, two below
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M9.5 11.5c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5" />
      <circle cx="6" cy="16" r="2" />
      <circle cx="18" cy="16" r="2" />
      <path d="M3 21c0-1.7 1.5-3 3-3s3 1.3 3 3" />
      <path d="M15 21c0-1.7 1.5-3 3-3s3 1.3 3 3" />
      <path d="M12 12v3M6 14v-2M18 14v-2" />
      <path d="M6 12h12" />
    </svg>
  );
}

export function TeamIcon(props: IconProps) {
  // Two overlapping head/shoulder silhouettes
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M14.5 18c.3-1.7 1.7-3.2 3.5-3.2 2 0 3.7 1.5 4 3.5" />
    </svg>
  );
}

export function EmailIcon(props: IconProps) {
  // Envelope
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

export function SmsIcon(props: IconProps) {
  // Speech bubble with three dots
  return (
    <svg {...base(props)}>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ApiDevIcon(props: IconProps) {
  // Code brackets with diagonal slash
  return (
    <svg {...base(props)}>
      <path d="m8 7-5 5 5 5" />
      <path d="m16 7 5 5-5 5" />
      <path d="m14 4-4 16" />
    </svg>
  );
}

export function WebsiteBuilderIcon(props: IconProps) {
  // Browser window with layout blocks
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <circle cx="6" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8.2" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
      <rect x="6" y="12" width="5" height="6" rx="0.6" />
      <rect x="13" y="12" width="5" height="2.5" rx="0.6" />
      <rect x="13" y="15.5" width="5" height="2.5" rx="0.6" />
    </svg>
  );
}

export function SeoIcon(props: IconProps) {
  // Magnifier with chart bars inside
  return (
    <svg {...base(props)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
      <path d="M8 12.5v-1.5" />
      <path d="M10.5 12.5V9" />
      <path d="M13 12.5V7.5" />
    </svg>
  );
}

export function UrlShortenerIcon(props: IconProps) {
  // Chain links
  return (
    <svg {...base(props)}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
    </svg>
  );
}

export function QrCodeIcon(props: IconProps) {
  // Three finder squares + data cells
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="18" y="14" width="3" height="2" fill="currentColor" stroke="none" />
      <rect x="14" y="18" width="2" height="3" fill="currentColor" stroke="none" />
      <rect x="19" y="17" width="2" height="4" fill="currentColor" stroke="none" />
      <rect x="17" y="19" width="4" height="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SabFilesIcon(props: IconProps) {
  // Folder with file lines inside
  return (
    <svg {...base(props)}>
      <path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
      <path d="M7 11h10" />
      <path d="M7 14h10" />
      <path d="M7 17h6" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  // Gear: outer body + inner hub + tooth marks
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </svg>
  );
}
