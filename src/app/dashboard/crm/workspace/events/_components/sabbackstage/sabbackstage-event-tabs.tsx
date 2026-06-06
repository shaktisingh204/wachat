'use client';

/**
 * SabBackstage tab strip mounted at the bottom of the event detail
 * page. Holds Ticketing / Sponsors / Public Page / Check-in tabs.
 *
 * Each tab is a client component that drives its own data via the
 * `sabbackstage.actions.ts` server actions.
 */

import * as React from 'react';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/sabcrm/20ui';

import { SabbackstageTicketingTab } from './sabbackstage-ticketing-tab';
import { SabbackstageSponsorsTab } from './sabbackstage-sponsors-tab';
import { SabbackstagePublicPageTab } from './sabbackstage-public-page-tab';
import { SabbackstageCheckInTab } from './sabbackstage-checkin-tab';

export interface SabbackstageEventTabsProps {
  eventId: string;
  eventName: string;
}

export function SabbackstageEventTabs({
  eventId,
  eventName,
}: SabbackstageEventTabsProps): React.JSX.Element {
  return (
    <Card>
      <h3 className="mb-3 text-[13.5px] font-semibold text-[var(--st-text)]">
        SabBackstage — public ticketing
      </h3>
      <Tabs defaultValue="ticketing">
        <TabsList>
          <TabsTrigger value="ticketing">Ticketing</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
          <TabsTrigger value="public-page">Public page</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
        </TabsList>
        <TabsContent value="ticketing">
          <SabbackstageTicketingTab eventId={eventId} />
        </TabsContent>
        <TabsContent value="sponsors">
          <SabbackstageSponsorsTab eventId={eventId} />
        </TabsContent>
        <TabsContent value="public-page">
          <SabbackstagePublicPageTab eventId={eventId} eventName={eventName} />
        </TabsContent>
        <TabsContent value="checkin">
          <SabbackstageCheckInTab eventId={eventId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
