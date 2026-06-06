"use client";

import * as React from "react";
import {
  Button,
  IconButton,
  Card,
  CardBody,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  DateRangePicker,
  Skeleton,
  Badge,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from "@/components/sabcrm/20ui";
import { ChevronDown, Eye, Inbox, RotateCcw, Search } from "lucide-react";
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

  function sortDir(
    field: "receivedAt" | "processingDurationMs",
  ): "asc" | "desc" | null {
    if (sortField !== field) return null;
    return sortAsc ? "asc" : "desc";
  }

  return (
    <div className="space-y-3">
      <Card padding="none">
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
          <Input
            iconLeft={Search}
            placeholder="chatId or userId"
            aria-label="Search by chatId or userId"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
          />
          <DateRangePicker value={props.range} onChange={props.onRange} />
          <Button variant="primary" iconLeft={Search} onClick={props.onApply}>
            Apply
          </Button>
        </CardBody>
      </Card>

      {props.loading && props.deliveries.length === 0 ? (
        <Card>
          <CardBody className="p-4">
            <Skeleton height={160} className="w-full" />
          </CardBody>
        </Card>
      ) : props.deliveries.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No deliveries match these filters"
          description="Webhook deliveries land here as Telegram POSTs them. Adjust filters or wait for traffic."
        />
      ) : (
        <Card padding="none">
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th
                      sortable
                      sortDirection={sortDir("receivedAt")}
                      onSort={() => handleSort("receivedAt")}
                    >
                      Received
                    </Th>
                    <Th>Event</Th>
                    <Th>Chat</Th>
                    <Th>From user</Th>
                    <Th>Status</Th>
                    <Th
                      align="right"
                      sortable
                      sortDirection={sortDir("processingDurationMs")}
                      onSort={() => handleSort("processingDurationMs")}
                    >
                      Duration
                    </Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {sortedDeliveries.map((d) => (
                    <Tr key={d._id}>
                      <Td className="whitespace-nowrap">{fmtDate(d.receivedAt)}</Td>
                      <Td>
                        <Badge tone="neutral">{d.eventType}</Badge>
                      </Td>
                      <Td>{d.chatId ?? "-"}</Td>
                      <Td>{d.fromUserId ?? "-"}</Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[d.status] === "ghost" ? undefined : STATUS_VARIANT[d.status]}>
                          {d.status}
                        </Badge>
                      </Td>
                      <Td align="right">
                        {d.processingDurationMs != null
                          ? `${d.processingDurationMs} ms`
                          : "-"}
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label="View delivery"
                            icon={Eye}
                            size="sm"
                            variant="ghost"
                            onClick={() => props.onView(d)}
                          />
                          <IconButton
                            label="Replay delivery"
                            icon={RotateCcw}
                            size="sm"
                            variant="ghost"
                            onClick={() => props.onReplay(d)}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            {props.hasMore && (
              <div className="border-t border-[var(--st-border)] p-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  loading={props.loading}
                  iconLeft={ChevronDown}
                  onClick={props.onMore}
                >
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
