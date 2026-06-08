import { Smartphone } from 'lucide-react';

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { listSablensDevices } from '@/app/actions/sablens.actions';

import { DeviceRegisterDialog } from './_components/device-register-dialog';

export const dynamic = 'force-dynamic';

export default async function SablensDevicesPage() {
  const res = await listSablensDevices({ limit: 100 });
  const devices = res.ok ? res.data.items : [];

  return (
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Registered devices</PageTitle>
          <PageDescription>
            Pre-paired customer devices for repeat unattended support, no
            join-token roundtrip needed.
          </PageDescription>
        </PageHeading>
        <DeviceRegisterDialog />
      </PageHeader>

      {!res.ok ? (
        <Alert tone="danger" title="Couldn't load devices">
          {res.error}
        </Alert>
      ) : devices.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No devices yet"
          description="Pair a customer's phone or tablet to skip the per-session join token next time."
          action={<DeviceRegisterDialog />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <Card key={d._id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-1">{d.label}</CardTitle>
                  <Badge tone={d.online ? 'success' : 'neutral'} dot>
                    {d.online ? 'online' : 'offline'}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-1">
                  {d.deviceFingerprint}
                </CardDescription>
              </CardHeader>
              <CardBody className="text-xs text-[var(--st-text-secondary)]">
                Last seen{' '}
                {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'never'}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
