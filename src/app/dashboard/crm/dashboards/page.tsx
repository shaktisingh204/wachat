import { ZoruButton, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import {
  ObjectId } from 'mongodb';
import { Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';

import Link from 'next/link';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

type AnyDashboard = {
  _id?: { toString(): string } | string;
  title?: string;
  ownerName?: string;
  ownerId?: string;
  widgets?: unknown[];
  sharedWith?: unknown;
  shareScope?: string;
  updatedAt?: string | Date;
  createdAt?: string | Date;
};

function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function renderSharedWith(value: unknown, scope?: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return scope || '—';
    if (value.length <= 3) return value.map((v) => String(v)).join(', ');
    return `${value.length} members`;
  }
  if (typeof value === 'string' && value.trim()) return value;
  if (scope && scope.trim()) return scope;
  return '—';
}

export default async function CustomDashboardsPage() {
  let dashboards: AnyDashboard[] = [];
  let loadError = false;

  const session = await getSession();
  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id);
      const docs = await db
        .collection('crm_dashboards')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      dashboards = JSON.parse(JSON.stringify(docs)) as AnyDashboard[];
    } catch (e) {
      console.error('Failed to load CRM dashboards:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Custom Dashboards"
      subtitle="Build your own dashboards with the metrics that matter to your team."
      primaryAction={
        <Link href="/dashboard/crm/dashboards/new">
          <ZoruButton variant="outline">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New dashboard
          </ZoruButton>
        </Link>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All dashboards</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Boards owned by you or shared with your team.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Widgets</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Shared with</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Updated</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load dashboards. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : dashboards.length > 0 ? (
                dashboards.map((d, idx) => {
                  const id =
                    typeof d._id === 'string'
                      ? d._id
                      : d._id?.toString?.() ?? String(idx);
                  const owner =
                    (d as any).ownerName || (d as any).ownerId || '—';
                  const widgets = (d as any).widgets;
                  const widgetCount = Array.isArray(widgets) ? widgets.length : 0;
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        <EntityRowLink
                          href={`/dashboard/crm/dashboards/${id}`}
                          label={d.title || 'Untitled dashboard'}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">{owner}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {widgetCount}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {renderSharedWith(
                          (d as any).sharedWith,
                          (d as any).shareScope,
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDateTime((d as any).updatedAt)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No dashboards yet. Build your first board with the widgets that
                    matter to your team.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
