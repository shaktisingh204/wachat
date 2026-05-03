"use client";

import * as React from "react";
import {
  ChevronDown,
  CreditCard,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruAvatar, ZoruAvatarFallback, ZoruAvatarImage } from "./avatar";
import {
  ZoruDropdownMenu,
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
  { id: "profile", label: "Profile", icon: <UserIcon /> },
  { id: "settings", label: "Settings", icon: <Settings /> },
  { id: "billing", label: "Billing", icon: <CreditCard /> },
];

const DEFAULT_FOOTER: ZoruUserDropdownItem[] = [
  { id: "sign-out", label: "Sign out", icon: <LogOut />, destructive: true },
];

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
    <ZoruDropdownMenu>
      <ZoruDropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full p-1 pr-2 text-sm text-zoru-ink transition-colors hover:bg-zoru-surface-2 focus-visible:outline-none",
            compact && "pr-1",
            className,
          )}
        >
          <ZoruAvatar>
            {avatarUrl && <ZoruAvatarImage src={avatarUrl} alt="" />}
            <ZoruAvatarFallback>{fallback}</ZoruAvatarFallback>
          </ZoruAvatar>
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
          <ZoruDropdownMenuItem
            key={item.id}
            destructive={item.destructive}
            onSelect={(e) => {
              if (item.href) {
                e.preventDefault();
                window.location.href = item.href;
              }
              item.onSelect?.();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </ZoruDropdownMenuItem>
        ))}
        {footerItems.length > 0 && (
          <>
            <ZoruDropdownMenuSeparator />
            {footerItems.map((item) => (
              <ZoruDropdownMenuItem
                key={item.id}
                destructive={item.destructive}
                onSelect={(e) => {
                  if (item.href) {
                    e.preventDefault();
                    window.location.href = item.href;
                  }
                  item.onSelect?.();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </ZoruDropdownMenuItem>
            ))}
          </>
        )}
      </ZoruDropdownMenuContent>
    </ZoruDropdownMenu>
  );
}

function deriveInitials(name: React.ReactNode): string {
  if (typeof name !== "string") return "·";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}
