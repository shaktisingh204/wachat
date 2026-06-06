"use client";

import * as React from "react";
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Badge,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from "@/components/sabcrm/20ui";
import {
  ChevronRight,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
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

  function sortDirFor(field: "lastAttemptAt" | "attempts") {
    if (sortField !== field) return null;
    return sortAsc ? ("asc" as const) : ("desc" as const);
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-4">
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
          <Select value={props.status} onValueChange={props.onStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="retrying">Retrying</SelectItem>
              <SelectItem value="failed_permanent">
                Failed (permanent)
              </SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={props.onApply} iconLeft={Search}>
            Apply
          </Button>
        </CardBody>
      </Card>
      {props.loading && props.items.length === 0 ? (
        <Skeleton className="h-40 w-full" />
      ) : props.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="The DLQ is empty"
          description="Failed deliveries land here. The worker auto-retries pending items on a schedule."
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <Table density="compact">
                <THead>
                  <Tr>
                    <Th
                      sortable
                      sortDirection={sortDirFor("lastAttemptAt")}
                      onSort={() => handleSort("lastAttemptAt")}
                    >
                      Last attempt
                    </Th>
                    <Th
                      align="right"
                      sortable
                      sortDirection={sortDirFor("attempts")}
                      onSort={() => handleSort("attempts")}
                    >
                      Attempts
                    </Th>
                    <Th>Status</Th>
                    <Th>Last error</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {sortedItems.map((d) => (
                    <Tr key={d._id}>
                      <Td className="whitespace-nowrap">
                        {fmtDate(d.lastAttemptAt)}
                      </Td>
                      <Td align="right">{d.attempts}</Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                          {d.status}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="line-clamp-1 max-w-[40ch] text-xs text-[var(--st-text-secondary)]">
                          {d.lastError ?? "None"}
                        </span>
                      </Td>
                      <Td align="right">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Retry delivery"
                          iconLeft={RotateCcw}
                          onClick={() => props.onRetry(d)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Resolve item"
                          iconLeft={ChevronRight}
                          onClick={() => props.onResolve(d)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Delete item"
                          iconLeft={Trash2}
                          onClick={() => props.onDelete(d)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
