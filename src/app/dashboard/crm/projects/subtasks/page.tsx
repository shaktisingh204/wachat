import { Suspense } from 'react';
import { SubtasksListServer } from './_components/subtasks-list-server';
import SubtasksLoading from './loading';

export const dynamic = 'force-dynamic';

export default function SubTasksPage() {
  return (
    <Suspense fallback={<SubtasksLoading />}>
      <SubtasksListServer />
    </Suspense>
  );
}
