"use client";

/**
 * SabNode two-line sidebar.
 *
 * • Left rail = every top-level module from `appIcons` in `dashboard-config.ts`
 *   (Wachat, sabChat, Meta Suite, Ad Manager, Telegram, Instagram, CRM, HRM,
 *    SabFlow, Team, Email, SMS, API & Dev, Website, Links, QR Codes, SEO).
 * • Right rail = the active module's full menu (sourced from `dashboard-config`
 *   so the sidebar stays in sync with the rest of the app).
 *
 * Behaviours implemented end-to-end:
 *  - Active module auto-detected from `usePathname()`.
 *  - Clicking an icon BOTH switches the right rail AND navigates to that
 *    module's landing route.
 *  - Right rail collapses to icon-only (state persisted in localStorage).
 *  - Mobile (<1024 px) renders the right rail inside a shadcn Sheet drawer.
 *  - Long menus scroll inside a shadcn ScrollArea.
 *  - Beta / new badges render automatically from the config.
 */
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";

const softSpringEasing = "cubic-bezier(0.25, 1.1, 0.4, 1)";
const COLLAPSED_KEY = "sabnode:two-line-sidebar:collapsed";

/* ── Module → Section[] mapping ──────────────────────────────────────── */

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

const moduleSections: Record<string, Section[]> = {
  whatsapp: asSections(wachatMenuItems, "Wachat"),
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
  settings: asSections(userSettingsItems, "Settings"),
};

const moduleTitles: Record<string, string> = {
  ...appIcons.reduce((a, m) => ({ ...a, [m.id]: m.label }), {} as Record<string, string>),
  settings: "Settings",
};

/** Pick the active module by matching the longest URL prefix from appIcons + settings. */
function detectActiveModule(pathname: string | null): string {
  if (!pathname) return "whatsapp";
  if (pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/profile")) {
    return "settings";
  }
  let best: { id: string; len: number } | null = null;
  for (const m of appIcons) {
    if (!m.href) continue;
    // Compare on the route segment after `/dashboard/`.
    const slug = m.href.replace(/^\/dashboard\/?/, "").split("/")[0];
    if (slug && pathname.startsWith(`/dashboard/${slug}`)) {
      if (!best || slug.length > best.len) best = { id: m.id, len: slug.length };
    }
  }
  if (best) return best.id;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "whatsapp";
  return "whatsapp";
}

/* ── Search input ────────────────────────────────────────────────────── */

function SearchBar({ collapsed, value, onChange }: { collapsed: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className={cn("relative shrink-0 transition-all duration-500", collapsed ? "w-full flex justify-center" : "w-full")}
      style={{ transitionTimingFunction: softSpringEasing }}>
      <div className={cn("bg-black h-10 rounded-lg flex items-center transition-all duration-500", collapsed ? "w-10 min-w-10 justify-center" : "w-full")}
        style={{ transitionTimingFunction: softSpringEasing }}>
        <div className={cn("flex items-center justify-center shrink-0", collapsed ? "p-1" : "px-1")}>
          <div className="size-8 flex items-center justify-center">
            <SearchIcon size={16} className="text-neutral-50" />
          </div>
        </div>
        <div className={cn("flex-1 transition-opacity duration-500 overflow-hidden", collapsed ? "opacity-0 w-0" : "opacity-100")}
          style={{ transitionTimingFunction: softSpringEasing }}>
          <input
            type="text"
            placeholder="Search modules…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            tabIndex={collapsed ? -1 : 0}
            className="w-full bg-transparent border-none outline-none text-[14px] text-neutral-50 placeholder:text-neutral-400 leading-[20px] py-1 pr-2"
          />
        </div>
        <div aria-hidden className="absolute inset-0 rounded-lg border border-neutral-800 pointer-events-none" />
      </div>
    </div>
  );
}

/* ── Brand badge + avatar ───────────────────────────────────────────── */

function BrandBadge() {
  return (
    <Link href="/dashboard" className="block shrink-0 w-full">
      <div className="flex items-center p-1 w-full">
        <div className="h-10 w-8 flex items-center justify-center pl-2">
          <div className="size-6 rounded-md bg-neutral-50 flex items-center justify-center">
            <span className="text-black font-bold text-[11px]">S</span>
          </div>
        </div>
        <div className="px-2 py-1">
          <div className="font-semibold text-[16px] text-neutral-50">SabNode</div>
        </div>
      </div>
    </Link>
  );
}

function AvatarCircle() {
  return (
    <div className="relative rounded-full shrink-0 size-8 bg-black">
      <div className="flex items-center justify-center size-8">
        <UserIcon size={16} className="text-neutral-50" />
      </div>
      <div aria-hidden className="absolute inset-0 rounded-full border border-neutral-800 pointer-events-none" />
    </div>
  );
}

/* ── Left rail (icons) ──────────────────────────────────────────────── */

