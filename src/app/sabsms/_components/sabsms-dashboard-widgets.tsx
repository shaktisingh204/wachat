"use client";

import React, { useState, useEffect } from "react";
import { Activity, AlertCircle, PlayCircle, CheckCircle2, DollarSign, TrendingUp, UserMinus, Settings2 } from "lucide-react";
import { StatCard, Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, ZoruChart, ChartContainer, ZORU_CHART_PALETTE } from '@/components/sabcrm/20ui/compat';

export type MetricData = {
  id: string;
  label: string;
  value: string;
  delta: number;
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

const mockSparklineData = [
  { val: 10 }, { val: 25 }, { val: 15 }, { val: 40 }, { val: 35 }, { val: 50 }, { val: 45 }
];

function Sparkline() {
  return (
    <ChartContainer height={40} className="w-full mt-2">
      <ZoruChart.LineChart data={mockSparklineData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <ZoruChart.Line
          type="monotone"
          dataKey="val"
          stroke={ZORU_CHART_PALETTE[0]}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ZoruChart.LineChart>
    </ChartContainer>
  );
}

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
      // default
      setPinned(["totalSent", "deliveryRate", "activeCampaigns", "failedDeliveries"]);
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {displayedMetrics.length === 0 ? (
          <div className="col-span-full text-center p-8 text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] rounded-xl">
            No metrics pinned. Use the Customize button to add some.
          </div>
        ) : (
          displayedMetrics.map(m => (
            <StatCard
              key={m.id}
              label={m.label}
              value={m.value}
              delta={m.delta}
              period={m.period}
              invertDelta={m.invertDelta}
              icon={iconMap[m.iconName] || <Activity />}
              chart={<Sparkline />}
            />
          ))
        )}
      </div>
    </div>
  );
}
