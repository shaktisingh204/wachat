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
  Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

type AnyAutomation = {
  _id?: { toString(): string } | string;
  name?: string;
  trigger?: string; // lead-created/stage-change/time-based/form-submit/etc
  actionsCount?: number;
  conditionsCount?: number;
  isActive?: boolean;
  lastRunAt?: string | Date;
  runCount?: number;
  createdAt?: string | Date;
};

function formatTrigger(trigger?: string): string {
  if (!trigger) return '—';
  return trigger
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(value: string | Date | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return String(value);
}

export default async function AutomationsPage() {
  const session = await getSession();
  let automations: AnyAutomation[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_automations')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      automations = JSON.parse(JSON.stringify(docs)) as AnyAutomation[];
    } catch (e) {
      console.error('Failed to load crm_automations:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Automations"
      subtitle="Trigger-based rules that send emails, create tasks and update records automatically."
      primaryAction={
        <ZoruButton variant="outline" size="sm" asChild>
          <Link href="/dashboard/crm/sales-crm/automations/new">
            <Plus className="h-4 w-4" /> New automation
          </Link>
        </ZoruButton>
      }
    >

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All automations</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Active and paused rules with trigger type, action count and run history.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Trigger</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Actions</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Conditions</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Runs</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Last run</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Active</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load automations. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : automations.length > 0 ? (
                automations.map((automation, idx) => {
                  const id =
                    typeof automation._id === 'string'
                      ? automation._id
                      : (automation._id as any)?.toString?.() ?? String(idx);
                  const isActive = Boolean(automation.isActive);
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="text-zoru-ink">
                        {automation.name || 'Untitled automation'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatTrigger(automation.trigger)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber(automation.actionsCount)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber(automation.conditionsCount)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatNumber(automation.runCount)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(automation.lastRunAt)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {isActive ? (
                          <ZoruBadge variant="success">Yes</ZoruBadge>
                        ) : (
                          <ZoruBadge variant="ghost">No</ZoruBadge>
                        )}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No automations yet. Create rules to automate follow-ups, task creation and field
                    updates.
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
