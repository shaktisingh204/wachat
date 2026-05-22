import { requirePermission } from '@/lib/rbac-server';
import { getCachedSession } from '@/lib/server-cache';
import { NotificationsClient } from './notifications-client';

export const dynamic = 'force-dynamic';

export default async function SabsmsNotificationsPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? '');
  
  // Require permission (as per catalog B.8.55)
  await requirePermission('sabsms_notifications', 'view', workspaceId);

  // Mock initial config for Phase 1
  const initialConfig = {
    quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
    digestMode: 'immediate',
    muteAll: false,
    criticalOnly: false,
    aiDailySummary: false,
    channels: [
      { id: 'in-app', name: 'In-App', type: 'in-app', enabled: true },
      { id: 'email', name: 'Email', type: 'email', enabled: true },
      { id: 'slack', name: 'Slack', type: 'slack', enabled: false },
      { id: 'sabflow', name: 'SabFlow', type: 'sabflow', enabled: true },
      { id: 'webhook', name: 'Webhook', type: 'webhook', enabled: false, secret: 'whsec_12345' },
      { id: 'push', name: 'Mobile Push', type: 'push', enabled: false }
    ],
    events: [
      { id: 'campaign.started', name: 'Campaign Started', channels: ['in-app'], allowList: [], blockList: [] },
      { id: 'campaign.completed', name: 'Campaign Completed', channels: ['in-app', 'email'], allowList: [], blockList: [] },
      { id: 'delivery.failed', name: 'Delivery Failed', channels: ['in-app', 'slack'], threshold: 'spike', allowList: [], blockList: [] },
      { id: 'billing.limit_reached', name: 'Billing Limit Reached', channels: ['in-app', 'email', 'slack'], critical: true, allowList: [], blockList: [] },
    ],
    recipientOverrides: [
      { userId: 'user_1', eventId: 'delivery.failed', mute: true }
    ]
  };

  return <NotificationsClient initialConfig={initialConfig} />;
}
