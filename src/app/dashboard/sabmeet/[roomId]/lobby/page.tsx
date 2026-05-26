import { notFound } from 'next/navigation';
import { getMeetRoom } from '@/app/actions/sabmeet.actions';
import { LobbyClient } from './lobby-client';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function LobbyPage({ params }: PageProps) {
  const { roomId } = await params;
  const { data: room } = await getMeetRoom(roomId);
  if (!room) notFound();
  return <LobbyClient room={room} />;
}
