import React, { Suspense } from 'react';
import { requirePermission } from '@/lib/rbac-server';
import { getCachedSession } from '@/lib/server-cache';
import { NotificationsClient } from './notifications-client';

export const dynamic = 'force-dynamic';

async function NotificationsDataLoader() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? '');
  
  // Require permission (as per catalog B.8.55)
  await requirePermission('sabsms_notifications', 'view', workspaceId);

  // Mock initial config for Phase 1
  const initialConfig = {
    quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
    digestMode: 'immediate',
    debouncing: { enabled: false, windowMinutes: 60 },
    muteAll: false,
    criticalOnly: false,
    aiDailySummary: false,
    channels: [
      { id: 'in-app', name: 'In-App', type: 'in-app', enabled: true },
      { id: 'email', name: 'Email', type: 'email', enabled: true },
      { id: 'slack', name: 'Slack', type: 'slack', enabled: false, webhookUrl: '' },
      { id: 'discord', name: 'Discord', type: 'discord', enabled: false, webhookUrl: '' },
      { id: 'sabflow', name: 'SabFlow', type: 'sabflow', enabled: true },
      { id: 'webhook', name: 'Webhook', type: 'webhook', enabled: false, secret: 'whsec_12345' },
      { id: 'push', name: 'Mobile Push', type: 'push', enabled: false }
    ],
    events: [
      { id: 'campaign.started', name: 'Campaign Started', channels: ['in-app'], allowList: [], blockList: [], debounceMinutes: 0 },
      { id: 'campaign.completed', name: 'Campaign Completed', channels: ['in-app', 'email'], allowList: [], blockList: [], debounceMinutes: 0 },
      { id: 'delivery.failed', name: 'Delivery Failed', channels: ['in-app', 'slack'], threshold: 'spike', allowList: [], blockList: [], debounceMinutes: 60 },
      { id: 'billing.limit_reached', name: 'Billing Limit Reached', channels: ['in-app', 'email', 'slack'], critical: true, allowList: [], blockList: [], debounceMinutes: 0 },
    ],
    recipientOverrides: [
      { userId: 'user_1', eventId: 'delivery.failed', mute: true }
    ]
  };

  return <NotificationsClient initialConfig={initialConfig} />;
}

export default function SabsmsNotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsDataLoader />
    </Suspense>
  );
}
