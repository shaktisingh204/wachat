'use client';

import { UserRound } from 'lucide-react';

import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { SabChatConversation } from '@/lib/rust-client/sabchat';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--st-text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--st-text)]">{value}</span>
    </div>
  );
}

export function Contact360({ selected }: { selected: SabChatConversation | undefined }) {
  if (!selected) {
    return (
      <aside className="col-span-3 flex items-center justify-center overflow-y-auto p-3">
        <EmptyState
          icon={UserRound}
          title="No conversation selected"
          description="Select a conversation to view contact details."
        />
      </aside>
    );
  }

  const initials = selected.contactId.slice(0, 2).toUpperCase();
  const displayName = selected.contactId.slice(-6);

  return (
    <aside className="col-span-3 space-y-3 overflow-y-auto p-3">
      <Card padding="md">
        <CardHeader>
          <CardTitle>Contact 360</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-3">
            <Avatar name={displayName} initials={initials} shape="round" />
            <div>
              <div className="text-sm font-medium text-[var(--st-text)]">{displayName}</div>
              <div className="text-xs text-[var(--st-text-secondary)]">Customer</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>CRM Records</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <Row label="Company" value="Acme Corp" />
          <Row label="ARR" value="$120,000" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--st-text-secondary)]">Tier</span>
            <Badge tone="accent" kind="soft">
              Enterprise
            </Badge>
          </div>
        </CardBody>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>Deal History</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--st-status-ok)]"
              aria-hidden="true"
            />
            <div>
              <div className="font-medium text-[var(--st-text)]">Upsell Q3 (Won)</div>
              <div className="text-xs text-[var(--st-text-secondary)]">Sep 15, 2023, $15k</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--st-accent)]"
              aria-hidden="true"
            />
            <div>
              <div className="font-medium text-[var(--st-text)]">Renewal (Open)</div>
              <div className="text-xs text-[var(--st-text-secondary)]">Expected Dec 1, 2023, $120k</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>Ad Attribution</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <Row label="Source" value="Google Ads" />
          <Row label="Campaign" value="Q4_Enterprise_Search" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--st-text-secondary)]">Term</span>
            <span
              className="max-w-[100px] truncate font-medium text-[var(--st-text)]"
              title="omnichannel inbox"
            >
              omnichannel...
            </span>
          </div>
        </CardBody>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>SLA &amp; Assignment</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--st-text-secondary)]">SLA</span>
            {selected.sla?.breached ? (
              <Badge tone="danger" kind="soft">
                Breached
              </Badge>
            ) : (
              <Badge tone="success" kind="outline">
                On track
              </Badge>
            )}
          </div>
          <Row label="Assignee" value={selected.assigneeId ?? 'Unassigned'} />
        </CardBody>
      </Card>

      {selected.customAttrs && Object.keys(selected.customAttrs).length > 0 && (
        <Card padding="md">
          <CardHeader>
            <CardTitle>Custom Attributes</CardTitle>
          </CardHeader>
          <CardBody>
            <pre className="max-h-40 overflow-auto rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-2 text-[10px] text-[var(--st-text)]">
              {JSON.stringify(selected.customAttrs, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}
    </aside>
  );
}
