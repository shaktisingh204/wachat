"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Send, CircleCheck, Briefcase, Users, Sparkles, Bell, AlarmClock } from "lucide-react";
import { Badge, Button } from "@/components/sabcrm/20ui";
import { BigStatCard, NotificationCard } from "./shared";
import { compact, curr } from "./utils";

export function BigCardsRow({ data, derived }: { data: any, derived: any }) {
  const router = useRouter();
  const { stats, velocity, unreadNotifications, insights, currency } = data;

  const projectInitials = Array.from({
    length: Math.min(stats.totalProjects || 1, 5),
  }).map((_, i) => String.fromCharCode(65 + i));

  type NoteCard = {
    icon: React.ReactNode;
    title: string;
    tone?: "default" | "inverted";
    onClick?: () => void;
  };
  const notificationCards: NoteCard[] = [];

  if (insights && insights[0]) {
    notificationCards.push({
      icon: <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />,
      title: insights[0].length > 48 ? insights[0].slice(0, 48) + "..." : insights[0],
    });
  }
  (unreadNotifications || []).slice(0, 2).forEach((n: any) => {
    notificationCards.push({
      icon: <Bell className="h-3.5 w-3.5" aria-hidden="true" />,
      title: n.message.length > 48 ? n.message.slice(0, 48) + "..." : n.message,
      onClick: () => router.push("/dashboard/notifications"),
    });
  });
  if (velocity.broadcastsLast7d === 0 && stats.totalCampaigns > 0) {
    notificationCards.push({
      icon: <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />,
      title: "No broadcasts this week",
      tone: "inverted",
      onClick: () => router.push("/wachat/broadcasts"),
    });
  } else if (velocity.messagesLast24h > 0) {
    notificationCards.push({
      icon: <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />,
      title: `${compact(velocity.messagesLast24h)} msgs in 24h`,
      tone: "inverted",
      onClick: () => router.push("/wachat/analytics"),
    });
  }
  while (notificationCards.length < 3) {
    notificationCards.push({
      icon: <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />,
      title:
        notificationCards.length === 0
          ? "Welcome to SabNode"
          : notificationCards.length === 1
            ? "Create your first broadcast"
            : "Invite your team",
      onClick: () =>
        router.push(
          notificationCards.length === 1
            ? "/wachat/broadcasts"
            : "/dashboard/team",
        ),
    });
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
      <BigStatCard
        title="WhatsApp"
        subtitle="Last 30 days"
        metaLeft={
          <>
            <Send className="h-3 w-3" aria-hidden="true" />
            {compact(stats.totalMessages)} sent
          </>
        }
        metaRight={
          <>
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
            {derived?.deliveryRate ?? 0}% delivered
          </>
        }
        statusLabel={
          derived?.messagesTrend.up
            ? `+${derived?.messagesTrend.delta ?? 0}% vs prev 24h`
            : `${derived?.messagesTrend.delta ?? 0}% vs prev 24h`
        }
        statusOk={true}
        tokens={projectInitials}
        ctaLabel="View analytics"
        onCtaClick={() => router.push("/wachat/analytics")}
      />

      <BigStatCard
        title="CRM Pipeline"
        subtitle={`${curr(stats.pipelineValue, currency)} total value`}
        metaLeft={
          <>
            <Briefcase className="h-3 w-3" aria-hidden="true" />
            {stats.totalDeals} deals
          </>
        }
        metaRight={
          <>
            <Users className="h-3 w-3" aria-hidden="true" />
            {compact(stats.totalLeads)} leads
          </>
        }
        statusLabel={
          stats.dealsWon > 0
            ? `${stats.dealsWon} won`
            : `${velocity.leadsLast7d} new this week`
        }
        statusOk={stats.dealsWon > 0}
        tokens={["L1", "L2", "L3", "L4", "L5"]}
        ctaLabel="View pipeline"
        onCtaClick={() => router.push("/dashboard/crm/sales-crm/leads")}
      />

      <div className="flex flex-col gap-2">
        {notificationCards.slice(0, 3).map((n, i) => (
          <NotificationCard
            key={i}
            icon={n.icon}
            title={n.title}
            inverted={n.tone === "inverted"}
            onClick={n.onClick}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/notifications")}
          className="mt-1.5 w-full justify-between px-2 text-[11.5px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
          <span>See all notifications</span>
          <Badge tone="neutral" kind="outline" className="gap-1">
            <Bell className="h-2.5 w-2.5" aria-hidden="true" />
            {unreadNotifications?.length || "Zero"}
          </Badge>
        </Button>
      </div>
    </div>
  );
}
