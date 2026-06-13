import React, { Suspense } from 'react';
import { NotificationsClient } from './notifications-client';
import {
  defaultNotificationConfig,
  getNotificationConfigAction,
} from './actions';

export const dynamic = 'force-dynamic';

async function NotificationsDataLoader() {
  const res = await getNotificationConfigAction();
  if (!res.success) {
    return (
      <p className="m-6 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
        {res.error}
      </p>
    );
  }
  return <NotificationsClient initialConfig={res.config} />;
}

export default function SabsmsNotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsDataLoader />
    </Suspense>
  );
}

// Re-exported for any caller that wants the shape without hitting the DB.
export { defaultNotificationConfig };
