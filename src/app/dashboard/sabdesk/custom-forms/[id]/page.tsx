import {
  Badge,
  Button,
  Card,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

/**
 * Custom form detail page.
 *
 * Renders the form's metadata + a structured table of its field
 * definitions (no JSON dump).
 */

import Link from "next/link";

import { EntityDetailShell } from "@/components/crm/entity-detail-shell";
import { StatusPill, type StatusTone } from "@/components/crm/status-pill";
import { getSession } from "@/app/actions/user.actions";
import { getFormById } from "@/app/actions/crm-forms.actions";
import type { CrmFormStatus } from "@/lib/rust-client/crm-forms";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/sabdesk/custom-forms";

const STATUS_TONE: Record<CrmFormStatus, StatusTone> = {
  draft: "amber",
  published: "green",
  archived: "neutral",
};

export default async function CustomFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect("/login");

  const form = await getFormById(id);
  if (!form) notFound();

  const status = (form.status ?? "draft") as CrmFormStatus;
  const tone = STATUS_TONE[status] ?? "neutral";
  const fields = Array.isArray(form.fields) ? form.fields : [];
  const settings = (form.settings ?? {}) as Record<string, unknown>;

  return (
    <EntityDetailShell
      eyebrow="CUSTOM FORM"
      title={form.name}
      back={{ href: BASE, label: "Custom Forms" }}
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
          <div className="text-[14px] font-medium text-[var(--st-text)]">Overview</div>
          <StatusPill label={status} tone={tone} />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
          <div>
            <div className="text-[var(--st-text-secondary)]">Slug</div>
            <div className="font-mono text-[var(--st-text)]">{form.slug || "—"}</div>
          </div>
          <div>
            <div className="text-[var(--st-text-secondary)]">Submissions</div>
            <div className="font-mono text-[var(--st-text)]">
              {form.submissionCount ?? 0}
            </div>
          </div>
          <div>
            <div className="text-[var(--st-text-secondary)]">Field count</div>
            <div className="font-mono text-[var(--st-text)]">{fields.length}</div>
          </div>
          {settings.redirectUrl ? (
            <div className="sm:col-span-3">
              <div className="text-[var(--st-text-secondary)]">Redirect URL</div>
              <a
                href={String(settings.redirectUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
              >
                {String(settings.redirectUrl)}
              </a>
            </div>
          ) : null}
          {settings.successMessage ? (
            <div className="sm:col-span-3">
              <div className="text-[var(--st-text-secondary)]">Success message</div>
              <div className="whitespace-pre-wrap text-[var(--st-text)]">
                {String(settings.successMessage)}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-3 text-[15px] font-medium text-[var(--st-text)]">
          Fields ({fields.length})
        </div>
        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
            This form has no fields yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">
                    #
                  </ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">
                    Name
                  </ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">
                    Label
                  </ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">
                    Type
                  </ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">
                    Required
                  </ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">
                    Options
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {fields.map((f, idx) => (
                  <ZoruTableRow
                    key={`${f.name}-${idx}`}
                    className="border-[var(--st-border)]"
                  >
                    <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                      {idx + 1}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-[var(--st-text)]">
                      {f.name}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[var(--st-text)]">
                      {f.label || "—"}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[var(--st-text)]">
                      {f.type || "text"}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {f.required ? (
                        <Badge variant="warning">Required</Badge>
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[260px]">
                      {Array.isArray(f.options) && f.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {f.options.map((o, i) => (
                            <Badge key={`${o}-${i}`} variant="ghost">
                              {o}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                      )}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          </div>
        )}
      </Card>
    </EntityDetailShell>
  );
}
