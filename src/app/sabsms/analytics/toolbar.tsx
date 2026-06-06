"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Mail, Share2 } from "lucide-react";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

import {
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
  useSabsmsUrlState,
} from "@/components/sabsms/page-toolkit";

import { createShareLink, scheduleEmailReport } from "./actions";

/** Toolbar above the dashboard grid. Lives client-side so URL state syncs. */

export interface AnalyticsToolbarProps {
  /** Encoded raw CSV rows the user can pull — usually the time series. */
  csvRows: Array<Record<string, unknown>>;
  providers: Array<{ value: string; label: string }>;
  countries: Array<{ value: string; label: string }>;
  campaigns: Array<{ value: string; label: string }>;
}

const GROUP_BY_OPTIONS = [
  { value: "provider", label: "Provider" },
  { value: "country", label: "Country" },
  { value: "sender", label: "Sender" },
  { value: "campaign", label: "Campaign" },
  { value: "template", label: "Template" },
];

const COMPARE_OPTIONS = [
  { value: "none", label: "No comparison" },
  { value: "previous_period", label: "Previous period" },
  { value: "previous_year", label: "Previous year" },
];

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom" },
];

export function AnalyticsToolbar({
  csvRows,
  providers,
  countries,
  campaigns,
}: AnalyticsToolbarProps) {
  const router = useRouter();
  const url = useSabsmsUrlState();
  const groupBy = url.get("groupBy") ?? "provider";
  const compareTo = url.get("compareTo") ?? "none";
  const preset = url.get("preset") ?? "30d";

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = React.useState(false);
  const [recipients, setRecipients] = React.useState("");
  const [frequency, setFrequency] = React.useState<
    "daily" | "weekly" | "monthly"
  >("weekly");

  function refresh() {
    router.refresh();
  }

  function currentQueryString(): string {
    if (typeof window === "undefined") return "";
    return window.location.search.replace(/^\?/, "");
  }

  async function onSchedule() {
    setScheduleBusy(true);
    const list = recipients
      .split(/[,\s]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await scheduleEmailReport({
      frequency,
      recipients: list,
      queryString: currentQueryString(),
    });
    setScheduleBusy(false);
    if (res.ok) {
      setScheduleOpen(false);
      setRecipients("");
    } else {
      // eslint-disable-next-line no-alert
      window.alert(res.error);
    }
  }

  async function onShare() {
    const res = await createShareLink(currentQueryString());
    if (res.ok) {
      setShareUrl(res.data.url);
      setShareOpen(true);
    } else {
      // eslint-disable-next-line no-alert
      window.alert(res.error);
    }
  }

  return (
    <div className="space-y-3">
      <SabsmsFilterBar
        searchKey="q"
        searchPlaceholder="Search analytics…"
        dateRangeKey={{ from: "from", to: "to" }}
        facets={[
          {
            key: "provider",
            label: "Provider",
            options: providers,
            multi: true,
          },
          {
            key: "country",
            label: "Country",
            options: countries,
            multi: true,
          },
          {
            key: "campaign",
            label: "Campaign",
            options: campaigns,
            multi: true,
          },
        ]}
        sortOptions={[
          { value: "delivered_desc", label: "Most delivered" },
          { value: "failed_desc", label: "Most failed" },
          { value: "cost_desc", label: "Highest cost" },
        ]}
        defaultSort="delivered_desc"
        trailing={
          <>
            <SabsmsSavedViews scope="analytics" />
            <SabsmsRefreshButton
              onRefresh={refresh}
              defaultInterval={60}
            />
            <SabsmsExportMenu
              filename="sabsms-analytics"
              toCsv={async () => {
                const columns = csvRows[0]
                  ? Object.keys(csvRows[0]).map((k) => ({
                      key: k,
                      header: k,
                    }))
                  : [];
                return rowsToCsv(
                  csvRows as Array<Record<string, unknown>>,
                  columns,
                );
              }}
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-2 text-sm">
        <Label className="text-xs text-[var(--st-text-secondary)]">Range</Label>
        <Select
          value={preset}
          onValueChange={(v) => url.setOne("preset", v)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label className="ml-2 text-xs text-[var(--st-text-secondary)]">
          Compare
        </Label>
        <Select
          value={compareTo}
          onValueChange={(v) => url.setOne("compareTo", v)}
        >
          <SelectTrigger className="h-8 w-[170px]">
            <SelectValue placeholder="Compare" />
          </SelectTrigger>
          <SelectContent>
            {COMPARE_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label className="ml-2 text-xs text-[var(--st-text-secondary)]">
          Group by
        </Label>
        <Select
          value={groupBy}
          onValueChange={(v) => url.setOne("groupBy", v)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScheduleOpen(true)}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" /> Email report
          </Button>
          <Button variant="outline" size="sm" onClick={onShare}>
            <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share link
          </Button>
        </div>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule email report</DialogTitle>
            <DialogDescription>
              The report mirrors the current filters. Each recipient gets a
              link back to this dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) =>
                  setFrequency(v as "daily" | "weekly" | "monthly")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recipients</Label>
              <Input
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setScheduleOpen(false)}
              disabled={scheduleBusy}
            >
              Cancel
            </Button>
            <Button onClick={onSchedule} disabled={scheduleBusy}>
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              {scheduleBusy ? "Saving…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Public share link</DialogTitle>
            <DialogDescription>
              Read-only — anyone with the link can view this dashboard. The
              token is workspace-scoped.
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={shareUrl ?? ""} />
          <DialogFooter>
            <Button onClick={() => setShareOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
