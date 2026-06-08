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
import { renderIcon, type IconProp } from "../_icon";
import { Avatar, SabAvatarFallback, SabAvatarImage } from "./avatar";
import {
  DropdownMenu,
  SabDropdownMenuContent,
  SabDropdownMenuItem,
  SabDropdownMenuLabel,
  SabDropdownMenuSeparator,
  SabDropdownMenuTrigger,
} from "./dropdown-menu";

export interface SabUserDropdownItem {
  id: string;
  label: React.ReactNode;
  icon?: IconProp;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
}

export interface SabUserDropdownProps {
  name: React.ReactNode;
  email?: React.ReactNode;
  /** Avatar image URL. */
  avatarUrl?: string;
  /** Avatar fallback (initials). Auto-derived from `name` if a string. */
  initials?: string;
  /** Items rendered above the divider. Defaults to Profile / Settings / Billing. */
  items?: SabUserDropdownItem[];
  /** Items rendered below the divider — typically a sign-out. */
  footerItems?: SabUserDropdownItem[];
  /** Compact mode hides the name beside the avatar. */
  compact?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
}

const DEFAULT_ITEMS: SabUserDropdownItem[] = [
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

const DEFAULT_FOOTER: SabUserDropdownItem[] = [
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

function DropdownItem({ item }: { item: SabUserDropdownItem }) {
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
      <SabDropdownMenuItem asChild destructive={item.destructive}>
        <Link href={item.href} onSelect={handleSelect as never}>
          {renderIcon(item.icon)}
          <span>{item.label}</span>
        </Link>
      </SabDropdownMenuItem>
    );
  }

  return (
    <SabDropdownMenuItem
      destructive={item.destructive}
      onSelect={handleSelect}
    >
      {renderIcon(item.icon)}
      <span>{item.label}</span>
    </SabDropdownMenuItem>
  );
}

export function SabUserDropdown({
  name,
  email,
  avatarUrl,
  initials,
  items = DEFAULT_ITEMS,
  footerItems = DEFAULT_FOOTER,
  compact,
  align = "end",
  className,
}: SabUserDropdownProps) {
  const fallback = initials ?? deriveInitials(name);

  return (
    <DropdownMenu>
      <SabDropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full p-1 pr-2 text-sm text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-muted)] focus-visible:outline-none",
            compact && "pr-1",
            className,
          )}
        >
          <Avatar>
            {avatarUrl && <SabAvatarImage src={avatarUrl} alt="" />}
            <SabAvatarFallback>{fallback}</SabAvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="hidden text-left sm:flex sm:flex-col sm:items-start sm:leading-tight">
                <span className="text-sm font-medium">{name}</span>
                {email && (
                  <span className="text-[11px] text-[var(--st-text-secondary)]">{email}</span>
                )}
              </span>
              <ChevronDown className="hidden h-3 w-3 text-[var(--st-text-secondary)] sm:inline-block" />
            </>
          )}
        </button>
      </SabDropdownMenuTrigger>
      <SabDropdownMenuContent align={align} className="w-56">
        <SabDropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium normal-case tracking-normal text-[var(--st-text)]">
              {name}
            </span>
            {email && (
              <span className="text-[11px] normal-case tracking-normal text-[var(--st-text-secondary)]">
                {email}
              </span>
            )}
          </div>
        </SabDropdownMenuLabel>
        <SabDropdownMenuSeparator />
        {items.map((item) => (
          <DropdownItem key={item.id} item={item} />
        ))}
        {footerItems.length > 0 && (
          <>
            <SabDropdownMenuSeparator />
            {footerItems.map((item) => (
              <DropdownItem key={item.id} item={item} />
            ))}
          </>
        )}
      </SabDropdownMenuContent>
    </DropdownMenu>
  );
}

function deriveInitials(name: React.ReactNode): string {
  if (typeof name !== "string") return "·";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}
