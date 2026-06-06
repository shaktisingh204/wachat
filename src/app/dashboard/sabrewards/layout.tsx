import * as React from 'react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

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
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>CRM / Sales</PageEyebrow>
          <PageTitle>Rewards</PageTitle>
          <PageDescription>
            Unified loyalty, referral and redemption surface. Programs reuse the
            existing tier engine; catalog images come from SabFiles.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>
      <RewardsNav />
      <div>{children}</div>
    </div>
  );
}
