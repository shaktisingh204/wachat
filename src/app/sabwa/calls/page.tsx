"use client";

/**
 * /sabwa/calls — Read-only call log.
 *
 * Surfaces a chronological list of incoming, outgoing, missed and video
 * calls fed by Baileys call events. No outbound dial UI — that's by
 * design (see roadmap banner at top).
 *
 * Phase 1: there's no call-log fetch action yet, so the table starts
 * empty and the empty state explains why. As soon as the engine ships
 * `listCalls`, the loader below will swap to it without UI changes.
 */

import * as React from "react";
import Link from "next/link";
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
  Video,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useChats } from "@/lib/sabwa/use-sabwa-data";

const PLACEHOLDER_SESSION_ID = "stub-primary";

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
): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "missed":
      return "destructive";
    case "video":
      return "outline";
    case "outgoing":
      return "secondary";
    case "incoming":
    default:
      return "default";
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
  const { toast } = useToast();
  const sessionId = PLACEHOLDER_SESSION_ID;

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

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      {/* Roadmap banner */}
      <Alert>
        <Phone className="h-4 w-4" />
        <AlertTitle>Calls are read-only in SabWa V1</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span>
            Voice and video calls are surfaced from Baileys events for audit.
            Initiating calls is coming in a future release.
          </span>
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/sabwa/settings">View roadmap</Link>
          </Button>
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-xl bg-secondary p-3 text-secondary-foreground"
        >
          <Phone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only history of incoming, outgoing, missed, and video calls.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            toast({ title: "Refreshing call log" });
            void reload();
          }}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs font-medium" htmlFor="calls-search">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Contact</Label>
            <Select value={contactFilter} onValueChange={setContactFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contacts</SelectItem>
                {(chats ?? [])
                  .filter((c) => c.type === "individual")
                  .map((c) => (
                    <SelectItem key={c.jid} value={c.jid}>
                      {c.name ?? c.jid}
                    </SelectItem>
                  ))}
              </SelectContent>
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <CalendarDays className="h-7 w-7 text-muted-foreground" />
              <h3 className="text-sm font-semibold">No calls to show</h3>
              <p className="max-w-md text-xs text-muted-foreground">
                Once your SabWa session is connected and the engine starts
                streaming call events, they&apos;ll appear here. Adjust
                filters or refresh to refetch.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Type</TableHead>
                  <TableHead>Counterpart</TableHead>
                  <TableHead className="w-[120px]">Duration</TableHead>
                  <TableHead className="w-[180px]">When</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const Icon = typeIcon(c.type);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Badge
                          variant={typeBadgeVariant(c.type)}
                          className="gap-1"
                        >
                          <Icon className="h-3 w-3" />
                          {typeLabel(c.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {c.counterpartName ?? c.counterpartJid}
                          </span>
                          {c.type === "incoming" || c.type === "missed" ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDuration(c.durationSec)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTs(c.ts)}
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