function IconNavButton({ active = false, title, href, onClick, children }: {
  active?: boolean; title: string; href?: string; onClick?: () => void; children: React.ReactNode;
}) {
  const className = cn(
    "flex items-center justify-center rounded-lg size-10 min-w-10 transition-colors duration-500",
    active
      ? "bg-neutral-800 text-neutral-50"
      : "hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300",
  );
  if (href) {
    return (
      <Link href={href} title={title} className={className} onClick={onClick}
        style={{ transitionTimingFunction: softSpringEasing }}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" title={title} onClick={onClick} className={className}
      style={{ transitionTimingFunction: softSpringEasing }}>
      {children}
    </button>
  );
}

function IconRail({ active }: { active: string }) {
  return (
    <aside className="bg-black flex flex-col gap-2 items-center p-3 w-16 min-h-screen border-r border-neutral-800">
      <div className="mb-2 size-10 flex items-center justify-center">
        <Link href="/dashboard" aria-label="SabNode home">
          <div className="size-6 rounded-md bg-neutral-50 flex items-center justify-center">
            <span className="text-black font-bold text-[11px]">S</span>
          </div>
        </Link>
      </div>

      <ScrollArea className="w-full flex-1">
        <div className="flex flex-col gap-2 w-full items-center pr-1 pb-2">
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
        </div>
      </ScrollArea>

      <div className="flex flex-col gap-2 w-full items-center pt-2 border-t border-neutral-800">
        <IconNavButton active={active === "settings"} title="Settings" href="/dashboard/settings/general">
          <SettingsIcon size={16} />
        </IconNavButton>
        <Link href="/dashboard/profile" aria-label="Profile" className="size-8">
          <AvatarCircle />
        </Link>
      </div>
    </aside>
  );
}

/* ── Right rail (detail panel) ──────────────────────────────────────── */

function SectionTitle({ title, collapsed, onToggle }: {
  title: string; collapsed: boolean; onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <div className="w-full flex justify-center transition-all duration-500"
        style={{ transitionTimingFunction: softSpringEasing }}>
        <button type="button" aria-label="Expand sidebar" onClick={onToggle}
          className="flex items-center justify-center rounded-lg size-10 min-w-10 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300 transition-colors">
          <span className="inline-block rotate-180">
            <ChevronDownIcon size={16} />
          </span>
        </button>
      </div>
    );
  }
  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center h-10 px-2">
          <div className="font-semibold text-[18px] text-neutral-50 leading-[27px] truncate">{title}</div>
        </div>
        <button type="button" aria-label="Collapse sidebar" onClick={onToggle}
          className="flex items-center justify-center rounded-lg size-10 min-w-10 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300 transition-colors mr-1">
          <ChevronDownIcon size={16} className="-rotate-90" />
        </button>
      </div>
    </div>
  );
}

function MenuRow({ item, collapsed, isActive }: {
  item: ConfigMenuItem; collapsed: boolean; isActive: boolean;
}) {
  const Icon = item.icon as React.FC<{ className?: string; size?: number }> | undefined;
  const inner = (
    <div
      className={cn(
        "rounded-lg cursor-pointer flex items-center transition-all duration-500",
        isActive ? "bg-neutral-800" : "hover:bg-neutral-800",
        collapsed ? "w-10 min-w-10 h-10 justify-center p-2" : "w-full h-10 px-3",
      )}
      style={{ transitionTimingFunction: softSpringEasing }}
      title={collapsed ? item.label : undefined}
    >
      <div className="flex items-center justify-center shrink-0">
        {Icon ? <Icon className="h-4 w-4 text-neutral-50" size={16} /> : <span className="size-2 rounded-full bg-neutral-500" />}
      </div>
      <div className={cn("flex-1 transition-opacity duration-500 overflow-hidden",
        collapsed ? "opacity-0 w-0" : "opacity-100 ml-3")}>
        <div className="text-[14px] text-neutral-50 leading-[20px] truncate flex items-center gap-2">
          <span className="truncate">{item.label}</span>
          {item.beta && (
            <span className="rounded bg-neutral-700 text-neutral-200 text-[10px] px-1.5 py-0.5 uppercase tracking-wide">beta</span>
          )}
          {item.new && (
            <span className="rounded bg-orange-500/20 text-orange-300 text-[10px] px-1.5 py-0.5 uppercase tracking-wide">new</span>
          )}
        </div>
      </div>
    </div>
  );
  if (item.href) {
    return <Link href={item.href} className="block w-full">{inner}</Link>;
  }
  return inner;
}

