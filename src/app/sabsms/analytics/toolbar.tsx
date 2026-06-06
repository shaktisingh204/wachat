"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Mail, Share2 } from "lucide-react";

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/sabcrm/20ui/zoru";

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
          <ZoruSelectTrigger className="h-8 w-[140px]">
            <ZoruSelectValue placeholder="Range" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {PRESETS.map((p) => (
              <ZoruSelectItem key={p.value} value={p.value}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <Label className="ml-2 text-xs text-[var(--st-text-secondary)]">
          Compare
        </Label>
        <Select
          value={compareTo}
          onValueChange={(v) => url.setOne("compareTo", v)}
        >
          <ZoruSelectTrigger className="h-8 w-[170px]">
            <ZoruSelectValue placeholder="Compare" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {COMPARE_OPTIONS.map((p) => (
              <ZoruSelectItem key={p.value} value={p.value}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>

        <Label className="ml-2 text-xs text-[var(--st-text-secondary)]">
          Group by
        </Label>
        <Select
          value={groupBy}
          onValueChange={(v) => url.setOne("groupBy", v)}
        >
          <ZoruSelectTrigger className="h-8 w-[140px]">
            <ZoruSelectValue placeholder="Group by" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {GROUP_BY_OPTIONS.map((p) => (
              <ZoruSelectItem key={p.value} value={p.value}>
                {p.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
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
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Schedule email report</ZoruDialogTitle>
            <ZoruDialogDescription>
              The report mirrors the current filters. Each recipient gets a
              link back to this dashboard.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) =>
                  setFrequency(v as "daily" | "weekly" | "monthly")
                }
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="daily">Daily</ZoruSelectItem>
                  <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
                  <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                </ZoruSelectContent>
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
          <ZoruDialogFooter>
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
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Public share link</ZoruDialogTitle>
            <ZoruDialogDescription>
              Read-only — anyone with the link can view this dashboard. The
              token is workspace-scoped.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Input readOnly value={shareUrl ?? ""} />
          <ZoruDialogFooter>
            <Button onClick={() => setShareOpen(false)}>Done</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
