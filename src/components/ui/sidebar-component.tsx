"use client";

/**
 * SabNode two-line sidebar — light "clay" palette, production-ready.
 *
 * • Left rail = every top-level module from `appIcons` in `dashboard-config.ts`
 *   (Wachat, sabChat, Meta Suite, Ad Manager, Telegram, Instagram, CRM, HRM,
 *    SabFlow, Team, Email, SMS, API & Dev, Website, Links, QR Codes, SEO).
 * • Right rail = the active module's full menu, sourced live from
 *   `dashboard-config.ts` (so editing menus there updates this sidebar).
 *
 * UX policy implemented here:
 *  - Wachat operational pages (Numbers, Calls, Account Health, Integrations,
 *    Webhooks, General Settings, Agents & Roles, User Attributes, Canned
 *    Messages) are NOT shown in the Wachat right rail — they are surfaced
 *    under Settings → "Wachat" instead. The split happens in this component
 *    via a path-prefix filter; no edits to `dashboard-config.ts` are needed.
 *
 *  - Active module auto-detected from `usePathname()`.
 *  - Module-icon click navigates to that module's landing route.
 *  - Right rail collapses to icon-only mode (state persisted in localStorage).
 *  - Mobile (<lg breakpoint) opens both rails inside a shadcn Sheet drawer.
 *  - Search filter scopes to the active module.
 *  - Beta / new badges render automatically from the config.
 *  - Active row uses the rose pill (`clay-rose-soft` + `clay-rose-ink`).
 *
 * Live demo route at `/dashboard/two-line`.
 */
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search as SearchIcon,
  ChevronDown as ChevronDownIcon,
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
  type MenuItem as ConfigMenuItem,
  type MenuGroup as ConfigMenuGroup,
} from "@/config/dashboard-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Dock, DockIcon } from "@/components/ui/dock";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "sabnode:two-line-sidebar:collapsed";

/* ── Wachat config / settings split ─────────────────────────────────── */

/** Path prefixes whose Wachat-menu entries belong under "Settings → Wachat",
 *  not under the Wachat module's own right rail. */
const WACHAT_CONFIG_PREFIXES = [
  "/dashboard/numbers",
  "/dashboard/calls",
  "/dashboard/health",
  "/dashboard/integrations",
  "/dashboard/webhooks",
  "/dashboard/settings", // covers /dashboard/settings/general, /agents, /attributes, /canned
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
}: {
  collapsed: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={cn("relative shrink-0 transition-all duration-300", collapsed ? "w-full flex justify-center" : "w-full")}>
      <div className={cn(
        "h-9 rounded-lg flex items-center transition-all duration-300 bg-clay-surface-2 border border-black/5",
        "focus-within:ring-1 focus-within:ring-clay-rose/40 focus-within:ring-offset-1 focus-within:ring-offset-clay-surface focus-within:border-clay-rose/30",
        collapsed ? "w-9 min-w-9 justify-center" : "w-full",
      )}>
        <div className={cn("flex items-center justify-center shrink-0", collapsed ? "p-1" : "pl-2")}>
          <SearchIcon className="h-4 w-4 text-clay-ink-muted" size={16} />
        </div>
        <div className={cn("flex-1 transition-opacity duration-300 overflow-hidden", collapsed ? "opacity-0 w-0" : "opacity-100")}>
          <input
            type="text"
            placeholder="Search…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            tabIndex={collapsed ? -1 : 0}
            aria-label="Search menu"
            className="w-full bg-transparent border-0 outline-none text-[13px] text-clay-ink placeholder:text-clay-ink-soft py-1.5 px-2 focus:ring-0"
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
      href="/dashboard"
      className="block shrink-0 w-full rounded-md hover:bg-clay-surface-2 transition-colors mb-1"
      aria-label="SabNode home"
    >
      <div className="flex items-center gap-2 h-9 px-1">
        <div className="size-7 rounded-md bg-clay-ink flex items-center justify-center">
          <span className="text-clay-surface font-bold text-[12px]">S</span>
        </div>
        <span className="font-semibold text-[15px] text-clay-ink">SabNode</span>
      </div>
    </Link>
  );
}

