import { notFound } from 'next/navigation';
import { getMeetRoom, listMeetRecordings } from '@/app/actions/meet.actions';
import { RecordingsClient } from './recordings-client';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RecordingsPage({ params }: PageProps) {
  const { roomId } = await params;
  const { data: room } = await getMeetRoom(roomId);
  if (!room) notFound();
  const { data: recordings } = await listMeetRecordings(roomId);
  return <RecordingsClient room={room} initialRecordings={recordings} />;
}
