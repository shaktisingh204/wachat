"use client";

/**
 * SabCall ⌘K command palette.
 *
 * A keyboard-first launcher mounted once inside the SabCall shell so it is
 * available on every `/sabcall/*` page. Cmd/Ctrl+K toggles it open; Escape
 * closes it (Radix's Dialog owns the focus trap + Escape contract). The list
 * is a case-insensitive substring filter over the SabCall navigation
 * destinations, plus a contextual "Call <number>" action that appears when the
 * typed query looks like a phone number.
 *
 * Self-contained on purpose: the nav destinations are inlined here rather than
 * imported from the sidebar config, so this file is the only one that owns the
 * palette's command set.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  Dialog,
  DialogContent,
  Input,
  useToast,
} from "@/components/sabcrm/20ui";

import { placeCall } from "../conversations/actions";

interface NavCommand {
  id: string;
  label: string;
  href: string;
  hint?: string;
}

/**
 * Every SabCall destination, in the order the prompt lists them. Inlined so the
 * palette stays self-contained (the sidebar config is intentionally untouched).
 */
const NAV_COMMANDS: NavCommand[] = [
  { id: "overview", label: "Overview", href: "/sabcall", hint: "Dashboard" },
  { id: "conversations", label: "Conversations", href: "/sabcall/conversations" },
  { id: "contacts", label: "Contacts", href: "/sabcall/contacts" },
  { id: "agent-console", label: "Agent console", href: "/sabcall/agent-console" },
  { id: "voicemail", label: "Voicemail", href: "/sabcall/voicemail" },
  { id: "broadcast", label: "Voice broadcast", href: "/sabcall/broadcast" },
  { id: "dids", label: "Phone numbers", href: "/sabcall/dids" },
  { id: "ivr", label: "IVR flows", href: "/sabcall/ivr" },
  { id: "queues", label: "Call queues", href: "/sabcall/queues" },
  { id: "applications", label: "Applications", href: "/sabcall/applications" },
  { id: "trunks", label: "SIP trunks", href: "/sabcall/trunks" },
  { id: "domains", label: "SIP domains", href: "/sabcall/domains" },
  { id: "credentials", label: "SIP credentials", href: "/sabcall/credentials" },
  { id: "acls", label: "Access control", href: "/sabcall/acls" },
  { id: "ring-groups", label: "Ring groups", href: "/sabcall/ring-groups" },
  { id: "business-hours", label: "Business hours", href: "/sabcall/business-hours" },
  { id: "projects", label: "Projects", href: "/sabcall/projects" },
];

/** A typed query "looks like a number" if it starts with + or is mostly digits. */
function looksLikePhoneNumber(raw: string): boolean {
  const q = raw.trim();
  if (q.length < 3) return false;
  if (q.startsWith("+")) {
    return /^\+[\d\s().-]{2,}$/.test(q) && (q.match(/\d/g)?.length ?? 0) >= 3;
  }
  const digits = q.match(/\d/g)?.length ?? 0;
  const nonSpaceNonDigit = q.replace(/[\s().+-]/g, "").replace(/\d/g, "").length;
  // Mostly digits: at least 3 digits and no stray letters.
  return digits >= 3 && nonSpaceNonDigit === 0;
}

export function CommandPalette(): React.JSX.Element {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [calling, setCalling] = React.useState(false);

  // Global Cmd/Ctrl+K toggles the palette open/closed. Radix handles Escape.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset transient state each time the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const showCall = looksLikePhoneNumber(query);

  const filteredNav = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_COMMANDS;
    return NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  // Flat, ordered list of runnable rows: the call action (when applicable)
  // first, then the matching nav destinations.
  type Row =
    | { kind: "call"; key: string; number: string }
    | { kind: "nav"; key: string; command: NavCommand };

  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    if (showCall) {
      out.push({ kind: "call", key: "__call__", number: query.trim() });
    }
    for (const c of filteredNav) {
      out.push({ kind: "nav", key: c.id, command: c });
    }
    return out;
  }, [showCall, query, filteredNav]);

  // Keep the active index in range as the list shrinks/grows.
  React.useEffect(() => {
    setActive((i) => (rows.length === 0 ? 0 : Math.min(i, rows.length - 1)));
  }, [rows.length]);

  const navigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const doCall = React.useCallback(
    async (number: string) => {
      if (calling) return;
      setCalling(true);
      try {
        const res = await placeCall(number);
        if (res.success) {
          setOpen(false);
          toast({
            title: "Calling…",
            description: `Placing a call to ${number}.`,
            tone: "success",
          });
        } else {
          toast({
            title: "Could not place the call",
            description: res.error,
            variant: "destructive",
          });
        }
      } finally {
        setCalling(false);
      }
    },
    [calling, toast],
  );

  const runRow = React.useCallback(
    (row: Row) => {
      if (row.kind === "call") {
        void doCall(row.number);
      } else {
        navigate(row.command.href);
      }
    },
    [doCall, navigate],
  );

  const onInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[active];
        if (row) runRow(row);
      }
    },
    [rows, active, runRow],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-lg p-0"
        hideClose
        aria-label="SabCall command palette"
      >
        <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-3 py-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search SabCall or type a number to call…"
            autoFocus
            aria-label="Command palette search"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
              No commands match “{query}”.
            </div>
          ) : (
            <ul role="listbox" aria-label="Commands" className="px-1">
              {rows.map((row, i) => {
                const isActive = i === active;
                const base =
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm";
                const stateCls = isActive
                  ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                  : "text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]";

                if (row.kind === "call") {
                  return (
                    <li key={row.key} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        className={`${base} ${stateCls}`}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => runRow(row)}
                        disabled={calling}
                      >
                        <span className="truncate">
                          Call <span className="font-medium">{row.number}</span>
                        </span>
                        <Badge tone="success" kind="soft" className="shrink-0">
                          {calling ? "Calling…" : "Action"}
                        </Badge>
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={row.key} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      className={`${base} ${stateCls}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => runRow(row)}
                    >
                      <span className="truncate">{row.command.label}</span>
                      {row.command.hint ? (
                        <Badge tone="neutral" kind="outline" className="shrink-0">
                          {row.command.hint}
                        </Badge>
                      ) : (
                        <span className="shrink-0 text-xs text-[var(--st-text-secondary)]">
                          Go
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--st-border)] px-3 py-2 text-xs text-[var(--st-text-secondary)]">
          <span>Navigate with ↑ ↓ · Enter to run</span>
          <span>⌘K to toggle · Esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
