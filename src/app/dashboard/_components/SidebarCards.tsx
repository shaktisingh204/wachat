"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, Button } from "@/components/zoruui";
import { InitialsStack } from "./shared";
import { compact } from "./utils";

export function SidebarCards({ data }: { data: any }) {
  const router = useRouter();
  const { stats, recentActivity, velocity } = data;

  const projectInitials = Array.from({
    length: Math.min(stats.totalProjects || 1, 5),
  }).map((_, i) => String.fromCharCode(65 + i));

  const moduleRows = [
    {
      key: "contacts",
      title: "Wachat Contacts",
      meta: `${compact(stats.totalContacts)} · +${velocity.contactsLast7d} this week`,
      onClick: () => router.push("/dashboard/wachat/contacts"),
    },
    {
      key: "flows",
      title: "SabFlow Automations",
      meta: `${stats.activeFlows} active · ${stats.totalFlows} total`,
      onClick: () => router.push("/dashboard/sabflow/flow-builder"),
    },
    {
      key: "sabchat",
      title: "SabChat Sessions",
      meta: `${compact(stats.totalSabChatSessions)} · AI chatbot`,
      onClick: () => router.push("/dashboard/sabchat"),
    },
    {
      key: "sabsms",
      title: "SabSMS Campaigns",
      meta: `${compact(stats.totalSmsSent)} sent`,
      onClick: () => router.push("/sabsms"),
    },
  ];

  return (
    <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
              Current Plan
            </div>
            <div className="mt-1.5 text-[18px] text-[var(--st-text)] leading-tight">
              {stats.planName || "Free plan"}
            </div>
            <div className="mt-1 text-[11.5px] text-[var(--st-text-secondary)] leading-tight">
              {compact(stats.credits)} credits ·{" "}
              {stats.totalProjects} project
              {stats.totalProjects !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            type="button"
            aria-label="Manage billing"
            onClick={() => router.push("/dashboard/billing")}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] text-[var(--st-text-secondary)] transition-colors hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <InitialsStack initials={projectInitials} className="mt-4" />
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => router.push("/dashboard/billing")}
          >
            Manage billing
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => router.push("/dashboard/profile")}
          >
            Profile
          </Button>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-[15px] text-[var(--st-text)]">Quick Modules</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/wachat/integrations")}
          >
            <Plus className="h-4 w-4" /> Add app
          </Button>
        </div>
        <Card className="divide-y divide-[var(--st-border)] p-0">
          {moduleRows.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={row.onClick}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--st-bg-secondary)] focus-visible:outline-none"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--st-text)]">{row.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--st-text-secondary)]">
                  {row.meta}
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-tertiary)]" />
            </button>
          ))}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Recent Activity
          </div>
          {recentActivity && recentActivity.length > 0 ? (
            <span className="text-[10.5px] text-[var(--st-text-tertiary)]">
              {recentActivity.length} events
            </span>
          ) : null}
        </div>
        {!recentActivity || recentActivity.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
            <Sparkles className="h-5 w-5 text-[var(--st-text-tertiary)]" />
            <div className="text-[12px] text-[var(--st-text-secondary)]">
              No activity yet
            </div>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentActivity.slice(0, 5).map((a: any) => (
              <li key={a._id} className="flex gap-2.5 text-[12px]">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--st-text)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[var(--st-text)] leading-tight">
                    <span>{a.userName}</span>{" "}
                    <span className="text-[var(--st-text-secondary)]">
                      {a.action.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-[var(--st-text-tertiary)]">
                    {formatDistanceToNow(new Date(a.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
