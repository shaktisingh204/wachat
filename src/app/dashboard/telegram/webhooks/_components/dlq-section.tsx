"use client";

import * as React from "react";
import {
  Button,
  Card,
  ZoruCardContent,
  EmptyState,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Badge,
} from "@/components/zoruui";
import {
  ChevronRight,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import type { WebhookDlqRow } from "@/lib/rust-client/telegram-webhooks";
import { fmtDate, STATUS_VARIANT } from "./utils";

export function DlqSection(props: {
  loading: boolean;
  items: WebhookDlqRow[];
  botOptions: { value: string; label: string }[];
  bot: string;
  status: string;
  onBot: (v: string) => void;
  onStatus: (v: string) => void;
  onApply: () => void;
  onRetry: (d: WebhookDlqRow) => void;
  onResolve: (d: WebhookDlqRow) => void;
  onDelete: (d: WebhookDlqRow) => void;
}) {
  const [sortField, setSortField] = React.useState<
    "lastAttemptAt" | "attempts" | null
  >(null);
  const [sortAsc, setSortAsc] = React.useState(true);

  const sortedItems = React.useMemo(() => {
    if (!sortField) return props.items;
    return [...props.items].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === undefined && valB === undefined) return 0;
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;

      let cmp = 0;
      if (valA < valB) cmp = -1;
      if (valA > valB) cmp = 1;
      return sortAsc ? cmp : -cmp;
    });
  }, [props.items, sortField, sortAsc]);

  function handleSort(field: "lastAttemptAt" | "attempts") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default desc for dates
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <ZoruCardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-4">
          <Select value={props.bot} onValueChange={props.onBot}>
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="Bot" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {props.botOptions.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
          <Select value={props.status} onValueChange={props.onStatus}>
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
              <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
              <ZoruSelectItem value="retrying">Retrying</ZoruSelectItem>
              <ZoruSelectItem value="failed_permanent">
                Failed (permanent)
              </ZoruSelectItem>
              <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
          <Button onClick={props.onApply}>
            <Search className="mr-2 h-4 w-4" /> Apply
          </Button>
        </ZoruCardContent>
      </Card>
      {props.loading && props.items.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : props.items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title="The DLQ is empty"
          description="Failed deliveries land here. The worker auto-retries pending items on a schedule."
        />
      ) : (
        <Card>
          <ZoruCardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-zoru-surface-2/30 text-xs uppercase text-zoru-ink-muted">
                  <tr>
                    <th
                      className="px-3 py-2 text-left cursor-pointer hover:bg-zoru-surface-2/50"
                      onClick={() => handleSort("lastAttemptAt")}
                    >
                      <div className="flex items-center gap-1">
                        Last attempt <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-right cursor-pointer hover:bg-zoru-surface-2/50"
                      onClick={() => handleSort("attempts")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Attempts <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Last error</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((d) => (
                    <tr
                      key={d._id}
                      className="border-b last:border-0 hover:bg-zoru-surface-2/20"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {fmtDate(d.lastAttemptAt)}
                      </td>
                      <td className="px-3 py-2 text-right">{d.attempts}</td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_VARIANT[d.status] ?? "ghost"}>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <span className="line-clamp-1 max-w-[40ch] text-xs text-zoru-ink-muted">
                          {d.lastError ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => props.onRetry(d)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => props.onResolve(d)}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => props.onDelete(d)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}
