"use client";

/**
 * SabWaSubRail — left navigation for the `/sabwa` module.
 *
 * Behaviour:
 *  - `md:` and up — an always-visible rail. Width toggles between an
 *    icon-only column (`w-14`) and a labelled column (`w-60`) via the
 *    collapse button at the bottom.
 *  - `<md` — rail is hidden; instead a hamburger button (fixed top-left)
 *    opens a full nav drawer via `<Sheet>`.
 *
 * Active item highlight is driven by `usePathname()`. Nav tree mirrors
 * section 6 ("Module nav") of SABWA_PLAN.md and is grouped by section.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AtSign,
  BarChart3,
  Bell,
  BookMarked,
  Bot,
  Boxes,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cog,
  Database,
  FileText,
  Filter,
  Gauge,
  Inbox,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Menu,
  PhoneCall,
  PlaySquare,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Users,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";

import {
  Button,
  ScrollArea,
  Sheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  cn,
} from "@/components/sabcrm/20ui/zoru";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "inbox",
    label: "Inbox & chats",
    items: [
      { href: "/sabwa", label: "Overview", icon: LayoutDashboard },
      { href: "/sabwa/inbox", label: "Inbox", icon: Inbox },
      { href: "/sabwa/chats", label: "Chats", icon: MessageSquare },
    ],
  },
  {
    id: "groups",
    label: "Groups",
    items: [
      { href: "/sabwa/groups", label: "All groups", icon: Users },
      {
        href: "/sabwa/groups/categories",
        label: "By category",
        icon: Filter,
      },
    ],
  },
  {
    id: "outbound",
    label: "Outbound",
    items: [
      { href: "/sabwa/broadcasts", label: "Broadcasts", icon: Megaphone },
      { href: "/sabwa/bulk", label: "Bulk sender", icon: Send },
      { href: "/sabwa/scheduler", label: "Scheduler", icon: Calendar },
      {
        href: "/sabwa/scheduler/queue",
        label: "Scheduler queue",
        icon: ClipboardList,
      },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { href: "/sabwa/contacts", label: "Contacts", icon: AtSign },
      { href: "/sabwa/templates", label: "Templates", icon: FileText },
      {
        href: "/sabwa/quick-replies",
        label: "Quick replies",
        icon: Zap,
      },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    items: [
      { href: "/sabwa/auto-reply", label: "Auto-reply", icon: Bot },
      { href: "/sabwa/flows", label: "Chatbot flows", icon: Workflow },
      { href: "/sabwa/ai", label: "AI assistant", icon: Sparkles },
    ],
  },
  {
    id: "media",
    label: "Media",
    items: [
      { href: "/sabwa/media", label: "Media library", icon: ImageIcon },
      { href: "/sabwa/status", label: "Status / Stories", icon: PlaySquare },
      { href: "/sabwa/calls", label: "Calls", icon: PhoneCall },
    ],
  },
  {
    id: "organization",
    label: "Organization",
    items: [
      { href: "/sabwa/labels", label: "Labels", icon: Tag },
      { href: "/sabwa/starred", label: "Starred", icon: Star },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/sabwa/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/sabwa/export", label: "Export / Backup", icon: Database },
      { href: "/sabwa/audit", label: "Audit log", icon: ShieldCheck },
    ],
  },
  {
    id: "connections",
    label: "Connections",
    items: [
      { href: "/sabwa/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/sabwa/api-keys", label: "API keys", icon: KeyRound },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { href: "/sabwa/settings", label: "Settings", icon: Settings },
      { href: "/sabwa/devices", label: "Linked devices", icon: Boxes },
      {
        href: "/sabwa/settings/rate-limits",
        label: "Rate limits",
        icon: Gauge,
      },
      {
        href: "/sabwa/settings/notifications",
        label: "Notifications",
        icon: Bell,
      },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/sabwa") return pathname === "/sabwa";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavBodyProps {
  pathname: string;
  /** When true, hide labels (icon-only rail). */
  collapsed?: boolean;
  /** Called when a nav item is selected (used to close the mobile sheet). */
  onNavigate?: () => void;
}

function NavBody({ pathname, collapsed = false, onNavigate }: NavBodyProps) {
  return (
    <ScrollArea className="flex-1">
      <nav
        aria-label="SabWa navigation"
        className={cn("flex flex-col gap-4 px-2 py-3", collapsed && "px-1")}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="flex flex-col gap-1">
            {!collapsed ? (
              <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]/80">
                {section.label}
              </p>
            ) : (
              <div className="mx-2 my-1 h-px bg-[var(--st-border)]/60" aria-hidden />
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-[var(--st-radius)] px-2 py-1.5 text-sm font-medium outline-none transition-colors",
                        "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]",
                        "focus-visible:ring-2 focus-visible:ring-[var(--st-text)] focus-visible:ring-offset-2",
                        active &&
                          "bg-[var(--st-text)]/10 text-[var(--st-text)] hover:bg-[var(--st-text)]/15 hover:text-[var(--st-text)]",
                        collapsed && "justify-center px-0 py-2",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active && "text-[var(--st-text)]",
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}

function RailBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "flex h-14 items-center gap-2 border-b border-[var(--st-border)] px-3",
        collapsed && "justify-center px-0",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-text)]/10 text-[var(--st-text)]">
        <MessageCircle className="h-4 w-4" />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-[var(--st-text)]">SabWa</p>
          <p className="truncate text-[11px] text-[var(--st-text-secondary)]">
            Personal WhatsApp
          </p>
        </div>
      )}
    </div>
  );
}

export function SabWaSubRail() {
  const pathname = usePathname() ?? "/sabwa";
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <>
      {/* Mobile: hamburger trigger fixed in the top-left, opens a Sheet */}
      <div className="fixed left-2 top-2 z-40 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <ZoruSheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open SabWa navigation"
              className="h-9 w-9"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </ZoruSheetTrigger>
          <ZoruSheetContent
            side="left"
            className="w-[88vw] max-w-[18rem] p-0 sm:max-w-[20rem]"
          >
            <ZoruSheetHeader className="sr-only">
              <ZoruSheetTitle>SabWa navigation</ZoruSheetTitle>
            </ZoruSheetHeader>
            <div className="flex h-full flex-col">
              <RailBrand collapsed={false} />
              <NavBody
                pathname={pathname}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </ZoruSheetContent>
        </Sheet>
      </div>

      {/* md+ : persistent rail */}
      <aside
        aria-label="SabWa sub navigation"
        data-collapsed={collapsed || undefined}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 md:flex",
          "transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <RailBrand collapsed={collapsed} />
        <NavBody pathname={pathname} collapsed={collapsed} />
        <div className="border-t border-[var(--st-border)] p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            className={cn(
              "w-full justify-start gap-2 text-[var(--st-text-secondary)]",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}

export default SabWaSubRail;
