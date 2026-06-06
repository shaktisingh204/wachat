"use client";

/**
 * SabNode sidebar + dock — modern multicolour light palette.
 *
 * Visual direction: white surfaces, soft zinc borders, vivid per-module
 * gradients applied to the active row, section title dot, and dock chip.
 * Each top-level module owns a hue (see `MODULE_HUE` below); rows in that
 * module's right rail tint to match. Replaces the previous "clay" palette.
 *
 *  - Left rail = every top-level module from `appIcons` in `dashboard-config.ts`.
 *  - Right rail (DetailPanel) = the active module's menu, drawn live from
 *    `dashboard-config.ts`. Width is now ~60% of the previous design.
 *  - Active module auto-detected from `usePathname()`.
 *  - Right rail collapses to icon-only mode (state persisted in localStorage).
 *  - Mobile (<lg breakpoint) opens the rail inside a shadcn Sheet drawer.
 *  - Search filter scopes to the active module.
 *  - Beta / new badges render automatically from the config; `new` is a
 *    rose→pink gradient chip, `beta` is a neutral pill.
 *  - Wachat operational pages (Numbers, Calls, Account Health, Integrations,
 *    Webhooks, General Settings, Agents & Roles, User Attributes, Canned
 *    Messages) live under Settings → "Wachat" — split via a path-prefix
 *    filter; no edits to `dashboard-config.ts` are needed.
 *
 * Live demo route at `/wachat/two-line`.
 */
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search as SearchIcon,
  User as UserIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
} from "@carbon/icons-react";
import {
  appIcons,
  wachatMenuItems,
  sabChatMenuItems,
  facebookMenuGroups,
  adManagerMenuItems,
  instagramMenuGroups,
  crmMenuGroups,
  hrmMenuGroups,
  sabflowMenuItems,
  teamMenuItems,
  emailMenuItems,
  smsMenuItems,
  apiMenuItems,
  urlShortenerMenuItems,
  qrCodeMakerMenuItems,
  seoMenuItems,
  userSettingsItems,
  sabshopMenuGroups,
  sabdeskMenuGroups,
  sabmeetMenuGroups,
  sabcheckoutMenuGroups,
  sabsprintsMenuGroups,
  sabtablesMenuGroups,
  sabcreatorMenuGroups,
  sabopsMenuGroups,
  sabwebinarMenuGroups,
  sabvaultMenuGroups,
  sabPracticeMenuGroups,
  sabsignMenuGroups,
  sabbiMenuGroups,
  type MenuItem as ConfigMenuItem,
  type MenuGroup as ConfigMenuGroup,
} from "@/config/dashboard-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Dock, DockIcon, type DockAccent } from "@/components/ui/dock";
import { useTabsOptional } from "@/components/tabs";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/sabcrm/20ui/compat';
import { ChevronRight } from "lucide-react";

const COLLAPSED_KEY = "sabnode:two-line-sidebar:collapsed";

/* ── Modern multicolour palette ─────────────────────────────────────── */
/**
 * Per-module brand hue. Tailwind class strings are listed verbatim so the
 * JIT compiler picks them up — never compose them dynamically with string
 * concatenation or they will be purged from the bundle.
 */
type ModuleHue = {
  /** Display name (debug) */
  name: string;
  /** Solid gradient (active row, dock active). */
  gradient: string;
  /** Strong text/ink colour. */
  ink: string;
  /** Muted ink for inactive labels with this hue's tint. */
  inkMuted: string;
  /** Soft tinted background (header pill, hover wash). */
  soft: string;
  /** Even softer wash (hover row, static class). */
  softer: string;
  /** Hover variant of `softer` — must be a literal Tailwind hover:* class
   *  for the JIT to pick it up (no string concatenation). */
  hoverSoft: string;
  /** Ring colour for focus / active outlines. */
  ring: string;
  /** Section-title colour. */
  titleInk: string;
};

