/**
 * Connectors — one-click prebuilt semantic models over other SabNode modules.
 *
 * Connecting a module seeds a governed `BiModel` (with correct per-collection
 * tenant scoping) you can then query, X-ray (P7), or build dashboards on.
 */
import {
  Boxes,
  CreditCard,
  FileSignature,
  Globe,
  MessageSquare,
  Plug,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
} from '@/components/sabcrm/20ui';
import { listConnectedAction } from '@/app/actions/sabbi-connectors.actions';
import { CONNECTORS, type ConnectorDef } from '@/lib/sabbi/connectors';

import { ConnectButton } from './_components/connect-button';

export const dynamic = 'force-dynamic';

const GROUP_ICON: Record<ConnectorDef['group'], LucideIcon> = {
  CRM: Users,
  Payments: CreditCard,
  Comms: MessageSquare,
  Documents: FileSignature,
  Web: Globe,
};

const GROUP_ORDER: ConnectorDef['group'][] = ['CRM', 'Payments', 'Comms', 'Documents', 'Web'];

export default async function ConnectorsPage() {
  let connected: Record<string, string> = {};
  try {
    connected = await listConnectedAction();
  } catch {
    connected = {};
  }
  const connectedCount = Object.keys(connected).length;

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI · Semantic layer</PageEyebrow>
          <PageTitle>Connectors</PageTitle>
          <PageDescription>
            Connect a SabNode module to seed a governed model with measures and
            dimensions — wired to the right tenant scope for that collection.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-2 gap-[var(--st-space-4)] sm:grid-cols-3">
        <StatCard label="Available" value={CONNECTORS.length} icon={Plug} accent="var(--st-accent)" />
        <StatCard label="Connected" value={connectedCount} icon={Boxes} />
        <StatCard label="Modules" value={GROUP_ORDER.length} icon={Globe} />
      </div>

      {GROUP_ORDER.map((group) => {
        const items = CONNECTORS.filter((c) => c.group === group);
        if (items.length === 0) return null;
        const GroupIcon = GROUP_ICON[group];
        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GroupIcon size={16} aria-hidden="true" />
                {group}
              </CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-2">
              {items.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--st-text)]">{c.label}</span>
                      <Badge tone="neutral">{c.model.measures?.length ?? 0}m · {c.model.dimensions?.length ?? 0}d</Badge>
                    </div>
                    <p className="text-sm text-[var(--st-text-secondary)]">{c.description}</p>
                  </div>
                  <ConnectButton connectorKey={c.key} connectedModelId={connected[c.key]} />
                </div>
              ))}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
