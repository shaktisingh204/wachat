import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
import { listSablensDevices } from '@/app/actions/sablens.actions';

import { DeviceRegisterDialog } from './_components/device-register-dialog';

export const dynamic = 'force-dynamic';

export default async function SablensDevicesPage() {
  const res = await listSablensDevices({ limit: 100 });
  const devices = res.ok ? res.data.items : [];

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Registered devices</ZoruPageTitle>
          <ZoruPageDescription>
            Pre-paired customer devices for repeat unattended support — no
            join-token roundtrip needed.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <DeviceRegisterDialog />
      </PageHeader>

      {!res.ok ? (
        <Card className="border-destructive/40">
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load devices</ZoruCardTitle>
            <ZoruCardDescription>{res.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>No devices yet</ZoruCardTitle>
            <ZoruCardDescription>
              Pair a customer's phone or tablet to skip the per-session join
              token next time.
            </ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <Card key={d._id}>
              <ZoruCardHeader>
                <div className="flex items-start justify-between gap-3">
                  <ZoruCardTitle className="line-clamp-1">{d.label}</ZoruCardTitle>
                  <Badge variant={d.online ? 'default' : 'secondary'}>
                    {d.online ? 'online' : 'offline'}
                  </Badge>
                </div>
                <ZoruCardDescription className="line-clamp-1">
                  {d.deviceFingerprint}
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="text-xs text-zoru-ink-muted">
                Last seen{' '}
                {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'never'}
              </ZoruCardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
