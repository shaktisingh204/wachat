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
  ObjectId } from 'mongodb';
import { Plus,
  Timer } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

import Link from 'next/link';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnySla = {
  _id?: { toString(): string } | string;
  name?: string;
  firstResponseMins?: number;
  firstResponseTargetMins?: number;
  resolutionMins?: number;
  resolutionTargetMins?: number;
  businessHours?: string | Record<string, unknown>;
  active?: boolean;
  priority?: string;
  createdAt?: string | Date;
};

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'published' || s === 'approved') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'archived' || s === 'disabled' || s === 'cancelled') return 'danger';
  return 'warning';
}

function renderBusinessHours(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
}

export default async function SlaPoliciesPage() {
  let slas: AnySla[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id);
      const docs = await db
        .collection('crm_slas')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      slas = JSON.parse(JSON.stringify(docs)) as AnySla[];
    } catch (e) {
      console.error('Failed to load CRM SLAs:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="SLA Policies"
        subtitle="Define first-response and resolution targets per ticket priority."
        icon={Timer}
        actions={
          <Link href="/dashboard/crm/tickets/sla/new">
            <ZoruButton variant="outline">
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New SLA
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All SLA policies</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            First-response and resolution clocks with business-hour awareness.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">First-response (mins)</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Resolution (mins)</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Business hours</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Priority</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Active</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load SLA policies. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : slas.length > 0 ? (
                slas.map((s, idx) => {
                  const id =
                    typeof s._id === 'string'
                      ? s._id
                      : s._id?.toString?.() ?? String(idx);
                  const firstResp =
                    (s as any).firstResponseMins ??
                    (s as any).firstResponseTargetMins;
                  const resolution =
                    (s as any).resolutionMins ?? (s as any).resolutionTargetMins;
                  const isActive = Boolean((s as any).active);
                  const priority = (s as any).priority as string | undefined;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <Link
                          href={`/dashboard/crm/tickets/sla/${id}`}
                          className="hover:underline"
                        >
                          {s.name || 'Untitled SLA'}
                        </Link>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {typeof firstResp === 'number' ? firstResp : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {typeof resolution === 'number' ? resolution : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {renderBusinessHours((s as any).businessHours)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {priority ? (
                          <ZoruBadge variant={getStatusVariant(priority)}>
                            {priority}
                          </ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={isActive ? 'success' : 'ghost'}>
                          {isActive ? 'Yes' : 'No'}
                        </ZoruBadge>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No SLA policies yet. Create your first SLA to start enforcing
                    response and resolution targets.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
