"use client";

/**
 * Two-line sidebar adapted for SabNode.
 *
 * Left rail  → all top-level modules from `appIcons` in `dashboard-config.ts`
 *               (Wachat, sabChat, Meta Suite, Ad Manager, Telegram, Instagram,
 *                CRM, HRM, SabFlow, Team, Email, SMS, API, Website, Links,
 *                QR Codes, SEO).
 * Right rail → menu items for whichever module is active, sourced from the
 *               same dashboard-config exports — so keeping the two in sync
 *               means editing one file (`src/config/dashboard-config.ts`).
 *
 * Layout / animation derived from the design supplied by the user; data and
 * routing come from sabnode's existing config so the sidebar is always
 * authoritative.
 */
import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search as SearchIcon,
  ChevronDown as ChevronDownIcon,
  User as UserIcon,
  Settings as SettingsIcon,
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

const softSpringEasing = "cubic-bezier(0.25, 1.1, 0.4, 1)";

/* ── Module → menu mapping ────────────────────────────────────────────── */

type Section = { title: string; items: ConfigMenuItem[] };

/** Telegram, Website-Builder, Portfolio etc. ship without their own menu in
 *  dashboard-config — we render a single "Open" link to the module landing page. */
function singleSection(label: string, href: string): Section[] {
  return [{ title: label, items: [{ label: "Open", href, icon: undefined }] }];
}

function asGroups(items: ConfigMenuItem[], title = "Menu"): Section[] {
  return [{ title, items }];
}

function fromGroups(groups: ConfigMenuGroup[]): Section[] {
  return groups.map((g) => ({ title: g.title, items: g.items }));
}

const moduleSections: Record<string, Section[]> = {
  whatsapp:        asGroups(wachatMenuItems, "Wachat"),
  sabchat:         asGroups(sabChatMenuItems, "sabChat"),
  facebook:        fromGroups(facebookMenuGroups),
  "ad-manager":    asGroups(adManagerMenuItems, "Ad Manager"),
  telegram:        singleSection("Telegram", "/dashboard/telegram"),
  instagram:       fromGroups(instagramMenuGroups),
  crm:             fromGroups(crmMenuGroups),
  hrm:             fromGroups(hrmMenuGroups),
  sabflow:         asGroups(sabflowMenuItems, "SabFlow"),
  team:            asGroups(teamMenuItems, "Team"),
  email:           asGroups(emailMenuItems, "Email"),
  sms:             asGroups(smsMenuItems, "SMS"),
  api:             asGroups(apiMenuItems, "API & Dev"),
  "website-builder": singleSection("Website Builder", "/dashboard/website-builder"),
  "url-shortener": asGroups(urlShortenerMenuItems, "Links"),
  "qr-code-maker": asGroups(qrCodeMakerMenuItems, "QR Codes"),
  "seo-suite":     asGroups(seoMenuItems, "SEO Suite"),
};

const moduleTitles: Record<string, string> = appIcons.reduce(
  (acc, m) => ({ ...acc, [m.id]: m.label }),
  {} as Record<string, string>,
);

/* ── Search input ─────────────────────────────────────────────────────── */

function SearchBar({ collapsed }: { collapsed: boolean }) {
  const [value, setValue] = useState("");
  return (
    <div
      className={`relative shrink-0 transition-all duration-500 ${collapsed ? "w-full flex justify-center" : "w-full"}`}
      style={{ transitionTimingFunction: softSpringEasing }}
    >
      <div
        className={`bg-black h-10 rounded-lg flex items-center transition-all duration-500 ${collapsed ? "w-10 min-w-10 justify-center" : "w-full"}`}
        style={{ transitionTimingFunction: softSpringEasing }}
      >
        <div className={`flex items-center justify-center shrink-0 ${collapsed ? "p-1" : "px-1"}`}>
          <div className="size-8 flex items-center justify-center">
            <SearchIcon size={16} className="text-neutral-50" />
          </div>
        </div>
        <div
          className={`flex-1 relative transition-opacity duration-500 overflow-hidden ${collapsed ? "opacity-0 w-0" : "opacity-100"}`}
          style={{ transitionTimingFunction: softSpringEasing }}
        >
          <input
            type="text"
            placeholder="Search modules…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            tabIndex={collapsed ? -1 : 0}
            className="w-full bg-transparent border-none outline-none text-[14px] text-neutral-50 placeholder:text-neutral-400 leading-[20px] py-1 pr-2"
          />
        </div>
        <div aria-hidden className="absolute inset-0 rounded-lg border border-neutral-800 pointer-events-none" />
      </div>
    </div>
  );
}

/* ── Brand badge ──────────────────────────────────────────────────────── */

function BrandBadge() {
  return (
    <div className="relative shrink-0 w-full">
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
    </div>
  );
}

/* ── Avatar ───────────────────────────────────────────────────────────── */

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

/* ── Left icon rail (modules) ─────────────────────────────────────────── */

