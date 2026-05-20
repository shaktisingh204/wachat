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
  SabChatIcon,
  SabFilesIcon,
  SabFlowIcon,
  SabWaIcon,
  SettingsIcon,
  SmsIcon,
  TeamIcon,
  TelegramIcon,
  UrlShortenerIcon,
  WaChatIcon,
} from "./zoru-app-icons";

export type ZoruAppMigrationStatus = "done" | "partial" | "pending";

export interface ZoruAppDescriptor {
  id: string;
  name: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  migration: ZoruAppMigrationStatus;
  isActive: (pathname: string | null) => boolean;
}

/**
 * Single source of truth for every dashboard app surfaced in the
 * dock and the "Migrated apps" sidebar group. Flip the `migration`
 * field as a module finishes its ZoruUI port — the sidebar listing
 * derives from this directly.
 */
export const ZORU_APPS: ZoruAppDescriptor[] = [
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
    migration: "done", // 95/95 pages on ZoruUI
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

export const ZORU_MIGRATED_APPS = ZORU_APPS.filter(
  (app) => app.migration === "done",
);