function SectionBlock({ section, collapsed, pathname, query }: {
  section: Section; collapsed: boolean; pathname: string | null; query: string;
}) {
  const filtered = useMemo(() => {
    if (!query.trim()) return section.items;
    const q = query.toLowerCase();
    return section.items.filter((i) => i.label.toLowerCase().includes(q));
  }, [section.items, query]);

  if (filtered.length === 0 && query.trim()) return null;

  return (
    <div className="flex flex-col w-full">
      <div className={cn("transition-all duration-500 overflow-hidden",
        collapsed ? "h-0 opacity-0" : "h-9 opacity-100")}>
        <div className="flex items-center h-9 px-3">
          <div className="text-[12px] uppercase tracking-wide text-neutral-400 font-medium">
            {section.title}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 w-full">
        {filtered.map((item) => (
          <MenuRow
            key={`${section.title}-${item.label}-${item.href ?? ""}`}
            item={item}
            collapsed={collapsed}
            isActive={!!(item.href && pathname && (item.exact ? pathname === item.href : pathname.startsWith(item.href)))}
          />
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ active, collapsed, onToggleCollapse }: {
  active: string; collapsed: boolean; onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const sections = useMemo<Section[]>(
    () => moduleSections[active] ?? [{ title: "Module", items: [{ label: "Coming soon", href: "#" }] }],
    [active],
  );
  const title = moduleTitles[active] ?? "Module";

  return (
    <aside
      className={cn(
        "bg-black flex flex-col gap-3 items-start p-3 transition-all duration-500 min-h-screen border-r border-neutral-800",
        collapsed ? "w-16 min-w-16 !px-0" : "w-72 lg:w-80",
      )}
      style={{ transitionTimingFunction: softSpringEasing }}
    >
      {!collapsed && <BrandBadge />}
      <SectionTitle title={title} collapsed={collapsed} onToggle={onToggleCollapse} />
      <SearchBar collapsed={collapsed} value={query} onChange={setQuery} />

      <ScrollArea className="w-full flex-1">
        <div className={cn("flex flex-col w-full transition-all duration-500",
          collapsed ? "gap-1 items-center" : "gap-3 items-start")}>
          {sections.map((s, i) => (
            <SectionBlock key={`${active}-${i}`} section={s} collapsed={collapsed} pathname={pathname} query={query} />
          ))}
          {sections.every((s) => s.items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())).length === 0) && query && (
            <div className="text-[12px] text-neutral-500 px-3 py-2">No matches for &ldquo;{query}&rdquo;.</div>
          )}
        </div>
      </ScrollArea>

      {!collapsed && (
        <div className="w-full pt-2 border-t border-neutral-800">
          <Link href="/dashboard/profile" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-neutral-900">
            <AvatarCircle />
            <div className="text-[14px] text-neutral-50">Account</div>
          </Link>
        </div>
      )}
    </aside>
  );
}

/* ── Composite (desktop) + responsive (mobile drawer) ───────────────── */

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

export function SabNodeTwoLineSidebar() {
  const pathname = usePathname();
  const active = useMemo(() => detectActiveModule(pathname), [pathname]);
  const [collapsed, setCollapsed] = useState(false);

  // hydrate persisted collapsed state
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
    <div className="hidden lg:flex flex-row min-h-screen">
      <IconRail active={active} />
      <DetailPanel active={active} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
    </div>
  );
}

/** Mobile entry: a single hamburger button that opens both rails inside a Sheet. */
export function SabNodeTwoLineSidebarMobile() {
  const pathname = usePathname();
  const active = useMemo(() => detectActiveModule(pathname), [pathname]);
  const [open, setOpen] = useState(false);

  // close drawer on route change
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
            className="fixed top-3 left-3 z-40 inline-flex items-center justify-center rounded-md bg-black text-neutral-50 size-9 shadow-lg border border-neutral-800"
          >
            <MenuIcon size={18} />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[336px] bg-black border-r border-neutral-800">
          <SheetTitle className="sr-only">SabNode navigation</SheetTitle>
          <div className="flex flex-row h-full">
            <IconRail active={active} />
            <DetailPanel active={active} collapsed={false} onToggleCollapse={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Convenience: render both desktop and mobile in one component. */
export function SabNodeSidebar() {
  return (
    <>
      <SabNodeTwoLineSidebar />
      <SabNodeTwoLineSidebarMobile />
    </>
  );
}

/** Centred preview frame used by the demo route. */
export function Frame760() {
  return (
    <div className="bg-[#1a1a1a] min-h-screen flex">
      <SabNodeSidebar />
      <main className="flex-1 p-6 text-neutral-200">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold text-neutral-50 mb-2">SabNode two-line sidebar</h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Left rail = every module from <code>appIcons</code>. Right rail = the active module&rsquo;s
            full menu, drawn live from <code>src/config/dashboard-config.ts</code>. Click any icon to
            navigate to that module; the active module auto-detects from the URL. Collapse, search,
            mobile drawer, beta/new badges, and persistent collapsed state are all wired in.
          </p>
        </div>
      </main>
    </div>
  );
}

export default Frame760;
