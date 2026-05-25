import { Suspense } from 'react';
import { MilestonesListServer } from './_components/milestones-list-server';
import MilestonesLoading from './loading';

export const dynamic = 'force-dynamic';

export default function ProjectMilestonesPage() {
  return (
    <Suspense fallback={<MilestonesLoading />}>
      <MilestonesListServer />
    </Suspense>
  );
}
