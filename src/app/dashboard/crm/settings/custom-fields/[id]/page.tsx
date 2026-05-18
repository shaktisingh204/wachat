import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Custom field detail page.
 *
 * Server component — fetches a single `crm_custom_fields` doc via the
 * Rust-backed `getCustomFieldById` action and renders it inside an
 * `<EntityDetailShell />`. Action group: Edit · Toggle Required ·
 * Archive · (Activity is rendered as the audit timeline footer).
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getSession } from '@/app/actions/user.actions';
import { getCustomFieldById } from '@/app/actions/crm-custom-fields.actions';

import {
  CustomFieldDetailActions,
  CustomFieldFlagToggle,
} from './_components/custom-field-detail-actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/settings/custom-fields';

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function entityLabel(kind: string): string {
  const m: Record<string, string> = {
    contact: 'Contacts',
    deal: 'Deals',
    lead: 'Leads',
    account: 'Accounts',
    ticket: 'Tickets',
    employee: 'Employees',
    vendor: 'Vendors',
    item: 'Items',
    project: 'Projects',
  };
  return m[kind] ?? kind;
}

export default async function CustomFieldDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const field = await getCustomFieldById(id);
  if (!field) notFound();

  return (
    <EntityDetailShell
        title={field.label}
        eyebrow={`CUSTOM FIELD · ${entityLabel(field.entityKind).toUpperCase()}`}
        status={{
          label: field.isActive ? 'Active' : 'Inactive',
          tone: field.isActive ? 'green' : 'neutral',
        }}
        back={{ href: BASE, label: 'Back to Custom Fields' }}
        actions={
          <>
            <ZoruButton asChild>
              <Link href={`${BASE}/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </ZoruButton>
            <CustomFieldFlagToggle
              fieldId={String(field._id)}
              required={field.required}
            />
            <CustomFieldDetailActions
              fieldId={String(field._id)}
              isActive={field.isActive}
            />
          </>
        }
        audit={
          <EntityAuditTimeline
            entityKind="crm_custom_field"
            entityId={String(field._id)}
          />
        }
      >
        {/* Summary */}
        <ZoruCard className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
            <ZoruBadge variant="outline" className="capitalize">
              {field.fieldType}
            </ZoruBadge>
            {field.required ? (
              <ZoruBadge variant="warning">Required</ZoruBadge>
            ) : null}
            {field.unique ? (
              <ZoruBadge variant="info">Unique</ZoruBadge>
            ) : null}
            {field.section ? (
              <ZoruBadge variant="ghost">{field.section}</ZoruBadge>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
            <div>
              <div className="text-zoru-ink-muted">Internal name</div>
              <div className="font-mono text-zoru-ink">{field.name}</div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Entity</div>
              <div className="text-zoru-ink">{entityLabel(field.entityKind)}</div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Display order</div>
              <div className="text-zoru-ink">{field.displayOrder ?? 0}</div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Placeholder</div>
              <div className="text-zoru-ink">{field.placeholder ?? '—'}</div>
            </div>
            {field.helpText ? (
              <div className="sm:col-span-2">
                <div className="text-zoru-ink-muted">Help text</div>
                <div className="text-zoru-ink">{field.helpText}</div>
              </div>
            ) : null}
            <div>
              <div className="text-zoru-ink-muted">Last updated</div>
              <div className="text-zoru-ink">{fmtDate(field.updatedAt)}</div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Created</div>
              <div className="text-zoru-ink">{fmtDate(field.createdAt)}</div>
            </div>
          </div>
        </ZoruCard>

        {/* Flags */}
        <ZoruCard className="p-6">
          <div className="mb-3 text-[14px] font-medium text-zoru-ink">
            Display flags
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
            <FlagLine label="Required" value={field.required} />
            <FlagLine label="Unique" value={field.unique} />
            <FlagLine label="Visible in list" value={field.visibleInList} />
            <FlagLine label="Visible in form" value={field.visibleInForm} />
            <FlagLine label="Editable in form" value={field.editableInForm} />
            <FlagLine label="Active" value={field.isActive} />
          </div>
        </ZoruCard>

        {/* Options */}
        {field.options && field.options.length > 0 ? (
          <ZoruCard className="p-6">
            <div className="mb-3 text-[14px] font-medium text-zoru-ink">
              Options
            </div>
            <div className="flex flex-wrap gap-2">
              {field.options.map((opt) => (
                <ZoruBadge
                  key={opt.value}
                  variant="outline"
                  style={
                    opt.color
                      ? {
                          borderColor: opt.color,
                          color: opt.color,
                        }
                      : undefined
                  }
                >
                  {opt.label}
                </ZoruBadge>
              ))}
            </div>
          </ZoruCard>
        ) : null}

        {/* Validation */}
        {field.validation &&
        (field.validation.min !== undefined ||
          field.validation.max !== undefined ||
          typeof field.validation.pattern === 'string') ? (
          <ZoruCard className="p-6">
            <div className="mb-3 text-[14px] font-medium text-zoru-ink">
              Validation
            </div>
            <div className="grid grid-cols-3 gap-3 text-[13px]">
              <div>
                <div className="text-zoru-ink-muted">Min</div>
                <div className="text-zoru-ink">
                  {field.validation.min ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-zoru-ink-muted">Max</div>
                <div className="text-zoru-ink">
                  {field.validation.max ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-zoru-ink-muted">Pattern</div>
                <div className="font-mono text-zoru-ink">
                  {field.validation.pattern ?? '—'}
                </div>
              </div>
            </div>
          </ZoruCard>
        ) : null}
  </EntityDetailShell>
  );
}

function FlagLine({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-zoru-ink-muted">{label}</span>
      <span className={value ? 'text-zoru-ink' : 'text-zoru-ink-muted'}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  );
}
