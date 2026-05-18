import * as React from 'react';
import Link from 'next/link';
import { Smartphone, ArrowRight } from 'lucide-react';

import { ZoruCard, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle, ZoruButton } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { SettingsTabs } from '../_components/settings-tabs';

export const metadata = { title: 'Settings — Devices — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings — Devices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inspect every linked device for this number and unlink anything that looks off.
          </p>
        </div>
      </div>
      <SettingsTabs />

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Linked Devices</ZoruCardTitle>
          <ZoruCardDescription>
            Device management lives on the dedicated Linked Devices page — health, platform, last-seen, and
            unlink controls for every device paired with your SabWa session.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ZoruButton asChild>
            <Link href="/sabwa/devices">
              Open Linked Devices
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </ZoruButton>
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}
