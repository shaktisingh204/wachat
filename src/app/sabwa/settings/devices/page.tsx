import { Smartphone } from 'lucide-react';
import * as React from 'react';

import { SettingsTabs } from '../_components/settings-tabs';
import { DeviceSettingsClient } from './_client';

export const metadata = { title: 'Settings — Devices — SabWa' };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 p-3">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-zoru-ink">
            Settings — Devices
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            Inspect every linked device for this number and unlink anything that looks off.
          </p>
        </div>
      </div>
      <SettingsTabs />
      <DeviceSettingsClient />
    </div>
  );
}
