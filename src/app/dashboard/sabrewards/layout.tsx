import * as React from 'react';

import { RewardsNav } from './_components/rewards-nav';

/**
 * Rewards module shell. Holds the section sub-nav so every page under
 * `/dashboard/sabrewards/*` shares a consistent header and the
 * deep-link surface stays predictable.
 */
export default function RewardsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="zoruui flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          CRM · Sales
        </p>
        <h1 className="text-2xl font-semibold text-zoru-ink">Rewards</h1>
        <p className="max-w-2xl text-sm text-zoru-ink-muted">
          Unified loyalty, referral and redemption surface. Programs reuse the
          existing tier engine; catalog images come from SabFiles.
        </p>
      </header>
      <RewardsNav />
      <div>{children}</div>
    </div>
  );
}
