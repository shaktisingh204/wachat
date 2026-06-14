/**
 * SabChat widget configuration — the shape stored on an inbox's
 * `channelConfig.settings` and rendered by the embeddable widget.
 *
 * Pure types + defaults + a coercion helper. NO server-only imports — this
 * is shared by the studio client, server actions, and (a subset) the public
 * widget runtime. Keys are chosen so the Rust `public_config` endpoint
 * (which reads `widgetColor` / `teamName` / `welcomeMessage` / `awayMessage`
 * / `avatarUrl`) keeps working alongside the richer studio fields.
 */

export type WidgetPosition = 'lower-left' | 'lower-right';

export interface WidgetConfig {
  /** Primary theme colour — header gradient + accents (Rust reads this). */
  widgetColor: string;
  /** Send/launcher button colour. */
  buttonColor: string;
  /** Header title text colour. */
  titleColor: string;
  /** Agent / channel display name (Rust reads this). */
  teamName: string;
  /** Big greeting line, e.g. "Hi there 👋". */
  greeting: string;
  /** Header sub-line / question, e.g. "How can we help?". */
  title: string;
  /** First welcome message dropped into the thread (Rust reads this). */
  welcomeMessage: string;
  /** Out-of-hours away message (Rust reads this). */
  awayMessage: string;
  /** "Typically replies in …" reassurance line. */
  replyTime: string;
  /** Square logo URL (SabFiles). */
  logoUrl: string;
  /** Agent avatar URL (Rust reads this). */
  avatarUrl: string;
  /** Corner radius of the widget panel (px). */
  widgetRadius: number;
  /** Corner radius of buttons (px). */
  buttonRadius: number;
  /** Launcher corner. */
  position: WidgetPosition;
  bottomMargin: number;
  sideMargin: number;
  /** Notification sound key ('none' | 'chime' | 'ping' | 'pop'). */
  notificationSound: string;
}

export const NOTIFICATION_SOUNDS = ['none', 'chime', 'ping', 'pop'] as const;

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  widgetColor: '#536CDD',
  buttonColor: '#536CDD',
  titleColor: '#FFFFFF',
  teamName: 'Support',
  greeting: 'Hi there 👋',
  title: 'How can we help?',
  welcomeMessage: 'Hi! How can we help you today?',
  awayMessage: "We're away right now — leave a message and we'll get back to you.",
  replyTime: 'Typically replies in a few minutes',
  logoUrl: '',
  avatarUrl: '',
  widgetRadius: 16,
  buttonRadius: 12,
  position: 'lower-right',
  bottomMargin: 24,
  sideMargin: 24,
  notificationSound: 'chime',
};

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

/** Merge a stored `channelConfig.settings` blob over the defaults. */
export function coerceWidgetConfig(settings: Record<string, unknown> | undefined | null): WidgetConfig {
  const s = settings ?? {};
  const d = DEFAULT_WIDGET_CONFIG;
  return {
    widgetColor: str(s.widgetColor, d.widgetColor),
    buttonColor: str(s.buttonColor, d.buttonColor),
    titleColor: str(s.titleColor, d.titleColor),
    teamName: str(s.teamName, d.teamName),
    greeting: str(s.greeting, d.greeting),
    title: str(s.title, d.title),
    welcomeMessage: str(s.welcomeMessage, d.welcomeMessage),
    awayMessage: str(s.awayMessage, d.awayMessage),
    replyTime: str(s.replyTime, d.replyTime),
    logoUrl: str(s.logoUrl, d.logoUrl),
    avatarUrl: str(s.avatarUrl, d.avatarUrl),
    widgetRadius: num(s.widgetRadius, d.widgetRadius),
    buttonRadius: num(s.buttonRadius, d.buttonRadius),
    position: s.position === 'lower-left' ? 'lower-left' : 'lower-right',
    bottomMargin: num(s.bottomMargin, d.bottomMargin),
    sideMargin: num(s.sideMargin, d.sideMargin),
    notificationSound: str(s.notificationSound, d.notificationSound),
  };
}
