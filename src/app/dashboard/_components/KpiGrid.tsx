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
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuCheckboxItem } from '@/components/sabcrm/20ui';
import { useRouter } from "next/navigation";
import { compact, curr } from "./utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
};

function SortableKpiTile({ id, kpiData }: { id: string, kpiData: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KpiTile {...kpiData} />
    </div>
  );
}

export function KpiGrid({ stats, velocity, derived, currency }: KpiGridProps) {
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

  const defaultKpis = [
    {
      id: "messages",
      label: "Messages 24h",
      value: compact(velocity.messagesLast24h),
      hint: `${compact(stats.totalMessages)} all time`,
      delta: derived?.messagesTrend.delta,
      up: derived?.messagesTrend.up,
      icon: <Send />,
    },
    {
      id: "delivery",
      label: "Delivery rate",
      value: `${derived?.deliveryRate ?? 0}%`,
      hint: `${compact(stats.totalDelivered)} / ${compact(stats.totalSent)}`,
      icon: <CircleCheck />,
    },
    {
      id: "pipeline",
      label: "Pipeline value",
      value: curr(stats.pipelineValue, currency),
      hint: `${stats.totalDeals} open deals`,
      icon: <Briefcase />,
    },
    {
      id: "deals",
      label: "Deals won",
      value: compact(stats.dealsWon),
      hint: `${derived?.dealsWonRate ?? 0}% conversion`,
      icon: <CircleCheck />,
    },
    {
      id: "leads",
      label: "New leads",
      value: compact(velocity.leadsLast7d),
      hint: `${compact(stats.totalLeads)} total`,
      icon: <Users />,
    },
    {
      id: "contacts",
      label: "Contacts",
      value: compact(stats.totalContacts),
      hint: `+${velocity.contactsLast7d} this week`,
      icon: <MessageSquare />,
    },
    {
      id: "flows",
      label: "Active flows",
      value: `${stats.activeFlows}/${stats.totalFlows}`,
      hint: `${compact(stats.totalFlowExecutions)} executions`,
      icon: <Workflow />,
    },
    {
      id: "sabchat",
      label: "SabChat sessions",
      value: compact(stats.totalSabChatSessions),
      hint: "AI chatbot",
      icon: <Bot />,
    },
    {
      id: "sms",
      label: "SMS delivered",
      value: `${derived?.smsDeliveryRate ?? 0}%`,
      hint: `${compact(stats.totalSmsSent)} sent`,
      icon: <Smartphone />,
    },
    {
      id: "email",
      label: "Email campaigns",
      value: compact(stats.totalEmailCampaigns),
      hint: `${compact(stats.totalEmailContacts)} contacts`,
      icon: <Mail />,
    },
    {
      id: "seo",
      label: "SEO audits",
      value: compact(stats.totalSeoAudits),
      hint: `${stats.totalSeoProjects} site${stats.totalSeoProjects !== 1 ? "s" : ""}`,
      icon: <Globe />,
    },
    {
      id: "activity",
      label: "Activity 7d",
      value: compact(stats.totalActivityLogs7d),
      hint: `${stats.totalProjects} project${stats.totalProjects !== 1 ? "s" : ""}`,
      icon: <Sparkles />,
    }
  ];

  const [kpis, setKpis] = useState(defaultKpis);

  useEffect(() => {
    const saved = localStorage.getItem("ui20-dashboard-kpis-visible");
    if (saved) {
      try { setVisibleKpis(JSON.parse(saved)); } catch (e) {}
    }
    const savedOrder = localStorage.getItem("ui20-dashboard-kpis-order");
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const ordered = [];
        const remaining = [...defaultKpis];
        for (const id of orderIds) {
          const idx = remaining.findIndex(k => k.id === id);
          if (idx !== -1) {
            ordered.push(remaining[idx]);
            remaining.splice(idx, 1);
          }
        }
        setKpis([...ordered, ...remaining]);
      } catch (e) {}
    }
  }, []);

  const toggleKpi = (key: string) => {
    const newKpis = { ...visibleKpis, [key]: !visibleKpis[key] };
    setVisibleKpis(newKpis);
    localStorage.setItem("ui20-dashboard-kpis-visible", JSON.stringify(newKpis));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setKpis((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArr = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("ui20-dashboard-kpis-order", JSON.stringify(newArr.map(k => k.id)));
        return newArr;
      });
    }
  }

  const visibleKpiList = kpis.filter(k => visibleKpis[k.id] !== false);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[22px] tracking-tight text-[var(--st-text)] leading-none">
            Performance
          </h2>
          <p className="mt-1.5 text-[12.5px] text-[var(--st-text-secondary)]">
            Key metrics across every app in your account
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Customize Layout">
                <Settings className="opacity-60" /> Layout
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Customize Metric Tiles</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {kpis.map((kpi) => (
                <DropdownMenuCheckboxItem
                  key={kpi.id}
                  checked={visibleKpis[kpi.id] !== false}
                  onCheckedChange={() => toggleKpi(kpi.id)}
                >
                  {kpi.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {TIME_RANGE_LABELS[timeRange]}
                <ChevronDown className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Time range</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={timeRange}
                onValueChange={(v) => setTimeRange(v as TimeRange)}
              >
                <DropdownMenuRadioItem value="24h">Last 24 hours</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="7d">Last 7 days</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/wachat/analytics")}>
                <ArrowUpRight /> Open analytics
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SortableContext items={visibleKpiList.map(k => k.id)} strategy={rectSortingStrategy}>
            {visibleKpiList.map((kpi) => (
              <SortableKpiTile key={kpi.id} id={kpi.id} kpiData={kpi} />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </section>
  );
}
