/**
 * Public Taskboard — `/share/taskboard/[hash]`.
 *
 * Read-only Kanban view of a project. Lookup keyed on
 * `crm_projects.publicHash` AND `public_taskboard === true` (or 1).
 */

import * as React from 'react';
import { notFound } from 'next/navigation';
import { getPublicTaskboard } from '@/app/actions/public-taskboard.actions';
import TaskboardClient from './TaskboardClient';

export const dynamic = 'force-dynamic';

type Params = Promise<{ hash: string }>;

async function PublicTaskboardContainer({ hash }: { hash: string }) {
  const data = await getPublicTaskboard(hash);
  if (!data) notFound();

  return <TaskboardClient data={data} />;
}

export default async function PublicTaskboardPage({
  params,
}: {
  params: Params;
}) {
  const { hash } = await params;
  
  return (
    <React.Suspense fallback={<div>Loading taskboard...</div>}>
      <PublicTaskboardContainer hash={hash} />
    </React.Suspense>
  );
}
