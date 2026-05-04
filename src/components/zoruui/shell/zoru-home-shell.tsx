"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Briefcase,
  Globe,
  Home,
  Instagram,
  Link as LinkIcon,
  LogOut,
  Mail,
  Megaphone,
  QrCode,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Workflow,
} from "lucide-react";

import { cn } from "../lib/cn";
import { ZoruAppSidebar, type ZoruSidebarGroup } from "./zoru-app-sidebar";
import { ZoruDock, ZoruDockIcon } from "./zoru-dock";
import { ZoruHeader } from "./zoru-header";
import { ZoruInput } from "../input";
import { ZoruKbd } from "../kbd";
import { ZoruButton } from "../button";
import { ZoruUserDropdown } from "../user-dropdown";

export interface ZoruHomeShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  children: React.ReactNode;
}

interface DockApp {
  id: string;
  name: string;
  href: string;
  icon: React.ReactNode;
  isActive: (pathname: string | null) => boolean;
}

const DOCK_APPS: DockApp[] = [
  { id: "home", name: "Home", href: "/dashboard", icon: <Home className="h-5 w-5" />, isActive: (p) => p === "/dashboard" },
  { id: "wachat", name: "WaChat", href: "/wachat", icon: <Smartphone className="h-5 w-5" />, isActive: (p) => p === "/wachat" },
  { id: "sabflow", name: "SabFlow", href: "/dashboard/sabflow", icon: <Workflow className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/sabflow") },
  { id: "facebook", name: "Meta Suite", href: "/dashboard/facebook/all-projects", icon: <Globe className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/facebook") },
  { id: "ad-manager", name: "Ad Manager", href: "/dashboard/ad-manager/ad-accounts", icon: <Megaphone className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/ad-manager") },
  { id: "telegram", name: "Telegram", href: "/dashboard/telegram", icon: <Send className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/telegram") },
  { id: "instagram", name: "Instagram", href: "/dashboard/instagram/connections", icon: <Instagram className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/instagram") },
  { id: "crm", name: "CRM", href: "/dashboard/crm", icon: <Briefcase className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/crm") },
  { id: "email", name: "Email", href: "/dashboard/email", icon: <Mail className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/email") },
  { id: "sabchat", name: "SabChat", href: "/dashboard/sabchat", icon: <Bot className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/sabchat") },
  { id: "seo", name: "SEO Suite", href: "/dashboard/seo", icon: <Search className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/seo") },
  { id: "url", name: "URL Shortener", href: "/dashboard/url-shortener", icon: <LinkIcon className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/url-shortener") },
  { id: "qr", name: "QR Code", href: "/dashboard/qr-code-maker", icon: <QrCode className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/qr-code-maker") },
  { id: "settings", name: "Settings", href: "/dashboard/settings", icon: <Settings className="h-5 w-5" />, isActive: (p) => !!p?.startsWith("/dashboard/settings") },
];

/**
 * ZoruHomeShell — sidebar + header + main + dock. The vertical app
 * rail is intentionally absent; every app lives in the bottom dock
 * per the zoru directive. The URL-synced multi-tab strip is also
 * absent (hard constraint from the project plan).
 */
export function ZoruHomeShell({ user, plan, children }: ZoruHomeShellProps) {
  const pathname = usePathname();

  const sidebarGroups: ZoruSidebarGroup[] = [
    {
      id: "main",
      label: "Workspace",
      items: [
        { id: "home", label: "Home", icon: <Home />, href: "/dashboard", active: pathname === "/dashboard" },
        { id: "what's-new", label: "What's new", icon: <Sparkles />, href: "/dashboard" },
        { id: "notifications", label: "Notifications", icon: <Bell />, href: "/dashboard/notifications" },
      ],
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      items: [
        { id: "wachat", label: "WaChat inbox", icon: <Smartphone />, href: "/wachat" },
        { id: "sabflow", label: "Flows", icon: <Workflow />, href: "/dashboard/sabflow" },
        { id: "crm", label: "CRM", icon: <Briefcase />, href: "/dashboard/crm" },
      ],
    },
  ];

  const planFooter = plan?.name || plan?.credits !== undefined ? (
    <div className="flex flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zoru-ink">{plan?.name ?? "Free plan"}</span>
        {plan?.credits !== undefined && (
          <span className="text-[11px] text-zoru-ink-muted">
            {plan.credits.toLocaleString()} credits
          </span>
        )}
      </div>
      <ZoruButton size="sm" variant="outline" className="w-full" asChild>
        <a href="/dashboard/billing">Manage plan</a>
      </ZoruButton>
    </div>
  ) : null;

  return (
    <div className="zoruui flex h-screen w-full overflow-hidden bg-zoru-bg text-zoru-ink">
      <ZoruAppSidebar
        heading="Home"
        caption={user?.name ?? user?.email ?? "Workspace"}
        groups={sidebarGroups}
        footer={planFooter}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <ZoruHeader
          leading={
            <a
              href="/dashboard"
              aria-label="SabNode home"
              className="inline-flex items-center gap-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-ink text-xs text-zoru-on-primary">
                S
              </span>
              <span className="hidden text-sm text-zoru-ink sm:inline">
                SabNode
              </span>
            </a>
          }
          center={
            <ZoruInput
              placeholder="Search SabNode…"
              leadingSlot={<Search />}
              trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
            />
          }
          trailing={
            <>
              <ZoruButton variant="ghost" size="icon" aria-label="Notifications" asChild>
                <a href="/dashboard/notifications">
                  <Bell />
                </a>
              </ZoruButton>
              <ZoruUserDropdown
                name={user?.name ?? "Account"}
                email={user?.email ?? undefined}
                avatarUrl={user?.avatar ?? undefined}
                footerItems={[
                  {
                    id: "sign-out",
                    label: "Sign out",
                    icon: <LogOut />,
                    href: "/api/auth/signout",
                    destructive: true,
                  },
                ]}
              />
            </>
          }
        />

        <main className={cn("flex-1 overflow-y-auto px-6 py-6 pb-24")}>
          {children}
        </main>

        {/* Bottom-anchored, centered dock — every app lives here now. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center">
          <div className="pointer-events-auto rounded-[26px] border border-zoru-line bg-zoru-bg/95 p-1 shadow-[var(--zoru-shadow-lg)] backdrop-blur">
            <ZoruDock iconSize={48}>
              {DOCK_APPS.map((app) => (
                <ZoruDockIcon
                  key={app.id}
                  name={app.name}
                  href={app.href}
                  active={app.isActive(pathname)}
                >
                  {app.icon}
                </ZoruDockIcon>
              ))}
            </ZoruDock>
          </div>
        </div>
      </div>
    </div>
  );
}
