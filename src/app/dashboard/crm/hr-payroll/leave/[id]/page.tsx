/**
 * Leave detail — `/dashboard/crm/hr-payroll/leave/[id]`.
 *
 * Server component: hydrates the application via the Rust client,
 * resolves the employee + approver chain through `<EntityPickerChip>`,
 * and renders the request details. Edit lives on this page; delete is
 * handled from the list page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Pencil, ArrowLeft } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import {
  getLeave,
  listLeaveTypeOptions,
} from '@/app/actions/crm/leaves.actions';
import type { CrmLeaveStatus } from '@/lib/rust-client/crm-leaves';

export const dynamic = 'force-dynamic';

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

const STATUS_VARIANT: Record<
  CrmLeaveStatus,
  'warning' | 'success' | 'danger' | 'secondary'
> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'secondary',
};

const STATUS_LABEL: Record<CrmLeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}

export default async function LeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ leave, error }, { options: leaveTypes }] = await Promise.all([
    getLeave(id),
    listLeaveTypeOptions(),
  ]);

  if (!leave) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this leave request — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/hr-payroll/leave">
              <ArrowLeft className="h-4 w-4" /> Back to Leave Requests
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const leaveType = leaveTypes.find((lt) => lt._id === leave.leaveTypeId);
  const ltLabel = leaveType
    ? `${leaveType.code} · ${leaveType.name}`
    : leave.leaveTypeId;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Leave request · ${ltLabel}`}
        subtitle={`${fmtDate(leave.from)} → ${fmtDate(leave.to)} · ${leave.days} day${leave.days === 1 ? '' : 's'}`}
        icon={CalendarDays}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/leave">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`/dashboard/crm/hr-payroll/leave/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </ZoruButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ZoruCard className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Request
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee">
              <EntityPickerChip entity="employee" id={leave.assignedTo} />
            </Field>
            <Field label="Leave type">
              <ZoruBadge variant="secondary" className="font-mono text-[11px]">
                {ltLabel}
              </ZoruBadge>
            </Field>
            <Field label="Start date">{fmtDate(leave.from)}</Field>
            <Field label="End date">{fmtDate(leave.to)}</Field>
            <Field label="Duration">
              {leave.days} day{leave.days === 1 ? '' : 's'}
              {leave.halfDay ? ' (half-day)' : ''}
            </Field>
            <Field label="Status">
              <ZoruBadge variant={STATUS_VARIANT[leave.status]}>
                {STATUS_LABEL[leave.status]}
              </ZoruBadge>
            </Field>
          </div>

          <h3 className="mb-4 mt-8 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Reason
          </h3>
          <div className="whitespace-pre-wrap rounded-md border border-zoru-line bg-zoru-surface p-3 text-[13px] text-zoru-ink">
            {leave.reason || (
              <span className="text-zoru-ink-muted">No reason provided.</span>
            )}
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Approver chain
          </h3>
          {leave.approverChain && leave.approverChain.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {leave.approverChain.map((step, i) => (
                <li
                  key={`${step.approverId ?? 'step'}-${i}`}
                  className="rounded-md border border-zoru-line bg-zoru-surface p-3 text-[12.5px]"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <EntityPickerChip
                      entity="user"
                      id={step.approverId}
                      fallback="Unknown approver"
                    />
                    {step.status ? (
                      <ZoruBadge variant={STATUS_VARIANT[step.status]}>
                        {STATUS_LABEL[step.status]}
                      </ZoruBadge>
                    ) : null}
                  </div>
                  <div className="text-zoru-ink-muted">
                    {fmtDateTime(step.decidedAt)}
                  </div>
                  {step.comment ? (
                    <div className="mt-1.5 whitespace-pre-wrap text-zoru-ink">
                      {step.comment}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12.5px] text-zoru-ink-muted">
              No approver decisions yet.
            </p>
          )}

          {typeof leave.balanceSnapshot === 'number' ? (
            <div className="mt-6 border-t border-zoru-line pt-4">
              <Field label="Balance at submission">
                <span className="tabular-nums">
                  {leave.balanceSnapshot} day
                  {leave.balanceSnapshot === 1 ? '' : 's'}
                </span>
              </Field>
            </div>
          ) : null}
        </ZoruCard>
      </div>

      <div className="text-[11px] text-zoru-ink-muted">
        Created {fmtDate(leave.createdAt)} · Updated {fmtDate(leave.updatedAt)}
      </div>
    </div>
  );
}
