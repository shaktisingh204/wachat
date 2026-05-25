export const dynamic = 'force-dynamic';

import React, { Suspense } from 'react';
import WebhookLogClient from './client';

export default function WebhookLogPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-slate-50 animate-pulse" />}>
      <WebhookLogClient />
    </Suspense>
  );
}
