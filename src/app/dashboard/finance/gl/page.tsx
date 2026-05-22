import React from 'react';
import { listGlEntrys } from '@/app/actions/finance/gl.actions';
import { GlEntryListClient } from './_components/gl-list-client';

export default async function GlEntryPage() {
  const { items, error } = await listGlEntrys();

  return <GlEntryListClient initialItems={items || []} error={error} />;
}