function AvatarCircle({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shrink-0 ring-1 ring-black/5 shadow-sm"
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
  children,
}: {
  active?: boolean;
  title: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = cn(
    "flex items-center justify-center rounded-lg size-9 min-w-9 transition-colors duration-150 relative",
    active
      ? "bg-clay-rose-soft text-clay-rose-ink shadow-[inset_2px_0_0_0_currentColor]"
      : "text-clay-ink-muted hover:bg-clay-surface-2 hover:text-clay-ink",
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
        "flex flex-col gap-1.5 items-center py-3 shrink-0 min-h-screen border-r border-black/5",
        compact ? "w-12 px-1.5" : "w-14 px-2",
      )}
      style={{ backgroundColor: "hsl(36 18% 96%)" }}
      aria-label="Module navigation"
    >
      <Link href="/dashboard" aria-label="SabNode home" className="mb-1 size-9 flex items-center justify-center">
        <div className="size-7 rounded-md bg-clay-ink flex items-center justify-center">
          <span className="text-clay-surface font-bold text-[12px]">S</span>
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
              >
                <Icon className="h-4 w-4" size={16} />
              </IconNavButton>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="flex flex-col gap-1.5 w-full items-center pt-2 border-t border-black/5">
        <IconNavButton
          active={active === "settings"}
          title="Settings"
          href="/dashboard/settings/general"
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
  return (
    <Dock iconSize={44}>
      {appIcons.map((mod) => {
        const Icon = mod.icon as React.FC<{ className?: string; size?: number }>;
        return (
          <DockIcon
            key={mod.id}
            name={mod.label}
            href={mod.href}
            active={active === mod.id}
          >
            <Icon className="h-5 w-5 text-clay-ink" size={20} />
          </DockIcon>
        );
      })}
      <DockIcon
        name="Settings"
        href="/dashboard/settings/general"
        active={active === "settings"}
      >
        <SettingsIcon size={20} className="text-clay-ink" />
      </DockIcon>
      <DockIcon name="Profile" href="/dashboard/profile">
        <UserIcon size={20} className="text-clay-ink" />
      </DockIcon>
    </Dock>
  );
}

export function SabNodeAppDock() {
  const pathname = usePathname();
  const active = useMemo(() => detectActiveModule(pathname), [pathname]);
  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 max-w-[calc(100vw-1.5rem)] [overflow-x:auto] [overflow-y:visible]"
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
  onToggle,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <div className="w-full flex justify-center">
        <button
          type="button"
          aria-label="Expand sidebar"
          aria-expanded={false}
          onClick={onToggle}
          className="flex items-center justify-center rounded-lg size-9 min-w-9 hover:bg-clay-surface-2 active:bg-clay-surface-3 text-clay-ink-muted hover:text-clay-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-clay-rose/40 focus-visible:ring-offset-1"
        >
          <ChevronDownIcon size={16} className="rotate-90 transition-transform duration-300" />
        </button>
      </div>
    );
  }
  return (
    <div className="w-full flex items-center justify-between px-1">
      <h2 className="text-[16px] font-semibold tracking-tight text-clay-ink leading-none truncate pl-1">
        {title}
      </h2>
      <button
        type="button"
        aria-label="Collapse sidebar"
        aria-expanded={true}
        onClick={onToggle}
        className="flex items-center justify-center rounded-lg size-8 min-w-8 hover:bg-clay-surface-2 active:bg-clay-surface-3 text-clay-ink-muted hover:text-clay-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-clay-rose/40 focus-visible:ring-offset-1"
      >
        <ChevronDownIcon size={16} className="-rotate-90 transition-transform duration-300" />
      </button>
    </div>
  );
}

