import type { ComponentType, SVGProps } from "react";
import {
  Bot,
  Briefcase,
  Globe,
  Home,
  Instagram,
  Link as LinkIcon,
  Mail,
  Megaphone,
  QrCode,
  Search,
  Send,
  Settings,
  Smartphone,
  Workflow,
} from "lucide-react";

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
    Icon: Home,
    migration: "done",
    isActive: (p) => p === "/dashboard",
  },
  {
    id: "wachat",
    name: "WaChat",
    href: "/wachat",
    Icon: Smartphone,
    migration: "done", // 95/95 pages on ZoruUI
    isActive: (p) => p === "/wachat" || !!p?.startsWith("/wachat/"),
  },
  {
    id: "facebook",
    name: "Meta Suite",
    href: "/dashboard/facebook/all-projects",
    Icon: Globe,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/facebook"),
  },
  {
    id: "ad-manager",
    name: "Ad Manager",
    href: "/dashboard/ad-manager/ad-accounts",
    Icon: Megaphone,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/ad-manager"),
  },
  {
    id: "sabflow",
    name: "SabFlow",
    href: "/dashboard/sabflow/flow-builder",
    Icon: Workflow,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabflow"),
  },
  {
    id: "sabchat",
    name: "SabChat",
    href: "/dashboard/sabchat",
    Icon: Bot,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/sabchat"),
  },
  {
    id: "telegram",
    name: "Telegram",
    href: "/dashboard/telegram",
    Icon: Send,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/telegram"),
  },
  {
    id: "instagram",
    name: "Instagram",
    href: "/dashboard/instagram/connections",
    Icon: Instagram,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/instagram"),
  },
  {
    id: "crm",
    name: "CRM",
    href: "/dashboard/crm",
    Icon: Briefcase,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/crm"),
  },
  {
    id: "email",
    name: "Email",
    href: "/dashboard/email",
    Icon: Mail,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/email"),
  },
  {
    id: "seo",
    name: "SEO Suite",
    href: "/dashboard/seo",
    Icon: Search,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/seo"),
  },
  {
    id: "url",
    name: "URL Shortener",
    href: "/dashboard/url-shortener",
    Icon: LinkIcon,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/url-shortener"),
  },
  {
    id: "qr",
    name: "QR Code",
    href: "/dashboard/qr-code-maker",
    Icon: QrCode,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/qr-code-maker"),
  },
  {
    id: "settings",
    name: "Settings",
    href: "/dashboard/settings",
    Icon: Settings,
    migration: "done",
    isActive: (p) => !!p?.startsWith("/dashboard/settings"),
  },
];

export const ZORU_MIGRATED_APPS = ZORU_APPS.filter(
  (app) => app.migration === "done",
);
