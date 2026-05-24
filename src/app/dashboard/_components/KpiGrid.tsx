"use client";

import React, { useState, useEffect } from "react";
import { KpiTile } from "./shared";
import {
  Send,
  CircleCheck,
  Briefcase,
  Users,
  MessageSquare,
  Workflow,
  Bot,
  Smartphone,
  Mail,
  Globe,
  Sparkles,
  Settings,
  Download,
  ChevronDown,
  ArrowUpRight
} from "lucide-react";
import { Button, DropdownMenu, ZoruDropdownMenuTrigger, ZoruDropdownMenuContent, ZoruDropdownMenuLabel, ZoruDropdownMenuRadioGroup, ZoruDropdownMenuRadioItem, ZoruDropdownMenuSeparator, ZoruDropdownMenuItem, ZoruDropdownMenuCheckboxItem } from "@/components/zoruui";
import { useRouter } from "next/navigation";
import { compact, curr } from "./utils";

const TIME_RANGE_LABELS = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};
type TimeRange = keyof typeof TIME_RANGE_LABELS;

type KpiGridProps = {
  stats: any;
  velocity: any;
  derived: any;
  currency: string;
  onExport: (timeRange: TimeRange) => void;
};

export function KpiGrid({ stats, velocity, derived, currency, onExport }: KpiGridProps) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  
  // Customizable Layout State
  const [visibleKpis, setVisibleKpis] = useState<Record<string, boolean>>({
    messages: true,
    delivery: true,
    pipeline: true,
    deals: true,
    leads: true,
    contacts: true,
    flows: true,
    sabchat: true,
    sms: true,
    email: true,
    seo: true,
    activity: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem("zoru-dashboard-kpis");
    if (saved) {
      try {
        setVisibleKpis(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const toggleKpi = (key: string) => {
    const newKpis = { ...visibleKpis, [key]: !visibleKpis[key] };
    setVisibleKpis(newKpis);
    localStorage.setItem("zoru-dashboard-kpis", JSON.stringify(newKpis));
  };

  const kpis = [
    {
      key: "messages",
      label: "Messages 24h",
      value: compact(velocity.messagesLast24h),
      hint: `${compact(stats.totalMessages)} all time`,
      delta: derived?.messagesTrend.delta,
      up: derived?.messagesTrend.up,
      icon: <Send />,
    },
    {
      key: "delivery",
      label: "Delivery rate",
      value: `${derived?.deliveryRate ?? 0}%`,
      hint: `${compact(stats.totalDelivered)} / ${compact(stats.totalSent)}`,
      icon: <CircleCheck />,
    },
    {
      key: "pipeline",
      label: "Pipeline value",
      value: curr(stats.pipelineValue, currency),
      hint: `${stats.totalDeals} open deals`,
      icon: <Briefcase />,
    },
    {
      key: "deals",
      label: "Deals won",
      value: compact(stats.dealsWon),
      hint: `${derived?.dealsWonRate ?? 0}% conversion`,
      icon: <CircleCheck />,
    },
    {
      key: "leads",
      label: "New leads",
      value: compact(velocity.leadsLast7d),
      hint: `${compact(stats.totalLeads)} total`,
      icon: <Users />,
    },
    {
      key: "contacts",
      label: "Contacts",
      value: compact(stats.totalContacts),
      hint: `+${velocity.contactsLast7d} this week`,
      icon: <MessageSquare />,
    },
    {
      key: "flows",
      label: "Active flows",
      value: `${stats.activeFlows}/${stats.totalFlows}`,
      hint: `${compact(stats.totalFlowExecutions)} executions`,
      icon: <Workflow />,
    },
    {
      key: "sabchat",
      label: "SabChat sessions",
      value: compact(stats.totalSabChatSessions),
      hint: "AI chatbot",
      icon: <Bot />,
    },
    {
      key: "sms",
      label: "SMS delivered",
      value: `${derived?.smsDeliveryRate ?? 0}%`,
      hint: `${compact(stats.totalSmsSent)} sent`,
      icon: <Smartphone />,
    },
    {
      key: "email",
      label: "Email campaigns",
      value: compact(stats.totalEmailCampaigns),
      hint: `${compact(stats.totalEmailContacts)} contacts`,
      icon: <Mail />,
    },
    {
      key: "seo",
      label: "SEO audits",
      value: compact(stats.totalSeoAudits),
      hint: `${stats.totalSeoProjects} site${stats.totalSeoProjects !== 1 ? "s" : ""}`,
      icon: <Globe />,
    },
    {
      key: "activity",
      label: "Activity 7d",
      value: compact(stats.totalActivityLogs7d),
      hint: `${stats.totalProjects} project${stats.totalProjects !== 1 ? "s" : ""}`,
      icon: <Sparkles />,
    }
  ];

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
            Performance
          </h2>
          <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
            Key metrics across every app in your account
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Customize Layout">
                <Settings className="opacity-60" /> Layout
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end" className="w-56">
              <ZoruDropdownMenuLabel>Customize Metric Tiles</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuSeparator />
              {kpis.map((kpi) => (
                <ZoruDropdownMenuCheckboxItem
                  key={kpi.key}
                  checked={visibleKpis[kpi.key] !== false}
                  onCheckedChange={() => toggleKpi(kpi.key)}
                >
                  {kpi.label}
                </ZoruDropdownMenuCheckboxItem>
              ))}
            </ZoruDropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {TIME_RANGE_LABELS[timeRange]}
                <ChevronDown className="opacity-60" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Time range</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuRadioGroup
                value={timeRange}
                onValueChange={(v) => setTimeRange(v as TimeRange)}
              >
                <ZoruDropdownMenuRadioItem value="24h">Last 24 hours</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="7d">Last 7 days</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="30d">Last 30 days</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="all">All time</ZoruDropdownMenuRadioItem>
              </ZoruDropdownMenuRadioGroup>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onSelect={() => router.push("/wachat/analytics")}>
                <ArrowUpRight /> Open analytics
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => onExport(timeRange)}>
            <Download /> Export
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.filter((kpi) => visibleKpis[kpi.key] !== false).map((kpi) => (
          <KpiTile
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            delta={kpi.delta}
            up={kpi.up}
            icon={kpi.icon}
          />
        ))}
      </div>
    </section>
  );
}
