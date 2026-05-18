import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FormInput,
  Pencil } from 'lucide-react';

/**
 * Custom form detail page.
 *
 * Renders the form's metadata + a structured table of its field
 * definitions (no JSON dump).
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { getSession } from '@/app/actions/user.actions';
import { getFormById } from '@/app/actions/crm-forms.actions';
import type { CrmFormStatus } from '@/lib/rust-client/crm-forms';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tickets/custom-forms';

const STATUS_TONE: Record<CrmFormStatus, StatusTone> = {
  draft: 'amber',
  published: 'green',
  archived: 'neutral',
};

export default async function CustomFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const form = await getFormById(id);
  if (!form) notFound();

  const status = (form.status ?? 'draft') as CrmFormStatus;
  const tone = STATUS_TONE[status] ?? 'neutral';
  const fields = Array.isArray(form.fields) ? form.fields : [];
  const settings = (form.settings ?? {}) as Record<string, unknown>;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'Tickets', href: '/dashboard/crm/tickets' },
          { label: 'Custom Forms', href: BASE },
          { label: form.name },
        ]}
        title={form.name}
        subtitle={form.slug ? `/${form.slug}` : 'Custom form'}
        icon={FormInput}
        actions={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" asChild>
              <Link href={BASE}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </ZoruButton>
          </div>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
          <StatusPill label={status} tone={tone} />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
          <div>
            <div className="text-zoru-ink-muted">Slug</div>
            <div className="font-mono text-zoru-ink">{form.slug || '—'}</div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Submissions</div>
            <div className="font-mono text-zoru-ink">
              {form.submissionCount ?? 0}
            </div>
          </div>
          <div>
            <div className="text-zoru-ink-muted">Field count</div>
            <div className="font-mono text-zoru-ink">{fields.length}</div>
          </div>
          {settings.redirectUrl ? (
            <div className="sm:col-span-3">
              <div className="text-zoru-ink-muted">Redirect URL</div>
              <a
                href={String(settings.redirectUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
              >
                {String(settings.redirectUrl)}
              </a>
            </div>
          ) : null}
          {settings.successMessage ? (
            <div className="sm:col-span-3">
              <div className="text-zoru-ink-muted">Success message</div>
              <div className="whitespace-pre-wrap text-zoru-ink">
                {String(settings.successMessage)}
              </div>
            </div>
          ) : null}
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <div className="mb-3 text-[15px] font-medium text-zoru-ink">
          Fields ({fields.length})
        </div>
        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
            This form has no fields yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">#</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Name
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Label
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Type
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Required
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Options
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {fields.map((f, idx) => (
                  <ZoruTableRow key={`${f.name}-${idx}`} className="border-zoru-line">
                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                      {idx + 1}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-zoru-ink">
                      {f.name}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {f.label || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">
                      {f.type || 'text'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {f.required ? (
                        <ZoruBadge variant="warning">Required</ZoruBadge>
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[260px]">
                      {Array.isArray(f.options) && f.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {f.options.map((o, i) => (
                            <ZoruBadge key={`${o}-${i}`} variant="ghost">
                              {o}
                            </ZoruBadge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        )}
      </ZoruCard>
    </div>
  );
}
