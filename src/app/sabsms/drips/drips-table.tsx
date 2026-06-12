"use client";

/**
 * Drips (journeys) list — client table (V2.9).
 *
 * Renders `sabsms_journeys` rows with status / steps / active-run /
 * stats columns plus the lifecycle row actions (activate, pause,
 * archive, duplicate, enrol). Composes the SabSMS page toolkit on 20ui.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Copy,
  FlaskConical,
  GitBranch,
  PauseCircle,
  PlayCircle,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/sabcrm/20ui";
import { useToast } from "@/components/sabcrm/20ui";
import {
  SabsmsDataTable,
  SabsmsFilterBar,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";

import {
  duplicateJourney,
  enrolContactFromList,
  setJourneyStatusFromList,
  type JourneyRow,
} from "./actions";

const STATUS_BADGE: Record<
  JourneyRow["status"],
  { label: string; variant?: "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active" },
  paused: { label: "Paused", variant: "outline" },
  archived: { label: "Archived", variant: "secondary" },
};

interface DripsTableProps {
  rows: JourneyRow[];
}

export function DripsTable({ rows }: DripsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [enrolFor, setEnrolFor] = React.useState<JourneyRow | null>(null);
  const [enrolPhone, setEnrolPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const transition = async (row: JourneyRow, to: "active" | "paused" | "archived") => {
    const res = await setJourneyStatusFromList(row.id, to);
    if (!res.ok) {
      toast({ title: "Could not update journey", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: to === "active" ? "Journey activated" : to === "paused" ? "Journey paused" : "Journey archived" });
    router.refresh();
  };

  const rowActions: SabsmsRowAction<JourneyRow>[] = [
    {
      label: "Activate",
      icon: <PlayCircle className="h-3.5 w-3.5" />,
      onSelect: (row) => void transition(row, "active"),
    },
    {
      label: "Pause",
      icon: <PauseCircle className="h-3.5 w-3.5" />,
      onSelect: (row) => void transition(row, "paused"),
    },
    {
      label: "Enrol a contact",
      icon: <UserPlus className="h-3.5 w-3.5" />,
      onSelect: (row) => {
        setEnrolPhone("");
        setEnrolFor(row);
      },
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-3.5 w-3.5" />,
      onSelect: async (row) => {
        const res = await duplicateJourney(row.id);
        if (res.ok) router.push(`/sabsms/drips/${res.id}`);
        else toast({ title: "Duplicate failed", description: res.error, variant: "destructive" });
      },
    },
    {
      label: "Archive",
      icon: <Archive className="h-3.5 w-3.5" />,
      destructive: true,
      onSelect: (row) => void transition(row, "archived"),
    },
  ];

  const columns: SabsmsColumn<JourneyRow>[] = [
    {
      id: "name",
      header: "Journey",
      width: "minmax(220px, 1.6fr)",
      render: (r) => (
        <div className="space-y-0.5">
          <Link
            href={`/sabsms/drips/${r.id}`}
            className="font-medium text-[var(--st-text)] hover:underline"
          >
            {r.name}
          </Link>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--st-text-secondary)]">
            <span>{r.stepCount} steps</span>
            <span>·</span>
            <span>{r.sendCount} sends</span>
            {r.branchCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <GitBranch className="h-3 w-3" /> {r.branchCount}
                </span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "110px",
      render: (r) => {
        const cfg = STATUS_BADGE[r.status];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      id: "trigger",
      header: "Trigger",
      width: "150px",
      render: (r) => (
        <Badge variant="secondary" className="text-[10px]">
          {r.triggerLabel}
        </Badge>
      ),
    },
    {
      id: "ab",
      header: "A/B",
      width: "110px",
      render: (r) =>
        r.winnerCount > 0 ? (
          <Badge className="text-[10px]">
            <Trophy className="mr-1 h-3 w-3" /> Winner picked
          </Badge>
        ) : r.hasAb ? (
          <Badge variant="outline" className="text-[10px]">
            <FlaskConical className="mr-1 h-3 w-3" /> Testing
          </Badge>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">—</span>
        ),
    },
    {
      id: "activeRuns",
      header: "Active runs",
      width: "110px",
      align: "right",
      render: (r) => (
        <span className="flex items-center justify-end gap-1 font-mono text-xs">
          <Users className="h-3 w-3 text-[var(--st-text-secondary)]" />
          {r.activeRuns.toLocaleString()}
        </span>
      ),
    },
    {
      id: "sends",
      header: "Sent",
      width: "90px",
      align: "right",
      render: (r) => <span className="font-mono text-xs">{r.stats.sends.toLocaleString()}</span>,
    },
    {
      id: "replies",
      header: "Replies",
      width: "90px",
      align: "right",
      render: (r) => <span className="font-mono text-xs">{r.stats.replies.toLocaleString()}</span>,
    },
    {
      id: "clicks",
      header: "Clicks",
      width: "90px",
      align: "right",
      hideByDefault: true,
      render: (r) => <span className="font-mono text-xs">{r.stats.clicks.toLocaleString()}</span>,
    },
    {
      id: "completed",
      header: "Completed",
      width: "100px",
      align: "right",
      hideByDefault: true,
      render: (r) => (
        <span className="font-mono text-xs">{r.stats.completed.toLocaleString()}</span>
      ),
    },
    {
      id: "updated",
      header: "Updated",
      width: "140px",
      render: (r) => (
        <span className="text-xs text-[var(--st-text-secondary)]">
          {new Date(r.updatedAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <SabsmsFilterBar
        searchPlaceholder="Search journeys…"
        facets={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
        sortOptions={[
          { value: "newest", label: "Newest" },
          { value: "oldest", label: "Oldest" },
          { value: "name", label: "Name" },
          { value: "active_runs", label: "Active runs" },
        ]}
        defaultSort="newest"
      />

      <SabsmsDataTable<JourneyRow>
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        onRowClick={(r) => router.push(`/sabsms/drips/${r.id}`)}
        emptyTitle="No journeys match"
        emptyDescription="Adjust the filters, build a new drip, or import one from AWS Pinpoint."
        emptyAction={{ label: "New drip", href: "/sabsms/drips/create" }}
      />

      <Dialog open={enrolFor !== null} onOpenChange={(open) => !open && setEnrolFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enrol a contact</DialogTitle>
            <DialogDescription>
              Start one run of “{enrolFor?.name}” for a phone number. Suppressed numbers are
              refused and a contact can only be in a journey once at a time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="enrol-phone">Phone (E.164)</Label>
            <Input
              id="enrol-phone"
              placeholder="+15551234567"
              value={enrolPhone}
              onChange={(e) => setEnrolPhone(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnrolFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !enrolPhone.trim()}
              onClick={async () => {
                if (!enrolFor) return;
                setBusy(true);
                const res = await enrolContactFromList(enrolFor.id, enrolPhone);
                setBusy(false);
                if (res.ok) {
                  toast({ title: "Contact enrolled" });
                  setEnrolFor(null);
                  router.refresh();
                } else {
                  toast({
                    title: "Could not enrol",
                    description:
                      res.error === "suppressed"
                        ? "That number is on the suppression list."
                        : res.error === "duplicate"
                          ? "That number is already in this journey."
                          : res.error === "not_active"
                            ? "Activate the journey first."
                            : res.error,
                    variant: "destructive",
                  });
                }
              }}
            >
              Enrol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
