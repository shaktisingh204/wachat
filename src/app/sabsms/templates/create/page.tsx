export const dynamic = 'force-dynamic';

import React, { Suspense } from 'react';
import CreateSMSTemplateClient from './client';

export default function CreateTemplatePage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-zoru-surface-2 animate-pulse" />}>
      <CreateSMSTemplateClient />
    </Suspense>
  );
}
