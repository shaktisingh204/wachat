"use client";

import * as React from "react";
import { Pipette } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruButton } from "./button";
import { ZoruInput } from "./input";
import {
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
} from "./popover";

export interface ZoruColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  /** Optional preset palette displayed in the popover. */
  presets?: string[];
  /** Pixel size of the trigger swatch. Defaults to 28. */
  swatchSize?: number;
  className?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
}

const DEFAULT_PRESETS = [
  "#0F0F10",
  "#3F3F46",
  "#71717A",
  "#A1A1AA",
  "#D4D4D8",
  "#FFFFFF",
  "#DC2626",
  "#EA580C",
  "#D97706",
  "#65A30D",
  "#059669",
  "#0891B2",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
];

export function ZoruColorPicker({
  value = "#000000",
  onChange,
  presets = DEFAULT_PRESETS,
  swatchSize = 28,
  className,
  disabled,
  align = "start",
}: ZoruColorPickerProps) {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => setDraft(value), [value]);

  const commit = (next: string) => {
    setDraft(next);
    onChange?.(next);
  };

  return (
    <ZoruPopover>
      <ZoruPopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Pick a color (current: ${value})`}
          className={cn(
            "inline-flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-2 py-1.5 text-sm text-zoru-ink transition-colors hover:border-zoru-line-strong",
            disabled && "cursor-not-allowed opacity-50",
            "focus-visible:outline-none",
            className,
          )}
        >
          <span
            className="rounded-[6px] border border-zoru-line"
            style={{
              backgroundColor: value,
              width: swatchSize,
              height: swatchSize,
            }}
          />
          <span className="font-mono text-xs uppercase text-zoru-ink-muted">
            {value}
          </span>
        </button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent align={align} className="w-64 space-y-3">
        <div className="flex items-center gap-2">
          <label
            className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-[var(--zoru-radius-sm)] border border-zoru-line"
            aria-label="Native color picker"
          >
            <input
              type="color"
              value={draft}
              onChange={(e) => commit(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <span
              className="absolute inset-0"
              style={{ backgroundColor: draft }}
              aria-hidden
            />
            <Pipette className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 mix-blend-difference text-white" />
          </label>
          <ZoruInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(draft);
            }}
            placeholder="#000000"
            className="flex-1 font-mono text-xs uppercase"
          />
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={p}
              onClick={() => commit(p)}
              className={cn(
                "h-7 w-7 rounded-[var(--zoru-radius-sm)] border border-zoru-line transition-transform",
                "hover:scale-105",
                p.toLowerCase() === draft.toLowerCase() &&
                  "ring-1 ring-zoru-ink ring-offset-1",
              )}
              style={{ backgroundColor: p }}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <ZoruButton size="sm" onClick={() => commit(draft)}>
            Done
          </ZoruButton>
        </div>
      </ZoruPopoverContent>
    </ZoruPopover>
  );
}
