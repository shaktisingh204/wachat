import { notFound } from 'next/navigation';
import { getMeetRoom } from '@/app/actions/sabmeet.actions';
import { RoomClient } from './room-client';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  const { roomId } = await params;
  const { data: room } = await getMeetRoom(roomId);
  if (!room) notFound();
  return <RoomClient room={room} />;
}
