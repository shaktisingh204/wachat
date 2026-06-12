import type { ComponentType, SVGProps } from "react";
import {
  AdManagerIcon,
  ApiDevIcon,
  CrmIcon,
  EmailIcon,
  HomeIcon,
  HrmIcon,
  InstagramIcon,
  MetaSuiteIcon,
  QrCodeIcon,
  SabBiIcon,
  SabBiginIcon,
  SabBugsIcon,
  SabCampaignsIcon,
  SabCatalystIcon,
  SabChatIcon,
  SabConnectIcon,
  SabCreatorIcon,
  SabDeskIcon,
  SabFilesIcon,
  SabFlowIcon,
  SabLensIcon,
  SabMailIcon,
  SabMeetIcon,
  SabMonitorIcon,
  SabOpsIcon,
  SabPayIcon,
  SabPracticeIcon,
  SabPrepIcon,
  SabPublishIcon,
  SabRequestsIcon,
  SabRewardsIcon,
  SabSenseIcon,
  SabSheetIcon,
  SabShopIcon,
  SabShowIcon,
  SabSignIcon,
  SabSprintsIcon,
  SabTablesIcon,
  SabThriveIcon,
  SabVaultIcon,
  SabVoiceIcon,
  SabWaIcon,
  SabWebinarIcon,
  SabWorkerlyIcon,
  SettingsIcon,
  SmsIcon,
  TeamIcon,
  TelegramIcon,
  UrlShortenerIcon,
  WaChatIcon,
  WebsiteBuilderIcon,
} from "./app-icons";

export type SabAppMigrationStatus = "done" | "partial" | "pending";

/**
 * How the desktop opens an app from the dock / launchpad:
 *   - "window"   — open as a live, state-preserving desktop window (default).
 *   - "hard-nav" — a full browser navigation instead of a window. Used for
 *                  surfaces that can't (or shouldn't) live in a chromeless
 *                  iframe: SabCRM (its own outer shell) and SabSites (a
 *                  route-handler proxy, not a React page).
 */
export type SabAppRenderMode = "window" | "hard-nav";

export interface SabAppDescriptor {
  id: string;
  name: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  migration: SabAppMigrationStatus;
  isActive: (pathname: string | null) => boolean;
  /** Defaults to "window" when omitted. */
  renderMode?: SabAppRenderMode;
}

/** True when the app opens as a live desktop window (vs a hard navigation). */
export function isWindowableApp(app: SabAppDescriptor): boolean {
  return app.renderMode !== "hard-nav";
}

/**
 * Single source of truth for every dashboard app surfaced in the
 * dock and the "Migrated apps" sidebar group. Flip the `migration`
 * field as a module finishes its SabUI port — the sidebar listing
 * derives from this directly.
 */
/**
 * Modules hidden from ALL navigation per product decision (their code + routes
 * stay intact, they're just no longer surfaced).
 */
// `sabcrm` was un-hidden when it became the suite that absorbs the legacy
// `crm` module (which stays hidden until its P9 deletion).
const HIDDEN_APP_IDS = new Set(["sabwa", "crm", "hrm", "seo"]);

