"use client";

import * as React from "react";
import { Button, Card, CardBody, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, DateRangePicker, Skeleton, Badge } from '@/components/sabcrm/20ui';
import {
  ChevronDown,
  Eye,
  Inbox,
  RotateCcw,
  Search,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import type { WebhookDeliveryRow } from "@/lib/rust-client/telegram-webhooks";
import { EVENT_TYPE_OPTIONS, fmtDate, STATUS_VARIANT } from "./utils";

export function DeliveriesSection(props: {
  loading: boolean;
  deliveries: WebhookDeliveryRow[];
  hasMore: boolean;
  botOptions: { value: string; label: string }[];
  bot: string;
  event: string;
  status: string;
  search: string;
  range: { from?: Date; to?: Date };
  onBot: (v: string) => void;
  onEvent: (v: string) => void;
  onStatus: (v: string) => void;
  onSearch: (v: string) => void;
  onRange: (r: { from?: Date; to?: Date }) => void;
  onApply: () => void;
  onMore: () => void;
  onView: (d: WebhookDeliveryRow) => void;
  onReplay: (d: WebhookDeliveryRow) => void;
}) {
  const [sortField, setSortField] = React.useState<
    "receivedAt" | "processingDurationMs" | null
  >(null);
  const [sortAsc, setSortAsc] = React.useState(false);

  const sortedDeliveries = React.useMemo(() => {
    if (!sortField) return props.deliveries;
    return [...props.deliveries].sort((a, b) => {
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
  }, [props.deliveries, sortField, sortAsc]);

  function handleSort(field: "receivedAt" | "processingDurationMs") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default desc
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-6">
          <Select value={props.bot} onValueChange={props.onBot}>
            <SelectTrigger>
              <SelectValue placeholder="Bot" />
            </SelectTrigger>
            <SelectContent>
              {props.botOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={props.event} onValueChange={props.onEvent}>
            <SelectTrigger>
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={props.status} onValueChange={props.onStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-secondary)]" />
            <Input
              className="pl-8"
              placeholder="chatId or userId"
              value={props.search}
              onChange={(e) => props.onSearch(e.target.value)}
            />
          </div>
          <DateRangePicker value={props.range} onChange={props.onRange} />
          <Button onClick={props.onApply}>
            <Search className="mr-2 h-4 w-4" /> Apply
          </Button>
        </CardBody>
      </Card>

      {props.loading && props.deliveries.length === 0 ? (
        <Card>
          <CardBody className="p-4">
            <Skeleton className="h-40 w-full" />
          </CardBody>
        </Card>
      ) : props.deliveries.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="No deliveries match these filters"
          description="Webhook deliveries land here as Telegram POSTs them. Adjust filters or wait for traffic."
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-[var(--st-bg-muted)]/30 text-xs uppercase text-[var(--st-text-secondary)]">
                  <tr>
                    <th
                      className="px-3 py-2 text-left cursor-pointer hover:bg-[var(--st-bg-muted)]/50"
                      onClick={() => handleSort("receivedAt")}
                    >
                      <div className="flex items-center gap-1">
                        Received <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left">Event</th>
                    <th className="px-3 py-2 text-left">Chat</th>
                    <th className="px-3 py-2 text-left">From user</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th
                      className="px-3 py-2 text-right cursor-pointer hover:bg-[var(--st-bg-muted)]/50"
                      onClick={() => handleSort("processingDurationMs")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Duration <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDeliveries.map((d) => (
                    <tr
                      key={d._id}
                      className="border-b last:border-0 hover:bg-[var(--st-bg-muted)]/20"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {fmtDate(d.receivedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="ghost">{d.eventType}</Badge>
                      </td>
                      <td className="px-3 py-2">{d.chatId ?? "—"}</td>
                      <td className="px-3 py-2">{d.fromUserId ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_VARIANT[d.status] ?? "ghost"}>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {d.processingDurationMs != null
                          ? `${d.processingDurationMs} ms`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => props.onView(d)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => props.onReplay(d)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {props.hasMore && (
              <div className="border-t p-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={props.onMore}
                  disabled={props.loading}
                >
                  {props.loading ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronDown className="mr-2 h-3 w-3" />
                  )}
                  Load more
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
