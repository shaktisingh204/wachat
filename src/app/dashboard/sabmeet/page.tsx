import { listMeetRooms } from '@/app/actions/sabmeet.actions';
import { MeetingsListClient } from './_components/sabmeet-list-client';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage() {
  const [upcoming, past] = await Promise.all([
    listMeetRooms({ when: 'upcoming' }),
    listMeetRooms({ when: 'past' }),
  ]);

  return <MeetingsListClient upcoming={upcoming.data} past={past.data} />;
}
