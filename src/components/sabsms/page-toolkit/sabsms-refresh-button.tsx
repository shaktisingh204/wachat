"use client";

import * as React from "react";
import { RefreshCcw } from "lucide-react";

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from "@/components/zoruui";

const INTERVALS = [
  { value: "off", label: "Off" },
  { value: "10", label: "Every 10 s" },
  { value: "30", label: "Every 30 s" },
  { value: "60", label: "Every 1 min" },
  { value: "300", label: "Every 5 min" },
];

export interface SabsmsRefreshButtonProps {
  /** Called on manual click and at every auto-refresh tick. */
  onRefresh: () => void | Promise<void>;
  /** Default auto-refresh seconds; pass "off" or 0 to disable. */
  defaultInterval?: "off" | number;
}

export function SabsmsRefreshButton({
  onRefresh,
  defaultInterval = "off",
}: SabsmsRefreshButtonProps) {
  const [interval, setInterval] = React.useState<string>(
    defaultInterval === "off" ? "off" : String(defaultInterval),
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (interval === "off") return;
    const secs = parseInt(interval, 10);
    if (!secs) return;
    const handle = window.setInterval(async () => {
      setBusy(true);
      try {
        await onRefresh();
      } finally {
        setBusy(false);
      }
    }, secs * 1000);
    return () => window.clearInterval(handle);
  }, [interval, onRefresh]);

  async function manualRefresh() {
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={manualRefresh}
        disabled={busy}
        className="rounded-r-none border-r-0"
      >
        <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        Refresh
      </Button>
      <DropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-l-none px-1.5"
            aria-label="Auto-refresh interval"
          >
            ▾
          </Button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent align="end">
          <ZoruDropdownMenuLabel>Auto-refresh</ZoruDropdownMenuLabel>
          <ZoruDropdownMenuSeparator />
          <ZoruDropdownMenuRadioGroup
            value={interval}
            onValueChange={setInterval}
          >
            {INTERVALS.map((i) => (
              <ZoruDropdownMenuRadioItem key={i.value} value={i.value}>
                {i.label}
              </ZoruDropdownMenuRadioItem>
            ))}
          </ZoruDropdownMenuRadioGroup>
        </ZoruDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
