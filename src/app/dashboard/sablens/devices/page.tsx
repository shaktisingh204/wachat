import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';
import { listSablensDevices } from '@/app/actions/sablens.actions';

import { DeviceRegisterDialog } from './_components/device-register-dialog';

export const dynamic = 'force-dynamic';

export default async function SablensDevicesPage() {
  const res = await listSablensDevices({ limit: 100 });
  const devices = res.ok ? res.data.items : [];

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Registered devices</PageTitle>
          <PageDescription>
            Pre-paired customer devices for repeat unattended support — no
            join-token roundtrip needed.
          </PageDescription>
        </PageHeading>
        <DeviceRegisterDialog />
      </PageHeader>

      {!res.ok ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Couldn't load devices</CardTitle>
            <CardDescription>{res.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No devices yet</CardTitle>
            <CardDescription>
              Pair a customer's phone or tablet to skip the per-session join
              token next time.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <Card key={d._id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-1">{d.label}</CardTitle>
                  <Badge variant={d.online ? 'default' : 'secondary'}>
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
