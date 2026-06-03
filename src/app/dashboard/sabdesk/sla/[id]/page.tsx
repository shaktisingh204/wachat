import { Button, Card } from "@/components/zoruui";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

/**
 * SLA policy detail page.
 *
 * Server component — fetches the SLA via the Rust-backed action,
 * renders the policy spec, escalation block, and any descriptive
 * notes.
 */

import Link from "next/link";

import { EntityDetailShell } from "@/components/crm/entity-detail-shell";
import { StatusPill, type StatusTone } from "@/components/crm/status-pill";
import { getSession } from "@/app/actions/user.actions";
import { getSlaById } from "@/app/actions/crm-sla.actions";
import type { CrmSlaStatus } from "@/lib/rust-client/crm-slas";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/sabdesk/sla";

const STATUS_TONE: Record<CrmSlaStatus, StatusTone> = {
  active: "green",
  archived: "neutral",
};

const PRIORITY_TONE: Record<string, StatusTone> = {
  low: "neutral",
  medium: "blue",
  high: "amber",
  urgent: "red",
};

function fmtMins(mins: number | undefined): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function SlaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect("/login");

  const sla = await getSlaById(id);
  if (!sla) notFound();

  const status = (sla.status ?? "active") as CrmSlaStatus;
  const tone = STATUS_TONE[status] ?? "neutral";
  const priority = String(sla.priority ?? "medium");
  const priorityTone = PRIORITY_TONE[priority] ?? "neutral";

  return (
    <EntityDetailShell
      eyebrow="SLA POLICY"
      title={sla.name}
      back={{ href: BASE, label: "SLA Policies" }}
      actions={
        <Button asChild>
          <Link href={`${BASE}/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      }
    >
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
          <StatusPill label={status} tone={tone} />
          <StatusPill label={priority} tone={priorityTone} />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
          <div>
            <div className="text-zoru-ink-muted">First response</div>
            <div className="font-mono text-zoru-ink">
              {fmtMins(sla.firstResponseMinutes)}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Resolution</div>
            <div className="font-mono text-zoru-ink">
              {fmtMins(sla.resolutionMinutes)}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Business hours only</div>
            <div className="text-zoru-ink">
              {sla.businessHoursOnly ? "Yes" : "No"}
            </div>
          </div>
        </div>
      </Card>

      {sla.escalateAfterMinutes || sla.escalateTo ? (
        <Card className="p-6">
          <div className="mb-3 text-[15px] font-medium text-zoru-ink">
            Escalation
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
            <div>
              <div className="text-zoru-ink-muted">Escalate after</div>
              <div className="font-mono text-zoru-ink">
                {fmtMins(sla.escalateAfterMinutes ?? undefined)}
              </div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Escalate to</div>
              <div className="font-mono text-zoru-ink">
                {sla.escalateTo || "—"}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {sla.description || sla.notes ? (
        <Card className="p-6">
          <div className="mb-3 text-[15px] font-medium text-zoru-ink">
            Notes
          </div>
          {sla.description ? (
            <div className="mb-4 space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Description
              </div>
              <p className="whitespace-pre-wrap text-zoru-ink">
                {sla.description}
              </p>
            </div>
          ) : null}
          {sla.notes ? (
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Internal notes
              </div>
              <p className="whitespace-pre-wrap text-zoru-ink">{sla.notes}</p>
            </div>
          ) : null}
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
