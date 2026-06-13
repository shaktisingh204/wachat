"use client";

import React, { useState, useEffect } from "react";
import { Activity, AlertCircle, PlayCircle, CheckCircle2, DollarSign, TrendingUp, UserMinus, Settings2 } from "lucide-react";
import { StatCard, Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/sabcrm/20ui';
import "@/components/sabsms/motion/sabsms-motion.css";

export type MetricData = {
  id: string;
  label: string;
  value: string;
  /** Optional MoM delta. Omitted when the period has no prior comparison. */
  delta?: number;
  period: string;
  iconName: string;
  invertDelta?: boolean;
};

const iconMap: Record<string, React.ReactNode> = {
  Activity: <Activity />,
  AlertCircle: <AlertCircle />,
  PlayCircle: <PlayCircle />,
  CheckCircle2: <CheckCircle2 />,
  DollarSign: <DollarSign />,
  TrendingUp: <TrendingUp />,
  UserMinus: <UserMinus />
};

export function SabsmsDashboardWidgets({ allMetrics }: { allMetrics: MetricData[] }) {
  const [pinned, setPinned] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sabsms-pinned-metrics");
    if (saved) {
      try {
        setPinned(JSON.parse(saved));
      } catch(e) {}
    } else {
      // default — must match metric ids emitted by the dashboard page.
      setPinned(["totalSent", "deliveryRate", "delivered", "failedDeliveries"]);
    }
  }, []);

  if (!mounted) {
    // Return skeleton during SSR
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <Settings2 className="w-4 h-4" />
            Customize Widgets
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[1,2,3,4].map(i => (
             <div key={i} className="h-32 rounded-xl bg-[var(--st-bg-muted)] animate-pulse w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  const togglePin = (id: string) => {
    let next: string[];
    if (pinned.includes(id)) {
      next = pinned.filter(p => p !== id);
    } else {
      next = [...pinned, id];
    }
    setPinned(next);
    localStorage.setItem("sabsms-pinned-metrics", JSON.stringify(next));
  };

  const displayedMetrics = allMetrics.filter(m => pinned.includes(m.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Customize Widgets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Pin Metrics</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allMetrics.map(m => (
              <DropdownMenuCheckboxItem
                key={m.id}
                checked={pinned.includes(m.id)}
                onCheckedChange={() => togglePin(m.id)}
              >
                {m.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="sabsms-motion grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {displayedMetrics.length === 0 ? (
          <div className="col-span-full text-center p-8 text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] rounded-xl">
            No metrics pinned. Use the Customize button to add some.
          </div>
        ) : (
          displayedMetrics.map((m, i) => {
            // StatCard's delta is { value: string; tone }. A positive delta is
            // "up"; invertDelta flips the good/bad sense (e.g. failure rate down
            // is good → render as up-tone). undefined delta hides the chip.
            let delta: { value: string; tone: "up" | "down" | "neutral" } | undefined;
            if (typeof m.delta === "number") {
              const raw = m.delta;
              const sign = raw > 0 ? "+" : "";
              const isGood = m.invertDelta ? raw < 0 : raw > 0;
              const tone: "up" | "down" | "neutral" =
                raw === 0 ? "neutral" : isGood ? "up" : "down";
              delta = { value: `${sign}${raw}% ${m.period}`, tone };
            }
            return (
              <div
                key={m.id}
                className="sabsms-stagger-item"
                style={{ ["--i" as string]: i } as React.CSSProperties}
              >
                <StatCard
                  label={m.label}
                  value={m.value}
                  delta={delta}
                  icon={iconMap[m.iconName] || <Activity />}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
