import Link from "next/link";

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from "@/components/zoruui";

export const dynamic = "force-dynamic";

const phaseStatus = [
  { label: "Phase 0 · Foundations", status: "Live" as const },
  { label: "Phase 1 · Twilio send + DLR + inbound", status: "Live" as const },
  { label: "Phase 2 · 2-way inbox", status: "Planned" as const },
  { label: "Phase 3 · Templates", status: "Planned" as const },
  { label: "Phase 4 · Campaigns + drips", status: "Planned" as const },
  { label: "Phase 7 · Multi-provider routing", status: "Planned" as const },
  { label: "Phase 8 · Compliance + consent ledger", status: "Planned" as const },
  { label: "Phase 10 · RCS Business Messaging", status: "Planned" as const },
];

const enabled =
  (process.env.SABSMS_ENABLED ?? "false").toLowerCase() === "true";

export default function SabsmsOverviewPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>SabSMS</ZoruPageTitle>
          <ZoruPageDescription>
            Multi-provider SMS / MMS / RCS, powered by a dedicated Rust
            engine. See{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              plans/sabsms-world-class-plan.md
            </code>{" "}
            for the full roadmap.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Engine</ZoruCardTitle>
          <ZoruCardDescription>
            The Rust SabSMS engine handles every send, every DLR, and every
            inbound message — Next.js is the orchestrator.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            {enabled ? (
              <ZoruBadge variant="default">enabled</ZoruBadge>
            ) : (
              <ZoruBadge variant="secondary">disabled (SABSMS_ENABLED=false)</ZoruBadge>
            )}
            <span className="text-slate-600">
              {process.env.SABSMS_ENGINE_URL ?? "http://localhost:4002"}
            </span>
          </div>
          <div className="flex gap-2">
            <ZoruButton asChild variant="default">
              <Link href="/admin/dashboard/sabsms/debug">Open debug send</Link>
            </ZoruButton>
            <ZoruButton asChild variant="outline">
              <Link href="/sabsms/inbox">Open inbox</Link>
            </ZoruButton>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Rollout</ZoruCardTitle>
          <ZoruCardDescription>
            Phase status from the 14-phase plan.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ul className="space-y-2 text-sm">
            {phaseStatus.map((p) => (
              <li
                key={p.label}
                className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0"
              >
                <span className="text-slate-700">{p.label}</span>
                <ZoruBadge
                  variant={p.status === "Live" ? "default" : "secondary"}
                >
                  {p.status}
                </ZoruBadge>
              </li>
            ))}
          </ul>
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}
