import { Suspense } from 'react';
import { listMeetRooms } from '@/app/actions/meet.actions';
import { MeetingsListClient } from './_components/meetings-list-client';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage() {
  const [upcoming, past] = await Promise.all([
    listMeetRooms({ when: 'upcoming' }),
    listMeetRooms({ when: 'past' }),
  ]);

  return (
    <Suspense fallback={null}>
      <MeetingsListClient
        upcoming={upcoming.data}
        past={past.data}
      />
    </Suspense>
  );
}
