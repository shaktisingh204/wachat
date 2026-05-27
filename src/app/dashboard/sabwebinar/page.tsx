import { Suspense } from 'react';
import { listSabwebinars } from '@/app/actions/sabwebinar.actions';
import { SabwebinarListClient } from './_components/sabwebinar-list-client';

export const dynamic = 'force-dynamic';

export default async function SabwebinarIndexPage() {
  const all = await listSabwebinars();
  return (
    <Suspense fallback={null}>
      <SabwebinarListClient items={all.data} />
    </Suspense>
  );
}