const SAB_APPS_ALL: SabAppDescriptor[] = [
  {
    id: "home",
    name: "Home",
    href: "/dashboard",
    Icon: HomeIcon,
    migration: "done",
    isActive: (p) => p === "/dashboard",
  },
  {
    id: "wachat",
    name: "WaChat",
    href: "/wachat",
    Icon: WaChatIcon,
    migration: "done", // 95/95 pages on SabUI
    isActive: (p) => p === "/wachat" || !!p?.startsWith("/wachat/"),
  },
  {
    id: "sabwa",
    name: "SabWa",
    href: "/sabwa",
    Icon: SabWaIcon,
    migration: "done",
    isActive: (p) => p === "/sabwa" || !!p?.startsWith("/sabwa/"),
  },
  {
    id: "facebook",
    name: "Meta Suite",
    href: "/dashboard/facebook/all-projects",
    Icon: MetaSuiteIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/facebook"),
  },
  {
    id: "ad-manager",
    name: "Ad Manager",
    href: "/dashboard/ad-manager/ad-accounts",
    Icon: AdManagerIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/ad-manager"),
  },
  {
    id: "sabflow",
    name: "SabFlow",
    href: "/dashboard/sabflow/flow-builder",
    Icon: SabFlowIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabflow"),
  },
  {
    id: "sabchat",
    name: "SabChat",
    href: "/dashboard/sabchat",
    Icon: SabChatIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabchat"),
  },
  {
    id: "telegram",
    name: "Telegram",
    // Telegram is project-scoped — the picker is the true landing page.
    // Once a project is active the overview is one click away in the
    // sidebar's Workspace group.
    href: "/dashboard/telegram/projects",
    Icon: TelegramIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/telegram"),
  },
  {
    id: "instagram",
    name: "Instagram",
    href: "/dashboard/instagram/connections",
    Icon: InstagramIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/instagram"),
  },
  {
    id: "crm",
    name: "CRM",
    href: "/dashboard/crm",
    Icon: CrmIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/crm"),
  },
  {
    id: "sabcrm",
    name: "SabCRM",
    href: "/sabcrm",
    Icon: CrmIcon,
    migration: "done",
    isActive: (p) => p === "/sabcrm" || !!p?.startsWith("/sabcrm/"),
    // SabCRM has its own outer shell (app rail, no dock) — open it as a full
    // navigation, not a chromeless desktop window.
    renderMode: "hard-nav",
  },
  {
    id: "hrm",
    name: "HRM",
    href: "/dashboard/hrm",
    Icon: HrmIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/hrm"),
  },
  {
    id: "team",
    name: "Team",
    href: "/dashboard/team/manage-users",
    Icon: TeamIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/team"),
  },
  {
    id: "email",
    name: "Email",
    href: "/dashboard/email",
    Icon: EmailIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/email"),
  },
  {
    id: "sabpay",
    name: "SabPay",
    href: "/sabpay",
    Icon: SabPayIcon,
    migration: "done",
    isActive: (p) => p === "/sabpay" || !!p?.startsWith("/sabpay/"),
  },
  {
    id: "sabsms",
    name: "SabSMS",
    href: "/sabsms",
    Icon: SmsIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/sabsms"),
  },
  {
    id: "api",
    name: "API & Dev",
    href: "/dashboard/api",
    Icon: ApiDevIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/api"),
  },
  {
    id: "url",
    name: "URL Shortener",
    href: "/dashboard/url-shortener",
    Icon: UrlShortenerIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/url-shortener"),
  },
  {
    id: "qr",
    name: "QR Code",
    href: "/dashboard/qr-code-maker",
    Icon: QrCodeIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/qr-code-maker"),
  },
  {
    id: "sabfiles",
    name: "SabFiles",
    href: "/dashboard/sabfiles",
    Icon: SabFilesIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabfiles"),
  },
  // ─── Sales / customer-experience modules ─────────────────────────────
  {
    id: "sabbigin",
    name: "SabBigin",
    href: "/dashboard/sabbigin",
    Icon: SabBiginIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabbigin"),
  },
  {
    id: "sabshop",
    name: "SabShop",
    href: "/dashboard/sabshop",
    Icon: SabShopIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabshop"),
  },
  {
    id: "sabcheckout",
    name: "SabCheckout",
    href: "/dashboard/sabcheckout",
    Icon: SabShopIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabcheckout"),
  },
  {
    id: "sabdesk",
    name: "SabDesk",
    href: "/dashboard/sabdesk",
    Icon: SabDeskIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabdesk"),
  },
  {
    id: "sabcampaigns",
    name: "SabCampaigns",
    href: "/dashboard/sabcampaigns",
    Icon: SabCampaignsIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabcampaigns"),
  },
  {
    id: "sabthrive",
    name: "SabThrive",
    href: "/dashboard/sabthrive",
    Icon: SabThriveIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabthrive"),
  },
  {
    id: "sabrewards",
    name: "SabRewards",
    href: "/dashboard/sabrewards",
    Icon: SabRewardsIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabrewards"),
  },
  // ─── Productivity & collaboration modules ────────────────────────────
  {
    id: "sabmail",
    name: "SabMail",
    href: "/dashboard/sabmail",
    Icon: SabMailIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabmail"),
  },
  {
    id: "sabmeet",
    name: "SabMeet",
    href: "/dashboard/sabmeet",
    Icon: SabMeetIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabmeet"),
  },
  {
    id: "sabvoice",
    name: "SabVoice",
    href: "/dashboard/sabvoice",
    Icon: SabVoiceIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabvoice"),
  },
  {
    id: "sabsign",
    name: "SabSign",
    href: "/dashboard/sabsign",
    Icon: SabSignIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabsign"),
  },
  {
    id: "sabwebinar",
    name: "SabWebinar",
    href: "/dashboard/sabwebinar",
    Icon: SabWebinarIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabwebinar"),
  },
  {
    id: "sabconnect",
    name: "SabConnect",
    href: "/dashboard/sabconnect",
    Icon: SabConnectIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabconnect"),
  },
  {
    id: "sabvault",
    name: "SabVault",
    href: "/dashboard/sabvault",
    Icon: SabVaultIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabvault"),
  },
  // ─── Office documents ────────────────────────────────────────────────
  {
    id: "sabsheet",
    name: "SabSheet",
    href: "/dashboard/sabsheet",
    Icon: SabSheetIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabsheet"),
  },
  {
    // SabSites — the Webstudio-powered visual website builder, mounted
    // inside this app at /sites (see src/app/sites/[[...path]]/route.ts)
    id: "website-builder",
    name: "SabSites",
    href: "/sites/dashboard",
    Icon: WebsiteBuilderIcon,
    migration: "done",
    isActive: (p) =>
      !!p?.startsWith("/sites") || !!p?.startsWith("/dashboard/website-builder"),
    // SabSites is served by a route handler (raw Response, not a React page),
    // so it can't render chromeless in a window — navigate to it instead.
    renderMode: "hard-nav",
  },
  {
    id: "sabshow",
    name: "SabShow",
    href: "/dashboard/sabshow",
    Icon: SabShowIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabshow"),
  },
  {
    id: "sabtables",
    name: "SabTables",
    href: "/dashboard/sabtables",
    Icon: SabTablesIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabtables"),
  },
  // ─── Operations / project management ─────────────────────────────────
  {
    id: "sabsprints",
    name: "SabSprints",
    href: "/dashboard/sabsprints",
    Icon: SabSprintsIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabsprints"),
  },
  {
    id: "sabbugs",
    name: "SabBugs",
    href: "/dashboard/sabbugs",
    Icon: SabBugsIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabbugs"),
  },
  {
    id: "sabrequests",
    name: "SabRequests",
    href: "/dashboard/sabrequests",
    Icon: SabRequestsIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabrequests"),
  },
  {
    id: "sabworkerly",
    name: "SabWorkerly",
    href: "/dashboard/sabworkerly",
    Icon: SabWorkerlyIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabworkerly"),
  },
  {
    id: "sabpractice",
    name: "SabPractice",
    href: "/dashboard/sabpractice",
    Icon: SabPracticeIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabpractice"),
  },
  // ─── Analytics & insights ────────────────────────────────────────────
  {
    id: "sabbi",
    name: "SabBI",
    href: "/dashboard/sabbi",
    Icon: SabBiIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabbi"),
  },
  {
    id: "sabprep",
    name: "SabPrep",
    href: "/dashboard/sabprep",
    Icon: SabPrepIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabprep"),
  },
  {
    id: "sabsense",
    name: "SabSense",
    href: "/dashboard/sabsense",
    Icon: SabSenseIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabsense"),
  },
  // ─── Developer platform ──────────────────────────────────────────────
  {
    id: "sabcreator",
    name: "SabCreator",
    href: "/dashboard/sabcreator",
    Icon: SabCreatorIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabcreator"),
  },
  {
    id: "sabcatalyst",
    name: "SabCatalyst",
    href: "/dashboard/sabcatalyst",
    Icon: SabCatalystIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabcatalyst"),
  },
  // ─── IT / ops / support ──────────────────────────────────────────────
  {
    id: "sabops",
    name: "SabOps",
    href: "/dashboard/sabops",
    Icon: SabOpsIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabops"),
  },
  {
    id: "sabmonitor",
    name: "SabMonitor",
    href: "/dashboard/sabmonitor",
    Icon: SabMonitorIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabmonitor"),
  },
  {
    id: "sablens",
    name: "SabLens",
    href: "/dashboard/sablens",
    Icon: SabLensIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sablens"),
  },
  // ─── Field / marketing ───────────────────────────────────────────────
  {
    id: "sabpublish",
    name: "SabPublish",
    href: "/dashboard/sabpublish",
    Icon: SabPublishIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabpublish"),
  },
  // Global account Settings is its own dock app. It owns ONLY
  // `/dashboard/settings/*` (profile/security/billing/etc.). Each
  // product app keeps its own settings AT that app's URL
  // (/wachat/settings/*, /dashboard/email/settings, /dashboard/crm/settings,
  // …). The two never cross — clicking "Settings" in any app's sidebar
  // goes to that app's own URL, never to /dashboard/settings.
  {
    id: "settings",
    name: "Settings",
    href: "/dashboard/settings",
    Icon: SettingsIcon,
    migration: "done",
    isActive: (p) =>
      p === "/dashboard/settings" || !!p?.startsWith("/dashboard/settings/"),
  },
];

/** The navigable app registry — hidden modules filtered out at the source. */
export const SAB_APPS: SabAppDescriptor[] = SAB_APPS_ALL.filter(
  (app) => !HIDDEN_APP_IDS.has(app.id),
);

export const SAB_MIGRATED_APPS = SAB_APPS.filter(
  (app) => app.migration === "done",
);
