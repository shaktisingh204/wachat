import Link from 'next/link';
import { ObjectId } from 'mongodb';
import { Globe, Plus } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnyPortalUser = {
  _id?: { toString(): string } | string;
  name?: string;
  email?: string;
  portalType?: string;
  type?: string;
  capabilities?: string[];
  lastLoginAt?: string | Date;
  status?: string;
  createdAt?: string | Date;
};

function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function getStatusVariant(
  status?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'published' || s === 'approved') return 'success';
  if (s === 'draft' || s === 'pending') return 'ghost';
  if (s === 'archived' || s === 'disabled' || s === 'cancelled') return 'danger';
  return 'warning';
}

function getTypeVariant(
  type?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  const t = (type || '').toLowerCase();
  if (t === 'customer') return 'success';
  if (t === 'vendor') return 'warning';
  if (t === 'employee') return 'ghost';
  return 'ghost';
}

export default async function CustomerPortalPage() {
  let users: AnyPortalUser[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id);
      const docs = await db
        .collection('crm_portal_users')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      users = JSON.parse(JSON.stringify(docs)) as AnyPortalUser[];
    } catch (e) {
      console.error('Failed to load CRM portal users:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Customer Portal"
        subtitle="Self-service portal where customers see invoices, tickets and documents."
        icon={Globe}
        actions={
          <Link href="/dashboard/crm/portal/new">
            <ZoruButton variant="outline">
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New portal user
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All portal users</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            People with access to your customer, vendor or employee portal.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Email</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Capabilities</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Last login</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load portal users. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : users.length > 0 ? (
                users.map((u, idx) => {
                  const id =
                    typeof u._id === 'string'
                      ? u._id
                      : u._id?.toString?.() ?? String(idx);
                  const portalType =
                    (u as any).portalType || (u as any).type;
                  const caps = (u as any).capabilities;
                  const capsLabel =
                    Array.isArray(caps) && caps.length > 0
                      ? caps.join(', ')
                      : '—';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <Link
                          href={`/dashboard/crm/portal/${id}`}
                          className="hover:underline"
                        >
                          {u.name || 'Unnamed user'}
                        </Link>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {u.email || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {portalType ? (
                          <ZoruBadge variant={getTypeVariant(portalType)}>
                            {portalType}
                          </ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {capsLabel}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDateTime((u as any).lastLoginAt)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={getStatusVariant(u.status)}>
                          {u.status || 'pending'}
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
                    No portal users yet. Invite customers, vendors or employees to
                    your self-service portal.
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
