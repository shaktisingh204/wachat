"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  EmptyState,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Filter,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Smartphone,
  Video,
  } from "lucide-react";

/**
 * /sabwa/calls — Read-only call log.
 *
 * Surfaces a chronological list of incoming, outgoing, missed and video
 * calls captured from the active WhatsApp session. No outbound dial UI
 * — calls happen on the phone, this view is for audit and visibility.
 *
 * Rendered with ZoruUI primitives — no shadcn `/ui/*` imports.
 */

import * as React from "react";
import Link from "next/link";

import { useChats } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";

type CallType = "incoming" | "outgoing" | "missed" | "video";

interface CallEntry {
  id: string;
  type: CallType;
  counterpartJid: string;
  counterpartName?: string;
  durationSec: number;
  ts: Date;
}

function typeIcon(type: CallType) {
  switch (type) {
    case "incoming":
      return PhoneIncoming;
    case "outgoing":
      return PhoneOutgoing;
    case "missed":
      return PhoneMissed;
    case "video":
      return Video;
  }
}

function typeLabel(type: CallType): string {
  switch (type) {
    case "incoming":
      return "Incoming";
    case "outgoing":
      return "Outgoing";
    case "missed":
      return "Missed";
    case "video":
      return "Video";
  }
}

function typeBadgeVariant(
  type: CallType,
): "default" | "secondary" | "outline" | "ghost" | "danger" {
  switch (type) {
    case "missed":
      return "danger";
    case "video":
      return "outline";
    case "outgoing":
      return "secondary";
    case "incoming":
    default:
      return "ghost";
  }
}

function formatDuration(sec: number): string {
  if (!sec || sec < 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatTs(ts: Date): string {
  const today = new Date();
  if (ts.toDateString() === today.toDateString()) {
    return ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return ts.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SabWaCallsPage() {
  const toast = useZoruToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';

  const { data: chats } = useChats(sessionId);

  // Phase 1: no call-log action yet — start with an empty list.
  // Wire `listCalls(sessionId)` here once it lands on `sabwa.actions.ts`.
  const [calls, setCalls] = React.useState<CallEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      // TODO (Phase 2): const res = await listCalls(sessionId);
      // For now, no engine endpoint — keep empty.
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  // Filters
  const [typeFilter, setTypeFilter] = React.useState<"all" | CallType>("all");
  const [contactFilter, setContactFilter] = React.useState<string>("all");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");
  const [query, setQuery] = React.useState<string>("");

  const filtered = React.useMemo<CallEntry[]>(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : 0;
    const toTs = toDate
      ? new Date(toDate).getTime() + 86_400_000
      : Number.POSITIVE_INFINITY;
    const q = query.trim().toLowerCase();
    return calls.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (contactFilter !== "all" && c.counterpartJid !== contactFilter)
        return false;
      const t = c.ts.getTime();
      if (t < fromTs || t > toTs) return false;
      if (q) {
        const hay = `${c.counterpartName ?? ""} ${c.counterpartJid}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, typeFilter, contactFilter, fromDate, toDate, query]);

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Calls</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Audit-only notice */}
      <Alert>
        <Phone className="h-4 w-4" />
        <ZoruAlertTitle>Read-only call history</ZoruAlertTitle>
        <ZoruAlertDescription>
          Voice and video calls happen on your phone — this page is for
          audit and visibility. Filter, search, and export below.
        </ZoruAlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3 text-zoru-ink"
        >
          <Phone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
            Calls
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            Read-only history of incoming, outgoing, missed, and video calls.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            toast.toast({ title: "Refreshing call log" });
            void reload();
          }}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <ZoruCardContent className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs font-medium" htmlFor="calls-search">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
              <Input
                id="calls-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Contact name or JID..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Type</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                <ZoruSelectItem value="incoming">Incoming</ZoruSelectItem>
                <ZoruSelectItem value="outgoing">Outgoing</ZoruSelectItem>
                <ZoruSelectItem value="missed">Missed</ZoruSelectItem>
                <ZoruSelectItem value="video">Video</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Contact</Label>
            <Select value={contactFilter} onValueChange={setContactFilter}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All contacts</ZoruSelectItem>
                {(chats ?? [])
                  .filter((c) => c.type === "individual")
                  .map((c) => (
                    <ZoruSelectItem key={c.jid} value={c.jid}>
                      {c.name ?? c.jid}
                    </ZoruSelectItem>
                  ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium" htmlFor="from-date">
              From
            </Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 lg:col-start-5">
            <Label className="text-xs font-medium" htmlFor="to-date">
              To
            </Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setTypeFilter("all");
                setContactFilter("all");
                setFromDate("");
                setToDate("");
                setQuery("");
              }}
            >
              <Filter className="mr-2 h-3.5 w-3.5" /> Reset filters
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Table */}
      <Card>
        <ZoruCardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <CalendarDays className="h-7 w-7 text-zoru-ink-muted" />
              <h3 className="text-sm font-semibold text-zoru-ink">No calls to show</h3>
              <p className="max-w-md text-[11.5px] text-zoru-ink-muted">
                Once your SabWa session is connected and the engine starts
                streaming call events, they&apos;ll appear here. Adjust
                filters or refresh to refetch.
              </p>
            </div>
          ) : (
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-[110px]">Type</ZoruTableHead>
                  <ZoruTableHead>Counterpart</ZoruTableHead>
                  <ZoruTableHead className="w-[120px]">Duration</ZoruTableHead>
                  <ZoruTableHead className="w-[180px]">When</ZoruTableHead>
                  <ZoruTableHead className="w-[60px]" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.map((c) => {
                  const Icon = typeIcon(c.type);
                  return (
                    <ZoruTableRow key={c.id}>
                      <ZoruTableCell>
                        <Badge
                          variant={typeBadgeVariant(c.type)}
                          className="gap-1"
                        >
                          <Icon className="h-3 w-3" />
                          {typeLabel(c.type)}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zoru-ink">
                            {c.counterpartName ?? c.counterpartJid}
                          </span>
                          {c.type === "incoming" || c.type === "missed" ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-zoru-ink-muted" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-zoru-ink-muted" />
                          )}
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted">
                        {formatDuration(c.durationSec)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted">
                        {formatTs(c.ts)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <Button asChild type="button" size="sm" variant="ghost">
                          <Link
                            href={`/sabwa/inbox?jid=${encodeURIComponent(
                              c.counterpartJid,
                            )}`}
                            aria-label="Open chat"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </Table>
          )}
        </ZoruCardContent>
      </Card>
    </div>
  );
}
