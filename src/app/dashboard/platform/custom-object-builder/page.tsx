export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { getCustomObjects } from '@/app/actions/platform/custom-object-builder.actions';
import { CustomObjectClient } from './client';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default async function CustomObjectBuilderPage() {
  return (
    <Suspense fallback={
      <EntityListShell
        title="Custom Objects"
        subtitle="Define robust custom data models tailored to your business."
        loading={true}
      >
        <div />
      </EntityListShell>
    }>
      <CustomObjectBuilderData />
    </Suspense>
  );
}

async function CustomObjectBuilderData() {
  const data = await getCustomObjects();
  return <CustomObjectClient initialData={data} />;
}
