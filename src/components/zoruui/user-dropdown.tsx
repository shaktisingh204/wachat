"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  CreditCard,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";

import { cn } from "./lib/cn";
import { Avatar, ZoruAvatarFallback, ZoruAvatarImage } from "./avatar";
import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from "./dropdown-menu";

export interface ZoruUserDropdownItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
}

export interface ZoruUserDropdownProps {
  name: React.ReactNode;
  email?: React.ReactNode;
  /** Avatar image URL. */
  avatarUrl?: string;
  /** Avatar fallback (initials). Auto-derived from `name` if a string. */
  initials?: string;
  /** Items rendered above the divider. Defaults to Profile / Settings / Billing. */
  items?: ZoruUserDropdownItem[];
  /** Items rendered below the divider — typically a sign-out. */
  footerItems?: ZoruUserDropdownItem[];
  /** Compact mode hides the name beside the avatar. */
  compact?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
}

const DEFAULT_ITEMS: ZoruUserDropdownItem[] = [
  {
    id: "profile",
    label: "Profile",
    icon: <UserIcon />,
    href: "/dashboard/settings/profile",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings />,
    href: "/dashboard/settings",
  },
  {
    id: "billing",
    label: "Billing",
    icon: <CreditCard />,
    href: "/dashboard/settings/billing",
  },
];

const DEFAULT_FOOTER: ZoruUserDropdownItem[] = [
  {
    id: "sign-out",
    label: "Sign out",
    icon: <LogOut />,
    href: "/api/auth/logout",
    destructive: true,
  },
];

function isExternalHref(href: string): boolean {
  // /api/* logouts should hit the server route via a hard nav so the cookie
  // clears + the server can redirect; treat them as "external" for this menu.
  return (
    /^https?:\/\//.test(href) ||
    href.startsWith("//") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("/api/")
  );
}

function DropdownItem({ item }: { item: ZoruUserDropdownItem }) {
  const handleSelect = (e: Event) => {
    item.onSelect?.();
    if (item.href && isExternalHref(item.href)) {
      e.preventDefault();
      window.location.href = item.href;
    }
    // For internal hrefs the wrapping <Link> handles navigation natively,
    // so we let Radix close the menu and the click bubble.
  };

  if (item.href && !isExternalHref(item.href)) {
    return (
      <ZoruDropdownMenuItem asChild destructive={item.destructive}>
        <Link href={item.href} onSelect={handleSelect as never}>
          {item.icon}
          <span>{item.label}</span>
        </Link>
      </ZoruDropdownMenuItem>
    );
  }

  return (
    <ZoruDropdownMenuItem
      destructive={item.destructive}
      onSelect={handleSelect}
    >
      {item.icon}
      <span>{item.label}</span>
    </ZoruDropdownMenuItem>
  );
}

export function ZoruUserDropdown({
  name,
  email,
  avatarUrl,
  initials,
  items = DEFAULT_ITEMS,
  footerItems = DEFAULT_FOOTER,
  compact,
  align = "end",
  className,
}: ZoruUserDropdownProps) {
  const fallback = initials ?? deriveInitials(name);

  return (
    <DropdownMenu>
      <ZoruDropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full p-1 pr-2 text-sm text-zoru-ink transition-colors hover:bg-zoru-surface-2 focus-visible:outline-none",
            compact && "pr-1",
            className,
          )}
        >
          <Avatar>
            {avatarUrl && <ZoruAvatarImage src={avatarUrl} alt="" />}
            <ZoruAvatarFallback>{fallback}</ZoruAvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="hidden text-left sm:flex sm:flex-col sm:items-start sm:leading-tight">
                <span className="text-sm font-medium">{name}</span>
                {email && (
                  <span className="text-[11px] text-zoru-ink-muted">{email}</span>
                )}
              </span>
              <ChevronDown className="hidden h-3 w-3 text-zoru-ink-muted sm:inline-block" />
            </>
          )}
        </button>
      </ZoruDropdownMenuTrigger>
      <ZoruDropdownMenuContent align={align} className="w-56">
        <ZoruDropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium normal-case tracking-normal text-zoru-ink">
              {name}
            </span>
            {email && (
              <span className="text-[11px] normal-case tracking-normal text-zoru-ink-muted">
                {email}
              </span>
            )}
          </div>
        </ZoruDropdownMenuLabel>
        <ZoruDropdownMenuSeparator />
        {items.map((item) => (
          <DropdownItem key={item.id} item={item} />
        ))}
        {footerItems.length > 0 && (
          <>
            <ZoruDropdownMenuSeparator />
            {footerItems.map((item) => (
              <DropdownItem key={item.id} item={item} />
            ))}
          </>
        )}
      </ZoruDropdownMenuContent>
    </DropdownMenu>
  );
}

function deriveInitials(name: React.ReactNode): string {
  if (typeof name !== "string") return "·";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}