const MODULE_HUE: Record<string, ModuleHue> = {
  whatsapp:        { name: "emerald",  gradient: "from-zoru-ink to-zoru-ink",   ink: "text-zoru-ink",  inkMuted: "text-zoru-ink/70",  soft: "bg-zoru-surface-2",   softer: "bg-zoru-surface-2/60",   hoverSoft: "hover:bg-zoru-surface-2",  ring: "ring-zoru-line/70",  titleInk: "text-zoru-ink/80" },
  sabchat:         { name: "sky",      gradient: "from-zoru-ink to-zoru-ink",       ink: "text-zoru-ink",      inkMuted: "text-zoru-ink/70",      soft: "bg-zoru-surface-2",       softer: "bg-zoru-surface-2/60",       hoverSoft: "hover:bg-zoru-surface-2",      ring: "ring-zoru-line/70",      titleInk: "text-zoru-ink/80" },
  facebook:        { name: "blue",     gradient: "from-zoru-ink to-zoru-ink",    ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  "ad-manager":    { name: "indigo",   gradient: "from-zoru-ink to-zoru-ink",  ink: "text-zoru-ink",   inkMuted: "text-zoru-ink/70",   soft: "bg-zoru-surface-2",    softer: "bg-zoru-surface-2/60",    hoverSoft: "hover:bg-zoru-surface-2",   ring: "ring-zoru-line/70",   titleInk: "text-zoru-ink/80" },
  telegram:        { name: "cyan",     gradient: "from-zoru-ink to-zoru-ink",       ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  instagram:       { name: "pink",     gradient: "from-zoru-ink to-zoru-ink",   ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  crm:             { name: "violet",   gradient: "from-zoru-ink to-zoru-ink",  ink: "text-zoru-ink",   inkMuted: "text-zoru-ink/70",   soft: "bg-zoru-surface-2",    softer: "bg-zoru-surface-2/60",    hoverSoft: "hover:bg-zoru-surface-2",   ring: "ring-zoru-line/70",   titleInk: "text-zoru-ink/80" },
  hrm:             { name: "rose",     gradient: "from-zoru-ink to-zoru-ink",       ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabflow:         { name: "lime",     gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",    inkMuted: "text-zoru-ink/70",    soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  team:            { name: "indigo",   gradient: "from-zoru-ink to-zoru-ink",    ink: "text-zoru-ink",   inkMuted: "text-zoru-ink/70",   soft: "bg-zoru-surface-2",    softer: "bg-zoru-surface-2/60",    hoverSoft: "hover:bg-zoru-surface-2",   ring: "ring-zoru-line/70",   titleInk: "text-zoru-ink/80" },
  email:           { name: "sky",      gradient: "from-zoru-ink to-zoru-ink",       ink: "text-zoru-ink",      inkMuted: "text-zoru-ink/70",      soft: "bg-zoru-surface-2",       softer: "bg-zoru-surface-2/60",       hoverSoft: "hover:bg-zoru-surface-2",      ring: "ring-zoru-line/70",      titleInk: "text-zoru-ink/80" },
  sms:             { name: "green",    gradient: "from-zoru-ink to-zoru-ink",  ink: "text-zoru-ink",    inkMuted: "text-zoru-ink/70",    soft: "bg-zoru-surface-2",     softer: "bg-zoru-surface-2/60",     hoverSoft: "hover:bg-zoru-surface-2",    ring: "ring-zoru-line/70",    titleInk: "text-zoru-ink/80" },
  api:             { name: "slate",    gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",    inkMuted: "text-zoru-ink/70",    soft: "bg-zoru-surface-2",    softer: "bg-zoru-surface-2/60",    hoverSoft: "hover:bg-zoru-surface-2",   ring: "ring-zoru-line/70",    titleInk: "text-zoru-ink/80" },
  "website-builder": { name: "teal",   gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  "url-shortener": { name: "purple",   gradient: "from-zoru-ink to-zoru-ink", ink: "text-zoru-ink",   inkMuted: "text-zoru-ink/70",   soft: "bg-zoru-surface-2",    softer: "bg-zoru-surface-2/60",    hoverSoft: "hover:bg-zoru-surface-2",   ring: "ring-zoru-line/70",   titleInk: "text-zoru-ink/80" },
  "qr-code-maker": { name: "fuchsia",  gradient: "from-zoru-ink to-zoru-ink",   ink: "text-zoru-ink",  inkMuted: "text-zoru-ink/70",  soft: "bg-zoru-surface-2",   softer: "bg-zoru-surface-2/60",   hoverSoft: "hover:bg-zoru-surface-2",  ring: "ring-zoru-line/70",  titleInk: "text-zoru-ink/80" },
  "seo-suite":     { name: "blue",     gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabshop:         { name: "orange",   gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabwebinar:      { name: "fuchsia",  gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabmeet:         { name: "purple",   gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabdesk:         { name: "rose",     gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  settings:        { name: "zinc",     gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",     inkMuted: "text-zoru-ink",        soft: "bg-zoru-surface-2",     softer: "bg-zoru-surface-2/60",     hoverSoft: "hover:bg-zoru-surface-2",    ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabsprints:      { name: "blue",     gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabcheckout:     { name: "amber",    gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",     softer: "bg-zoru-surface-2/60",     hoverSoft: "hover:bg-zoru-surface-2",    ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabtables:       { name: "cyan",     gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",     softer: "bg-zoru-surface-2/60",     hoverSoft: "hover:bg-zoru-surface-2",    ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabvault:        { name: "red",      gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabcreator:      { name: "yellow",   gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",     softer: "bg-zoru-surface-2/60",     hoverSoft: "hover:bg-zoru-surface-2",    ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabpractice:     { name: "teal",     gradient: "from-zoru-ink to-zoru-ink",     ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",     softer: "bg-zoru-surface-2/60",     hoverSoft: "hover:bg-zoru-surface-2",    ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabbi:           { name: "blue",     gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabsign:         { name: "blue",     gradient: "from-zoru-ink to-zoru-ink",      ink: "text-zoru-ink",     inkMuted: "text-zoru-ink/70",     soft: "bg-zoru-surface-2",      softer: "bg-zoru-surface-2/60",      hoverSoft: "hover:bg-zoru-surface-2",     ring: "ring-zoru-line/70",     titleInk: "text-zoru-ink/80" },
  sabops:          { name: "indigo",   gradient: "from-zoru-ink to-zoru-ink",  ink: "text-zoru-ink",   inkMuted: "text-zoru-ink/70",   soft: "bg-zoru-surface-2",    softer: "bg-zoru-surface-2/60",    hoverSoft: "hover:bg-zoru-surface-2",   ring: "ring-zoru-line/70",   titleInk: "text-zoru-ink/80" },
};

const FALLBACK_HUE: ModuleHue = MODULE_HUE.settings;

function hueFor(id: string): ModuleHue {
  return MODULE_HUE[id] ?? FALLBACK_HUE;
}

function dockAccent(h: ModuleHue): DockAccent {
  return { gradient: h.gradient, ink: h.ink, soft: h.soft, ring: h.ring };
}

/* ── Wachat config / settings split ─────────────────────────────────── */

/** Path prefixes whose Wachat-menu entries belong under "Settings → Wachat",
 *  not under the Wachat module's own right rail. */
const WACHAT_CONFIG_PREFIXES = [
  "/wachat/numbers",
  "/wachat/calls",
  "/wachat/health",
  "/wachat/integrations",
  "/wachat/webhooks",
  "/dashboard/settings", // covers /wachat/settings/general, /agents, /attributes, /canned
];

function isWachatConfigPath(href: string | undefined): boolean {
  if (!href) return false;
  return WACHAT_CONFIG_PREFIXES.some((p) => href === p || href.startsWith(`${p}/`));
}

const wachatPrimaryItems: ConfigMenuItem[] = wachatMenuItems.filter((i) => !isWachatConfigPath(i.href));
const wachatConfigItems: ConfigMenuItem[] = wachatMenuItems.filter((i) => isWachatConfigPath(i.href));

/* ── Module → Section[] mapping ─────────────────────────────────────── */

type Section = { title: string; items: ConfigMenuItem[] };

function asSections(items: ConfigMenuItem[], title: string): Section[] {
  return [{ title, items }];
}
function fromGroups(groups: ConfigMenuGroup[]): Section[] {
  return groups.map((g) => ({ title: g.title, items: g.items }));
}
function singleLink(label: string, href: string): Section[] {
  return [{ title: label, items: [{ label: "Open", href }] }];
}

/** Settings right-rail = user settings + the Wachat config items pulled out
 *  of the Wachat menu, plus a thin "Workspace" section for cross-cutting
 *  items the existing app already has (extend as needed). */
const settingsSections: Section[] = [
  { title: "Account", items: userSettingsItems },
  { title: "Wachat", items: wachatConfigItems },
];

const moduleSections: Record<string, Section[]> = {
  whatsapp: asSections(wachatPrimaryItems, "Wachat"),
  sabchat: asSections(sabChatMenuItems, "sabChat"),
  facebook: fromGroups(facebookMenuGroups),
  "ad-manager": asSections(adManagerMenuItems, "Ad Manager"),
  telegram: singleLink("Telegram", "/dashboard/telegram"),
  instagram: fromGroups(instagramMenuGroups),
  crm: fromGroups(crmMenuGroups),
  hrm: fromGroups(hrmMenuGroups),
  sabflow: asSections(sabflowMenuItems, "SabFlow"),
  team: asSections(teamMenuItems, "Team"),
  email: asSections(emailMenuItems, "Email"),
  sms: asSections(smsMenuItems, "SMS"),
  api: asSections(apiMenuItems, "API & Dev"),
  "website-builder": singleLink("Website Builder", "/dashboard/website-builder"),
  "url-shortener": asSections(urlShortenerMenuItems, "Links"),
  "qr-code-maker": asSections(qrCodeMakerMenuItems, "QR Codes"),
  "seo-suite": asSections(seoMenuItems, "SEO Suite"),
  sabshop: fromGroups(sabshopMenuGroups),
  sabdesk: fromGroups(sabdeskMenuGroups),
  sabmeet: fromGroups(sabmeetMenuGroups),
  sabwebinar: fromGroups(sabwebinarMenuGroups),
  sabcheckout: fromGroups(sabcheckoutMenuGroups),
  sabsprints: fromGroups(sabsprintsMenuGroups),
  sabtables: fromGroups(sabtablesMenuGroups),
  sabcreator: fromGroups(sabcreatorMenuGroups),
  sabvault: fromGroups(sabvaultMenuGroups),
  sabsign: fromGroups(sabsignMenuGroups),
  sabbi: fromGroups(sabbiMenuGroups),
  sabops: fromGroups(sabopsMenuGroups),
  sabpractice: fromGroups(sabPracticeMenuGroups),
  settings: settingsSections,
};

const moduleTitles: Record<string, string> = {
  ...appIcons.reduce((a, m) => ({ ...a, [m.id]: m.label }), {} as Record<string, string>),
  settings: "Settings",
};

/* ── Active-module detection ────────────────────────────────────────── */

/** Pick the active module by URL prefix. Wachat-config paths route to Settings. */
function detectActiveModule(pathname: string | null): string {
  if (!pathname) return "whatsapp";
  if (pathname.startsWith("/dashboard/profile") || pathname.startsWith("/dashboard/user")) {
    return "settings";
  }
  if (isWachatConfigPath(pathname)) return "settings";

  let best: { id: string; len: number } | null = null;
  for (const m of appIcons) {
    if (!m.href) continue;
    const slug = m.href.replace(/^\/dashboard\/?/, "").split("/")[0];
    if (slug && pathname.startsWith(`/dashboard/${slug}`)) {
      if (!best || slug.length > best.len) best = { id: m.id, len: slug.length };
    }
  }
  if (best) return best.id;
  return "whatsapp";
}

/* ── Search bar ─────────────────────────────────────────────────────── */

function SearchBar({
  collapsed,
  value,
  onChange,
  hue,
}: {
  collapsed: boolean;
  value: string;
  onChange: (v: string) => void;
  hue: ModuleHue;
}) {
  return (
    <div className={cn("relative shrink-0 transition-all duration-300", collapsed ? "w-full flex justify-center" : "w-full")}>
      <div className={cn(
        "h-9 rounded-xl flex items-center transition-all duration-300",
        "bg-white ring-1 ring-zoru-line/80 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_-1px_rgba(15,23,42,0.06)]",
        "focus-within:ring-2", hue.ring,
        collapsed ? "w-9 min-w-9 justify-center" : "w-full",
      )}>
        <div className={cn("flex items-center justify-center shrink-0", collapsed ? "p-1" : "pl-2.5")}>
          <SearchIcon className={cn("h-4 w-4", hue.titleInk)} size={16} />
        </div>
        <div className={cn("flex-1 transition-opacity duration-300 overflow-hidden", collapsed ? "opacity-0 w-0" : "opacity-100")}>
          <input
            type="text"
            placeholder="Search…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            tabIndex={collapsed ? -1 : 0}
            aria-label="Search menu"
            className="w-full bg-transparent border-0 outline-none text-[12.5px] text-zoru-ink placeholder:text-zoru-ink-muted py-1.5 px-2 focus:ring-0"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Brand + avatar ─────────────────────────────────────────────────── */

function BrandBadge() {
  return (
    <Link
      href="/wachat"
      className="block shrink-0 w-full rounded-xl hover:bg-zoru-surface-2 transition-colors mb-1"
      aria-label="SabNode home"
    >
      <div className="flex items-center gap-2 h-9 px-1">
        <div className="size-7 rounded-lg bg-gradient-to-br from-zoru-ink via-zoru-ink to-zoru-ink flex items-center justify-center shadow-sm ring-1 ring-white/40">
          <span className="text-white font-bold text-[12px] drop-shadow-sm">S</span>
        </div>
        <span className="font-semibold text-[14px] tracking-tight bg-gradient-to-r from-zoru-ink to-zoru-ink bg-clip-text text-transparent">
          SabNode
        </span>
      </div>
    </Link>
  );
}

function AvatarCircle({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-zoru-ink via-zoru-ink to-zoru-ink flex items-center justify-center shrink-0 ring-2 ring-white shadow-md"
      style={{ width: size, height: size }}
    >
      <UserIcon size={Math.max(12, size - 14)} className="text-white" />
    </div>
  );
}

/* ── Left rail (icons) ──────────────────────────────────────────────── */

function IconNavButton({
  active = false,
  title,
  href,
  onClick,
  hue,
  children,
}: {
  active?: boolean;
  title: string;
  href?: string;
  onClick?: () => void;
  hue?: ModuleHue;
  children: React.ReactNode;
}) {
  const h = hue ?? FALLBACK_HUE;
  const className = cn(
    "flex items-center justify-center rounded-xl size-9 min-w-9 transition-all duration-150 relative",
    active
      ? cn("bg-gradient-to-br text-white shadow-md ring-1 ring-white/30", h.gradient)
      : "text-zoru-ink hover:bg-zoru-surface-2 hover:text-zoru-ink",
  );
  if (href) {
    return (
      <Link href={href} title={title} aria-label={title} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function IconRail({ active, compact = false }: { active: string; compact?: boolean }) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-1.5 items-center py-3 shrink-0 min-h-screen border-r border-zoru-line/70 bg-white",
        compact ? "w-12 px-1.5" : "w-14 px-2",
      )}
      aria-label="Module navigation"
    >
      <Link href="/wachat" aria-label="SabNode home" className="mb-1 size-9 flex items-center justify-center">
        <div className="size-7 rounded-lg bg-gradient-to-br from-zoru-ink via-zoru-ink to-zoru-ink flex items-center justify-center shadow-sm ring-1 ring-white/40">
          <span className="text-white font-bold text-[12px] drop-shadow-sm">S</span>
        </div>
      </Link>

      <ScrollArea className="w-full flex-1">
        <nav className="flex flex-col gap-1.5 w-full items-center pr-1 pb-2" aria-label="Modules">
          {appIcons.map((mod) => {
            const Icon = mod.icon as React.FC<{ className?: string; size?: number }>;
            return (
              <IconNavButton
                key={mod.id}
                active={active === mod.id}
                title={mod.label}
                href={mod.href}
                hue={hueFor(mod.id)}
              >
                <Icon className="h-4 w-4" size={16} />
              </IconNavButton>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="flex flex-col gap-1.5 w-full items-center pt-2 border-t border-zoru-line/70">
        <IconNavButton
          active={active === "settings"}
          title="Settings"
          href="/wachat/settings/general"
          hue={hueFor("settings")}
        >
          <SettingsIcon size={16} />
        </IconNavButton>
        <Link href="/dashboard/profile" aria-label="Profile" className="rounded-full">
          <AvatarCircle size={28} />
        </Link>
      </div>
    </aside>
  );
}

/* ── App Dock (floating bottom-center, replaces icon rail) ──────────── */

function AppDock({ active }: { active: string }) {
  // Optional — falls back to plain Link navigation if no TabsProvider is mounted.
  const tabs = useTabsOptional();

  function makeOnActivate(moduleId: string, label: string, hue: ModuleHue) {
    if (!tabs) return undefined;
    return (href: string) => {
      tabs.openTab({
        moduleId,
        title: label,
        href,
        hue: {
          gradient: hue.gradient,
          ink: hue.ink,
          soft: hue.soft,
          ring: hue.ring,
          hoverSoft: hue.hoverSoft,
        },
      });
    };
  }

  return (
    <Dock iconSize={44}>
      {appIcons.map((mod) => {
        const Icon = mod.icon as React.FC<{ className?: string; size?: number }>;
        const hue = hueFor(mod.id);
        return (
          <DockIcon
            key={mod.id}
            name={mod.label}
            href={mod.href}
            active={active === mod.id}
            accent={dockAccent(hue)}
            onActivate={makeOnActivate(mod.id, mod.label, hue)}
          >
            <Icon className="h-5 w-5" size={20} />
          </DockIcon>
        );
      })}
      <DockIcon
        name="Settings"
        href="/wachat/settings/general"
        active={active === "settings"}
        accent={dockAccent(hueFor("settings"))}
        onActivate={makeOnActivate("settings", "Settings", hueFor("settings"))}
      >
        <SettingsIcon size={20} />
      </DockIcon>
      <DockIcon
        name="Profile"
        href="/dashboard/profile"
        accent={{
          gradient: "from-zoru-ink via-zoru-ink to-zoru-ink",
          ink: "text-zoru-ink",
          soft: "bg-zoru-surface-2",
          ring: "ring-zoru-line/70",
        }}
        onActivate={
          tabs
            ? (href) =>
                tabs.openTab({
                  moduleId: "profile",
                  title: "Profile",
                  href,
                  hue: {
                    gradient: "from-zoru-ink via-zoru-ink to-zoru-ink",
                    ink: "text-zoru-ink",
                    soft: "bg-zoru-surface-2",
                    ring: "ring-zoru-line/70",
                    hoverSoft: "hover:bg-zoru-surface-2",
                  },
                })
            : undefined
        }
      >
        <UserIcon size={20} />
      </DockIcon>
    </Dock>
  );
}

export function SabNodeAppDock() {
  const pathname = usePathname();
  const active = useMemo(() => detectActiveModule(pathname), [pathname]);
  // The wrapper MUST stay overflow-visible: the dock tooltip pill is rendered
  // ABOVE the dock (-top-10) and any overflow:auto/hidden on a parent — even
  // on one axis — forces the visible axis to compute as `auto` (CSS spec) and
  // clips the pill. If horizontal overflow becomes a real problem on tiny
  // viewports, scale `iconSize` down rather than re-introducing overflow here.
  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 max-w-[calc(100vw-1.5rem)] overflow-visible"
      aria-label="App dock"
    >
      <AppDock active={active} />
    </div>
  );
}

/* ── Right rail (detail panel) ──────────────────────────────────────── */

function SectionTitle({
  title,
  collapsed,
  hue,
}: {
  title: string;
  collapsed: boolean;
  hue: ModuleHue;
}) {
  // Minimize / expand chevrons removed per product direction — the rail is
  // always shown at its module width on desktop, and the mobile sheet is
  // dismissed with the sheet's built-in close affordance.
  if (collapsed) {
    return (
      <div
        className={cn(
          "w-full flex items-center justify-center rounded-xl py-2",
          hue.soft,
        )}
      >
        <span
          aria-hidden
          className={cn("size-2.5 rounded-full bg-gradient-to-br shadow-sm", hue.gradient)}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "w-full rounded-xl px-2.5 py-2 flex items-center gap-2",
        hue.soft,
      )}
    >
      <span className={cn("size-2 rounded-full bg-gradient-to-br shadow-sm", hue.gradient)} aria-hidden />
      <h2 className={cn("text-[13px] font-bold tracking-tight leading-none truncate", hue.ink)}>
        {title}
      </h2>
    </div>
  );
}

function MenuRow({
  item,
  collapsed,
  isActive,
  hue,
  pathname,
}: {
  item: ConfigMenuItem;
  collapsed: boolean;
  isActive: boolean;
  hue: ModuleHue;
  pathname?: string | null;
}) {
  const Icon = item.icon as React.FC<{ className?: string; size?: number }> | undefined;
  
  const isSubItemOpen = !!(item.subItems && item.subItems.some(s => pathname && (s.exact ? pathname === s.href : pathname.startsWith(s.href))));
  const [open, setOpen] = React.useState(isActive || isSubItemOpen);
  
  React.useEffect(() => {
    if (isActive || isSubItemOpen) setOpen(true);
  }, [isActive, isSubItemOpen]);

  const inner = (
    <div
      className={cn(
        "rounded-lg flex items-center transition-all duration-150 group/row relative",
        isActive && !item.subItems
          ? cn(
              "text-white shadow-md ring-1 ring-white/20",
              "bg-gradient-to-r", hue.gradient,
            )
          : cn("text-zoru-ink hover:text-zoru-ink", hue.hoverSoft),
        collapsed ? "w-9 min-w-9 h-9 justify-center p-0" : "w-full min-h-9 px-2.5 py-1",
      )}
      title={collapsed ? item.label : undefined}
    >
      <span className="flex items-center justify-center shrink-0 w-4 h-4">
        {Icon ? (
          <Icon className={cn("h-4 w-4", (isActive && !item.subItems) ? "text-white" : hue.titleInk)} size={16} />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "block h-1.5 w-1.5 rounded-full",
              (isActive && !item.subItems) ? "bg-white/80" : cn("bg-gradient-to-br", hue.gradient, "opacity-70"),
            )}
          />
        )}
      </span>
      <span
        className={cn(
          "flex-1 transition-opacity duration-200 overflow-hidden",
          collapsed ? "opacity-0 w-0" : "opacity-100 ml-2.5",
        )}
      >
        <span className="text-[12.5px] leading-[18px] flex items-center gap-1.5 font-medium">
          <span className="truncate flex-1 text-left">{item.label}</span>
          {item.beta && (
            <span
              className={cn(
                "rounded-full text-[9px] px-1.5 py-0.5 uppercase tracking-wide font-bold",
                (isActive && !item.subItems) ? "bg-white/25 text-white" : "bg-zoru-surface-2/80 text-zoru-ink",
              )}
            >
              beta
            </span>
          )}
          {item.new && (
            <span
              className={cn(
                "rounded-full text-[9px] px-1.5 py-0.5 uppercase tracking-wide font-bold",
                (isActive && !item.subItems)
                  ? "bg-white/25 text-white"
                  : "bg-gradient-to-r from-zoru-ink to-zoru-ink text-white shadow-sm",
              )}
            >
              new
            </span>
          )}
        </span>
      </span>
      {item.subItems && !collapsed && (
        <ChevronRight className={cn("w-3.5 h-3.5 ml-1 transition-transform", open ? "rotate-90" : "", (isActive && !item.subItems) ? "text-white" : "text-zoru-ink-muted")} />
      )}
    </div>
  );

  if (item.subItems) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <button className="block w-full outline-none">{inner}</button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <div className="flex flex-col gap-0.5 w-full pl-6 pt-1">
            {item.subItems.map(sub => {
              const isSubActive = !!(sub.href && pathname && (sub.exact ? pathname === sub.href : pathname.startsWith(sub.href)));
              return (
                <MenuRow
                  key={`${item.label}-${sub.label}`}
                  item={sub}
                  collapsed={collapsed}
                  isActive={isSubActive}
                  hue={hue}
                  pathname={pathname}
                />
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (item.href) {
    return (
      <Link href={item.href} className="block w-full" aria-current={isActive ? "page" : undefined}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function SectionBlock({
  section,
  collapsed,
  pathname,
  query,
  hue,
}: {
  section: Section;
  collapsed: boolean;
  pathname: string | null;
  query: string;
  hue: ModuleHue;
}) {
  const filtered = useMemo(() => {
    if (!query.trim()) return section.items;
    const q = query.toLowerCase();
    return section.items.filter((i) => i.label.toLowerCase().includes(q));
  }, [section.items, query]);

  if (filtered.length === 0 && query.trim()) return null;
  if (filtered.length === 0) return null;

  return (
    <div className={cn("flex flex-col w-full", collapsed ? "" : "first:mt-0 mt-1")}>
      <div className={cn("transition-all duration-300 overflow-hidden", collapsed ? "h-0 opacity-0" : "h-7 opacity-100")}>
        <div className="flex items-center gap-1.5 h-7 px-1.5">
          <span className={cn("h-1 w-1 rounded-full bg-gradient-to-br", hue.gradient)} aria-hidden />
          <span className={cn("text-[10px] uppercase tracking-[0.1em] font-bold", hue.titleInk)}>
            {section.title}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 w-full">
        {filtered.map((item) => (
          <MenuRow
            key={`${section.title}-${item.label}-${item.href ?? ""}`}
            item={item}
            collapsed={collapsed}
            hue={hue}
            pathname={pathname}
            isActive={
              !!(item.href && pathname &&
                (item.exact ? pathname === item.href : pathname.startsWith(item.href)))
            }
          />
        ))}
      </div>
    </div>
  );
}

function DetailPanel({
  active,
  collapsed,
}: {
  active: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const sections = useMemo<Section[]>(
    () => moduleSections[active] ?? [{ title: "Module", items: [{ label: "Coming soon", href: "#" }] }],
    [active],
  );
  const title = moduleTitles[active] ?? "Module";

  // reset filter on module change
  useEffect(() => {
    setQuery("");
  }, [active]);

  const totalMatches = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return sections.reduce(
      (sum, s) => sum + s.items.filter((i) => i.label.toLowerCase().includes(q)).length,
      0,
    );
  }, [sections, query]);

  const hue = hueFor(active);

  return (
    <aside
      className={cn(
        // h-screen + sticky pin the rail to the viewport so the inner flex
        // column has a fixed bound — the ScrollArea's flex-1 + min-h-0 then
        // makes ONLY the menu list scroll while the brand/section/search
        // header and the account footer stay static.
        "relative sticky top-0 h-screen flex flex-col gap-2.5 items-stretch py-3 transition-all duration-300",
        "bg-white border-r border-zoru-line/70",
        // 60% of the original (`w-72 lg:w-80`) +15% — lands at w-52 / w-56
        // (208 / 224 px), close to 202 / 221 px exact.
        collapsed ? "w-12 min-w-12 px-1.5" : "w-52 lg:w-56 px-2.5",
      )}
      aria-label={`${title} navigation`}
    >
      {/* Multicolour accent strip — module hue runs along the top edge */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r",
          hue.gradient,
        )}
      />

      {/* Static header — pinned at the top of the rail. */}
      <div className="shrink-0 flex flex-col gap-2.5">
        {!collapsed && <BrandBadge />}
        <SectionTitle title={title} collapsed={collapsed} hue={hue} />
        <SearchBar collapsed={collapsed} value={query} onChange={setQuery} hue={hue} />
      </div>

      <ScrollArea className="w-full min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,transparent_0,black_12px,black_calc(100%-24px),transparent_100%)]">
        <div className={cn("flex flex-col w-full", collapsed ? "gap-0.5 items-center" : "gap-2 items-stretch")}>
          {sections.map((s, i) => (
            <SectionBlock
              key={`${active}-${i}`}
              section={s}
              collapsed={collapsed}
              pathname={pathname}
              query={query}
              hue={hue}
            />
          ))}
          {totalMatches === 0 && (
            <div className="text-[12px] text-zoru-ink px-3 py-2">
              No matches for &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Static footer — pinned at the bottom of the rail. */}
      {!collapsed && (
        <div className="shrink-0 w-full pt-2 border-t border-zoru-line/70">
          <Link
            href="/dashboard/profile"
            className={cn(
              "flex items-center gap-2 px-2 py-2 rounded-xl transition-colors",
              hue.hoverSoft,
            )}
          >
            <AvatarCircle size={28} />
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-semibold text-zoru-ink truncate">Account</span>
              <span className="text-[10.5px] text-zoru-ink truncate">Profile &amp; preferences</span>
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}

/* ── Persisted-collapsed helpers ────────────────────────────────────── */

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

/* ── Public exports: desktop + mobile + composite ───────────────────── */

export function SabNodeTwoLineSidebar() {
  const pathname = usePathname();
  const active = useMemo(() => detectActiveModule(pathname), [pathname]);
  // Persisted collapsed-state is still read so users who collapsed the rail
  // before the toggle was removed don't suddenly see the wide layout. There
  // is no longer a UI to flip it; ignore writes.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  return (
    <div className="hidden lg:flex flex-row h-screen sticky top-0">
      <DetailPanel active={active} collapsed={collapsed} />
    </div>
  );
}

export function SabNodeTwoLineSidebarMobile() {
  const pathname = usePathname();
  const active = useMemo(() => detectActiveModule(pathname), [pathname]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open navigation"
            className="fixed top-3 left-3 z-40 inline-flex items-center justify-center rounded-xl bg-white size-9 shadow-md ring-1 ring-zoru-line/70 text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2 transition-colors"
          >
            <MenuIcon size={18} />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="p-0 w-[280px] border-r border-zoru-line/70 bg-white"
        >
          <SheetTitle className="sr-only">SabNode navigation</SheetTitle>
          <div className="flex flex-row h-full">
            <DetailPanel active={active} collapsed={false} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function SabNodeSidebar() {
  return (
    <>
      <SabNodeTwoLineSidebar />
      <SabNodeTwoLineSidebarMobile />
      <SabNodeAppDock />
    </>
  );
}

/* ── Centered preview frame for the demo route ──────────────────────── */

export function Frame760() {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-zoru-surface-2 via-white to-zoru-surface-2">
      <SabNodeSidebar />
      <main className="flex-1 p-6 text-zoru-ink">
        <div className="max-w-3xl">
          <h1 className="text-[22px] font-semibold mb-1.5">SabNode two-line sidebar</h1>
          <p className="text-zoru-ink text-[13.5px] leading-relaxed">
            Light clay palette · production-ready. Left rail = every module from
            <code className="font-mono mx-1">appIcons</code>. Right rail = the active module&rsquo;s
            menu, drawn live from
            <code className="font-mono mx-1">src/config/dashboard-config.ts</code>. Wachat
            operational pages (Numbers, Calls, Account Health, Integrations, Webhooks, Agents,
            Attributes, Canned, General) have been moved into Settings → Wachat. Click the gear
            icon to see them.
          </p>
        </div>
      </main>
    </div>
  );
}

export default Frame760;
