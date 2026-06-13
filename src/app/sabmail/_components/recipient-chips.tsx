"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractEmail(token: string): string {
  // Accept "Name <a@b.com>" or "a@b.com".
  const m = token.match(/<([^>]+)>/);
  return (m ? m[1] : token).trim();
}

/** A token/chip recipient field (To/Cc/Bcc). Enter/Tab/comma commits; paste splits. */
export function RecipientChips({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commit = React.useCallback(
    (raw: string) => {
      const parts = raw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length === 0) return;
      const next = [...value];
      for (const p of parts) {
        if (!next.includes(p)) next.push(p);
      }
      onChange(next);
      setDraft("");
    },
    [value, onChange],
  );

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="flex items-start gap-2 border-b border-[var(--st-border)] px-1 py-2">
      <span className="mt-1.5 w-10 shrink-0 text-xs font-medium text-[var(--st-text-secondary)]">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {value.map((r, i) => {
          const valid = EMAIL_RE.test(extractEmail(r));
          return (
            <span
              key={`${r}-${i}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                valid
                  ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                  : "bg-[color-mix(in_srgb,var(--st-status-err,#dc2626)_14%,transparent)] text-[var(--st-status-err,#dc2626)]",
              )}
            >
              <span className="max-w-[200px] truncate">{r}</span>
              <button
                type="button"
                aria-label={`Remove ${r}`}
                onClick={() => remove(i)}
                className="opacity-70 hover:opacity-100"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={draft}
          autoFocus={autoFocus}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
              if (draft.trim()) {
                e.preventDefault();
                commit(draft);
              }
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              remove(value.length - 1);
            }
          }}
          onBlur={() => draft.trim() && commit(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,;\s]/.test(text)) {
              e.preventDefault();
              commit(text);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[140px] flex-1 bg-transparent py-1 text-sm text-[var(--st-text)] outline-none placeholder:text-[var(--st-text-secondary)]"
        />
      </div>
    </div>
  );
}
