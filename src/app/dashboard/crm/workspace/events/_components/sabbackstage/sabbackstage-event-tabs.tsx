'use client';

/**
 * SabBackstage tab strip mounted at the bottom of the event detail
 * page. Holds Ticketing / Sponsors / Public Page / Check-in tabs.
 *
 * Each tab is a client component that drives its own data via the
 * `sabbackstage.actions.ts` server actions.
 */

import * as React from 'react';
import {
  Card,
  Tabs,
  ZoruTabsList,
  ZoruTabsTrigger,
  ZoruTabsContent,
} from '@/components/zoruui';

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
      <h3 className="mb-3 text-[13.5px] font-semibold text-zoru-ink">
        SabBackstage — public ticketing
      </h3>
      <Tabs defaultValue="ticketing">
        <ZoruTabsList>
          <ZoruTabsTrigger value="ticketing">Ticketing</ZoruTabsTrigger>
          <ZoruTabsTrigger value="sponsors">Sponsors</ZoruTabsTrigger>
          <ZoruTabsTrigger value="public-page">Public page</ZoruTabsTrigger>
          <ZoruTabsTrigger value="checkin">Check-in</ZoruTabsTrigger>
        </ZoruTabsList>
        <ZoruTabsContent value="ticketing">
          <SabbackstageTicketingTab eventId={eventId} />
        </ZoruTabsContent>
        <ZoruTabsContent value="sponsors">
          <SabbackstageSponsorsTab eventId={eventId} />
        </ZoruTabsContent>
        <ZoruTabsContent value="public-page">
          <SabbackstagePublicPageTab eventId={eventId} eventName={eventName} />
        </ZoruTabsContent>
        <ZoruTabsContent value="checkin">
          <SabbackstageCheckInTab eventId={eventId} />
        </ZoruTabsContent>
      </Tabs>
    </Card>
  );
}
