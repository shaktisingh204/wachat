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
 * Rewards module shell. Owns the single page-level header (one h1 for the
 * whole module) plus the section sub-nav, so every page under
 * `/dashboard/sabrewards/*` shares consistent chrome. Section pages render
 * their own toolbars (not headers) to keep one logical heading order.
 */
export default function RewardsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="20ui flex flex-col gap-5 p-4 md:p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Sales / loyalty</PageEyebrow>
          <PageTitle>Rewards</PageTitle>
          <PageDescription>
            Points, tiers, redemptions and referrals in one place. Programs
            reuse the loyalty tier engine; catalog images come from SabFiles.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>
      <RewardsNav />
      <div>{children}</div>
    </div>
  );
}