function IconNavButton({
  active = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center rounded-lg size-10 min-w-10 transition-colors duration-500 ${
        active
          ? "bg-neutral-800 text-neutral-50"
          : "hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
      }`}
      style={{ transitionTimingFunction: softSpringEasing }}
    >
      {children}
    </button>
  );
}

function IconRail({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <aside className="bg-black flex flex-col gap-2 items-center p-4 w-16 min-h-[640px] border-r border-neutral-800 rounded-l-2xl">
      <div className="mb-2 size-10 flex items-center justify-center">
        <div className="size-6 rounded-md bg-neutral-50 flex items-center justify-center">
          <span className="text-black font-bold text-[11px]">S</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full items-center max-h-[520px] overflow-y-auto pr-0.5">
        {appIcons.map((mod) => {
          const Icon = mod.icon as React.FC<{ className?: string; size?: number }>;
          return (
            <IconNavButton
              key={mod.id}
              active={active === mod.id}
              onClick={() => onChange(mod.id)}
              title={mod.label}
            >
              <Icon className="h-4 w-4" size={16} />
            </IconNavButton>
          );
        })}
      </div>

      <div className="flex-1" />
      <div className="flex flex-col gap-2 w-full items-center">
        <IconNavButton
          active={active === "settings"}
          onClick={() => onChange("settings")}
          title="Settings"
        >
          <SettingsIcon size={16} />
        </IconNavButton>
        <div className="size-8">
          <AvatarCircle />
        </div>
      </div>
    </aside>
  );
}

/* ── Section title with collapse handle ──────────────────────────────── */

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
      <div className="w-full flex justify-center transition-all duration-500" style={{ transitionTimingFunction: softSpringEasing }}>
        <button
          type="button"
          aria-label="Expand sidebar"
          onClick={onToggle}
          className="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
          style={{ transitionTimingFunction: softSpringEasing }}
        >
          <span className="inline-block rotate-180">
            <ChevronDownIcon size={16} />
          </span>
        </button>
      </div>
    );
  }
  return (
    <div className="w-full overflow-hidden transition-all duration-500" style={{ transitionTimingFunction: softSpringEasing }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center h-10">
          <div className="px-2 py-1">
            <div className="font-semibold text-[18px] text-neutral-50 leading-[27px]">{title}</div>
          </div>
        </div>
        <div className="pr-1">
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={onToggle}
            className="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
            style={{ transitionTimingFunction: softSpringEasing }}
          >
            <ChevronDownIcon size={16} className="-rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Right rail menu rendering ───────────────────────────────────────── */

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
  const content = (
    <div
      className={`rounded-lg cursor-pointer flex items-center transition-all duration-500 ${
        isActive ? "bg-neutral-800" : "hover:bg-neutral-800"
      } ${collapsed ? "w-10 min-w-10 h-10 justify-center p-2" : "w-full h-10 px-3"}`}
      style={{ transitionTimingFunction: softSpringEasing }}
      title={collapsed ? item.label : undefined}
    >
      <div className="flex items-center justify-center shrink-0">
        {Icon ? <Icon className="h-4 w-4 text-neutral-50" size={16} /> : <span className="size-2 rounded-full bg-neutral-500" />}
      </div>
      <div
        className={`flex-1 transition-opacity duration-500 overflow-hidden ${collapsed ? "opacity-0 w-0" : "opacity-100 ml-3"}`}
        style={{ transitionTimingFunction: softSpringEasing }}
      >
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
    return (
      <Link href={item.href} className="block w-full">
        {content}
      </Link>
    );
  }
  return content;
}

function SectionBlock({
  section,
  collapsed,
  pathname,
}: {
  section: Section;
  collapsed: boolean;
  pathname: string | null;
}) {
  return (
    <div className="flex flex-col w-full">
      <div
        className={`relative shrink-0 w-full transition-all duration-500 overflow-hidden ${
          collapsed ? "h-0 opacity-0" : "h-9 opacity-100"
        }`}
        style={{ transitionTimingFunction: softSpringEasing }}
      >
        <div className="flex items-center h-9 px-3">
          <div className="text-[12px] uppercase tracking-wide text-neutral-400 font-medium">{section.title}</div>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 w-full">
        {section.items.map((item) => (
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

/* ── Right rail (detail panel) ───────────────────────────────────────── */

function DetailPanel({ active }: { active: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const sections = useMemo<Section[]>(
    () => moduleSections[active] ?? [{ title: "Module", items: [{ label: "Coming soon", href: "#" }] }],
    [active],
  );
  const title = moduleTitles[active] ?? "Settings";

  return (
    <aside
      className={`bg-black flex flex-col gap-3 items-start p-4 rounded-r-2xl transition-all duration-500 min-h-[640px] ${
        collapsed ? "w-16 min-w-16 !px-0 justify-center" : "w-80"
      }`}
      style={{ transitionTimingFunction: softSpringEasing }}
    >
      {!collapsed && <BrandBadge />}
      <SectionTitle title={title} collapsed={collapsed} onToggle={() => setCollapsed((s) => !s)} />
      <SearchBar collapsed={collapsed} />

      <div
        className={`flex flex-col w-full overflow-y-auto transition-all duration-500 max-h-[480px] ${
          collapsed ? "gap-1 items-center" : "gap-3 items-start"
        }`}
        style={{ transitionTimingFunction: softSpringEasing }}
      >
        {sections.map((s, i) => (
          <SectionBlock key={`${active}-${i}`} section={s} collapsed={collapsed} pathname={pathname} />
        ))}
      </div>

      {!collapsed && (
        <div className="w-full mt-auto pt-2 border-t border-neutral-800">
          <Link href="/dashboard/profile" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-neutral-900">
            <AvatarCircle />
            <div className="text-[14px] text-neutral-50">Account</div>
          </Link>
        </div>
      )}
    </aside>
  );
}

/* ── Composite + default export ──────────────────────────────────────── */

export function SabNodeTwoLineSidebar() {
  const [active, setActive] = useState<string>("whatsapp");
  return (
    <div className="flex flex-row">
      <IconRail active={active} onChange={setActive} />
      <DetailPanel active={active === "settings" ? "whatsapp" : active} />
    </div>
  );
}

export function Frame760() {
  return (
    <div className="bg-[#1a1a1a] min-h-screen flex items-center justify-center p-4">
      <SabNodeTwoLineSidebar />
    </div>
  );
}

export default Frame760;
