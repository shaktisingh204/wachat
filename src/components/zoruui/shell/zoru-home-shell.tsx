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
  Users,
  Workflow,
} from "lucide-react";

import { cn } from "../lib/cn";
import { ZoruAppRail, type ZoruAppRailItem } from "./zoru-app-rail";
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

/**
 * ZoruHomeShell — wires the generic zoruui shell pieces with the
 * SabNode app catalog. Drop into any /home-style route to render
 * rail + sidebar + header + dock + main.
 *
 * Crucially: NO TabsProvider / TabsBar (the URL-synced multi-tab
 * strip is intentionally absent in zoruui).
 */
export function ZoruHomeShell({ user, plan, children }: ZoruHomeShellProps) {
  const pathname = usePathname();

  const railItems: ZoruAppRailItem[] = [
    { id: "home", label: "Home", icon: <Home />, href: "/home", active: pathname === "/home" },
    { id: "sabflow", label: "SabFlow", icon: <Workflow />, href: "/dashboard/sabflow", active: pathname?.startsWith("/dashboard/sabflow") },
    { id: "wachat", label: "WaChat", icon: <Smartphone />, href: "/dashboard", active: pathname === "/dashboard" || pathname?.startsWith("/dashboard/contacts") },
    { id: "facebook", label: "Meta Suite", icon: <Globe />, href: "/dashboard/facebook/all-projects", active: pathname?.startsWith("/dashboard/facebook") },
    { id: "ad-manager", label: "Ad Manager", icon: <Megaphone />, href: "/dashboard/ad-manager/ad-accounts", active: pathname?.startsWith("/dashboard/ad-manager") },
    { id: "telegram", label: "Telegram", icon: <Send />, href: "/dashboard/telegram", active: pathname?.startsWith("/dashboard/telegram") },
    { id: "instagram", label: "Instagram", icon: <Instagram />, href: "/dashboard/instagram/connections", active: pathname?.startsWith("/dashboard/instagram") },
    { id: "crm", label: "CRM", icon: <Briefcase />, href: "/dashboard/crm", active: pathname?.startsWith("/dashboard/crm") },
    { id: "team", label: "Team", icon: <Users />, href: "/dashboard/team", active: pathname?.startsWith("/dashboard/team") },
    { id: "email", label: "Email", icon: <Mail />, href: "/dashboard/email", active: pathname?.startsWith("/dashboard/email") },
    { id: "sabchat", label: "SabChat", icon: <Bot />, href: "/dashboard/sabchat", active: pathname?.startsWith("/dashboard/sabchat") },
    { id: "seo", label: "SEO Suite", icon: <Search />, href: "/dashboard/seo", active: pathname?.startsWith("/dashboard/seo") },
    { id: "url", label: "URL Shortener", icon: <LinkIcon />, href: "/dashboard/url-shortener", active: pathname?.startsWith("/dashboard/url-shortener") },
    { id: "qr", label: "QR Code", icon: <QrCode />, href: "/dashboard/qr-code-maker", active: pathname?.startsWith("/dashboard/qr-code-maker") },
  ];

  const railFooter: ZoruAppRailItem[] = [
    { id: "settings", label: "Settings", icon: <Settings />, href: "/dashboard/settings", active: pathname?.startsWith("/dashboard/settings") },
  ];

  const sidebarGroups: ZoruSidebarGroup[] = [
    {
      id: "main",
      label: "Workspace",
      items: [
        { id: "home", label: "Home", icon: <Home />, href: "/home", active: pathname === "/home" },
        { id: "what's-new", label: "What's new", icon: <Sparkles />, href: "/home" },
        { id: "notifications", label: "Notifications", icon: <Bell />, href: "/dashboard/notifications" },
      ],
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      items: [
        { id: "wachat", label: "WaChat inbox", icon: <Smartphone />, href: "/dashboard" },
        { id: "sabflow", label: "Flows", icon: <Workflow />, href: "/dashboard/sabflow" },
        { id: "crm", label: "CRM", icon: <Briefcase />, href: "/dashboard/crm" },
      ],
    },
  ];

  const planFooter = plan?.name || plan?.credits !== undefined ? (
    <div className="flex flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zoru-ink">
          {plan?.name ?? "Free plan"}
        </span>
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
      <ZoruAppRail
        brand={
          <a
            href="/home"
            aria-label="SabNode home"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-ink text-xs font-semibold text-zoru-on-primary"
          >
            S
          </a>
        }
        items={railItems}
        footer={railFooter}
      />

      <ZoruAppSidebar
        heading="Home"
        caption={user?.name ?? user?.email ?? "Workspace"}
        groups={sidebarGroups}
        footer={planFooter}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ZoruHeader
          leading={
            <span className="text-sm font-medium text-zoru-ink">Home</span>
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

        <main className={cn("flex-1 overflow-y-auto px-6 py-6")}>
          {children}
        </main>

        <div className="flex justify-center border-t border-zoru-line bg-zoru-bg px-4 py-3">
          <ZoruDock iconSize={48}>
            <ZoruDockIcon name="Home" href="/home" active={pathname === "/home"}>
              <Home className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="WaChat" href="/dashboard" active={pathname === "/dashboard"}>
              <Smartphone className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="SabFlow" href="/dashboard/sabflow" active={!!pathname?.startsWith("/dashboard/sabflow")}>
              <Workflow className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="CRM" href="/dashboard/crm" active={!!pathname?.startsWith("/dashboard/crm")}>
              <Briefcase className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="Email" href="/dashboard/email" active={!!pathname?.startsWith("/dashboard/email")}>
              <Mail className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="Telegram" href="/dashboard/telegram" active={!!pathname?.startsWith("/dashboard/telegram")}>
              <Send className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="Instagram" href="/dashboard/instagram/connections" active={!!pathname?.startsWith("/dashboard/instagram")}>
              <Instagram className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="Ad Manager" href="/dashboard/ad-manager/ad-accounts" active={!!pathname?.startsWith("/dashboard/ad-manager")}>
              <Megaphone className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="SEO Suite" href="/dashboard/seo" active={!!pathname?.startsWith("/dashboard/seo")}>
              <Search className="h-5 w-5" />
            </ZoruDockIcon>
            <ZoruDockIcon name="Settings" href="/dashboard/settings" active={!!pathname?.startsWith("/dashboard/settings")}>
              <Settings className="h-5 w-5" />
            </ZoruDockIcon>
          </ZoruDock>
        </div>
      </div>
    </div>
  );
}
