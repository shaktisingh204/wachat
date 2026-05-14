"use client";

/**
 * SessionSwitcher — Phase 0 placeholder for the SabWa top-bar session
 * picker. Displays the "currently selected" SabWa session (number +
 * status badge) and a "Switch session" Popover listing fake entries
 * marked "Coming soon".
 *
 * TODO (Phase 1): Wire this to the real `sabwa_sessions` collection.
 *  - Read project sessions via a server action (`listSessions(projectId)`).
 *  - Use the session's `phoneE164`, `pushName`, and `status` from Mongo.
 *  - Persist active session per-tab (sessionStorage) + per-project
 *    (cookie or user pref) so the inbox/groups pages stay in sync.
 *  - Hook the "Connect another number" CTA to `/sabwa/connect`.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown, Plus, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SessionStatus = "connected" | "pending" | "logged_out" | "error";

interface SessionStub {
  id: string;
  label: string;
  phone: string;
  status: SessionStatus;
}

// TODO (Phase 1): replace with real data from `listSessions(projectId)`.
const PLACEHOLDER_SESSION: SessionStub = {
  id: "stub-primary",
  label: "Primary number",
  phone: "+91 •••• ••••••",
  status: "pending",
};

const PLACEHOLDER_OTHER_SESSIONS: SessionStub[] = [
  {
    id: "stub-secondary",
    label: "Secondary number",
    phone: "+91 •••• ••••••",
    status: "pending",
  },
  {
    id: "stub-team",
    label: "Team broadcaster",
    phone: "+91 •••• ••••••",
    status: "pending",
  },
];

function statusBadgeVariant(
  status: SessionStatus,
): "secondary" | "success" | "warning" | "destructive" {
  switch (status) {
    case "connected":
      return "success";
    case "pending":
      return "warning";
    case "error":
      return "destructive";
    case "logged_out":
    default:
      return "secondary";
  }
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "pending":
      return "Pending";
    case "error":
      return "Error";
    case "logged_out":
    default:
      return "Disconnected";
  }
}

export function SessionSwitcher() {
  const [open, setOpen] = React.useState(false);
  const active = PLACEHOLDER_SESSION;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Switch SabWa session"
          className="h-9 gap-2 px-2.5"
        >
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </span>
          <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
            <span className="truncate text-xs font-medium">{active.label}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {active.phone}
            </span>
          </span>
          <Badge
            variant={statusBadgeVariant(active.status)}
            className="ml-1 px-1.5 py-0 text-[10px]"
          >
            {statusLabel(active.status)}
          </Badge>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Switch session
        </p>
        <ul className="flex flex-col gap-0.5">
          {PLACEHOLDER_OTHER_SESSIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled
                aria-disabled
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm",
                  "cursor-not-allowed opacity-60",
                )}
              >
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-xs font-medium">
                    {s.label}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {s.phone}
                  </span>
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  Coming soon
                </Badge>
              </button>
            </li>
          ))}
        </ul>
        <div className="my-2 h-px bg-border" aria-hidden />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setOpen(false)}
        >
          <Link href="/sabwa/connect">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Connect another number</span>
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default SessionSwitcher;