function MenuRow({
  item,
  collapsed,
  isActive,
}: {
  item: ConfigMenuItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon as React.FC<{ className?: string; size?: number }> | undefined;
  const inner = (
    <div
      className={cn(
        "rounded-lg flex items-center transition-colors duration-150",
        isActive
          ? "bg-clay-rose-soft text-clay-rose-ink shadow-[inset_2px_0_0_0_currentColor]"
          : "text-clay-ink-2 hover:bg-clay-surface-2 hover:text-clay-ink",
        collapsed ? "w-9 min-w-9 h-9 justify-center p-0" : "w-full h-9 px-2.5",
      )}
      title={collapsed ? item.label : undefined}
    >
      <span className="flex items-center justify-center shrink-0 w-4 h-4">
        {Icon ? (
          <Icon className="h-4 w-4" size={16} />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "block h-px w-2 rounded-full",
              isActive ? "bg-clay-rose-ink/70" : "bg-clay-ink-fade",
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
        <span className="text-[13.5px] leading-[18px] truncate flex items-center gap-1.5">
          <span className="truncate">{item.label}</span>
          {item.beta && (
            <span className="rounded bg-clay-ink/[0.08] text-clay-ink/70 text-[10px] px-1 py-0.5 uppercase tracking-wide font-medium">
              beta
            </span>
          )}
          {item.new && (
            <span className="rounded bg-clay-rose-softer text-clay-rose-ink text-[10px] px-1 py-0.5 uppercase tracking-wide font-medium">
              new
            </span>
          )}
        </span>
      </span>
    </div>
  );
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
}: {
  section: Section;
  collapsed: boolean;
  pathname: string | null;
  query: string;
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
        <div className="flex items-center h-7 px-2.5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-clay-ink-muted font-semibold">
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
  onToggleCollapse,
}: {
  active: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
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

  return (
    <aside
      className={cn(
        "flex flex-col gap-3 items-stretch py-3 transition-all duration-300 min-h-screen border-r border-black/5",
        collapsed ? "w-14 min-w-14 px-1" : "w-72 lg:w-80 px-3",
      )}
      style={{ backgroundColor: collapsed ? "hsl(36 18% 96%)" : "hsl(36 15% 97%)" }}
      aria-label={`${title} navigation`}
    >
      {!collapsed && <BrandBadge />}
      <SectionTitle title={title} collapsed={collapsed} onToggle={onToggleCollapse} />
      <SearchBar collapsed={collapsed} value={query} onChange={setQuery} />

      <ScrollArea className="w-full flex-1 [mask-image:linear-gradient(to_bottom,transparent_0,black_12px,black_calc(100%-24px),transparent_100%)]">
        <div className={cn("flex flex-col w-full", collapsed ? "gap-0.5 items-center" : "gap-2.5 items-stretch")}>
          {sections.map((s, i) => (
            <SectionBlock
              key={`${active}-${i}`}
              section={s}
              collapsed={collapsed}
              pathname={pathname}
              query={query}
            />
          ))}
          {totalMatches === 0 && (
            <div className="text-[12px] text-clay-ink-muted px-3 py-2">
              No matches for &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      </ScrollArea>

      {!collapsed && (
        <div className="w-full pt-2 border-t border-black/5">
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-clay-surface-2 transition-colors"
          >
            <AvatarCircle size={28} />
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium text-clay-ink truncate">Account</span>
              <span className="text-[11px] text-clay-ink-muted truncate">Profile &amp; preferences</span>
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

function writeCollapsed(v: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, v ? "true" : "false");
  } catch {
    /* noop */
  }
}

/* ── Public exports: desktop + mobile + composite ───────────────────── */

export function SabNodeTwoLineSidebar() {
  const pathname = usePathname();
  const active = useMemo(() => detectActiveModule(pathname), [pathname]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((s) => {
      const next = !s;
      writeCollapsed(next);
      return next;
    });
  };

  return (
    <div className="hidden lg:flex flex-row min-h-screen sticky top-0">
      <DetailPanel active={active} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
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
            className="fixed top-3 left-3 z-40 inline-flex items-center justify-center rounded-md bg-clay-surface size-9 shadow-sm border border-black/5 text-clay-ink hover:bg-clay-surface-2 transition-colors"
          >
            <MenuIcon size={18} />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="p-0 w-[360px] border-r border-black/5"
          style={{ backgroundColor: "hsl(36 18% 96%)" }}
        >
          <SheetTitle className="sr-only">SabNode navigation</SheetTitle>
          <div className="flex flex-row h-full">
            <DetailPanel active={active} collapsed={false} onToggleCollapse={() => setOpen(false)} />
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
    <div className="min-h-screen flex" style={{ backgroundColor: "hsl(36 15% 97%)" }}>
      <SabNodeSidebar />
      <main className="flex-1 p-6 text-clay-ink">
        <div className="max-w-3xl">
          <h1 className="text-[22px] font-semibold mb-1.5">SabNode two-line sidebar</h1>
          <p className="text-clay-ink-muted text-[13.5px] leading-relaxed">
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
