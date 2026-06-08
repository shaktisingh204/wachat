import Link from 'next/link';
import { ArrowLeft, Fingerprint, Smartphone, Wifi } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  StatCard,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/sabcrm/20ui';
import { listSablensDevices } from '@/app/actions/sablens.actions';

import { DeviceRegisterDialog } from './_components/device-register-dialog';

export const dynamic = 'force-dynamic';

export default async function SablensDevicesPage() {
  const res = await listSablensDevices({ limit: 100 });
  const devices = res.ok ? res.data.items : [];

  const online = devices.filter((d) => d.online).length;

  return (
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>SabLens</PageEyebrow>
          <PageTitle>Registered devices</PageTitle>
          <PageDescription>
            Pre-paired customer devices for repeat, unattended support, no
            join-token roundtrip needed.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/sablens">
              <ArrowLeft className="size-4" aria-hidden="true" />
              All sessions
            </Link>
          </Button>
          <DeviceRegisterDialog />
        </PageActions>
      </PageHeader>

      {res.ok && devices.length > 0 ? (
        <section
          aria-label="Device overview"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <StatCard
            label="Paired devices"
            value={devices.length}
            icon={Smartphone}
            accent="#3b7af5"
          />
          <StatCard
            label="Online now"
            value={online}
            icon={Wifi}
            accent="#1f9d55"
          />
          <StatCard
            label="Offline"
            value={devices.length - online}
            icon={Smartphone}
            accent="#64748b"
          />
        </section>
      ) : null}

      {!res.ok ? (
        <Alert tone="danger" title="Couldn't load devices">
          {res.error}
        </Alert>
      ) : devices.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Smartphone}
            title="No devices yet"
            description="Pair a customer's phone or tablet to skip the per-session join token next time."
            action={<DeviceRegisterDialog />}
          />
        </Card>
      ) : (
        <Card variant="outlined" padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>Device</Th>
                <Th>Fingerprint</Th>
                <Th>Status</Th>
                <Th align="right">Last seen</Th>
              </Tr>
            </THead>
            <TBody>
              {devices.map((d) => (
                <Tr key={d._id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 font-medium text-[var(--st-text)]">
                      <Smartphone
                        className="size-4 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      {d.label}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--st-text-secondary)]">
                      <Fingerprint className="size-3.5" aria-hidden="true" />
                      <span className="max-w-[18ch] truncate">
                        {d.deviceFingerprint}
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={d.online ? 'success' : 'neutral'} dot>
                      {d.online ? 'Online' : 'Offline'}
                    </Badge>
                  </Td>
                  <Td align="right" className="tabular-nums text-[var(--st-text-secondary)]">
                    {d.lastSeenAt
                      ? new Date(d.lastSeenAt).toLocaleString()
                      : 'Never'}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
