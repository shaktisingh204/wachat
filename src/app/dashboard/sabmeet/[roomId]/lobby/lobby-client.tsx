'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
} from '@/components/sabcrm/20ui/compat';
import { Mic, MicOff, Video, VideoOff, Loader2 } from 'lucide-react';
import type { MeetRoom } from '@/app/actions/sabmeet.actions.types';
import { joinMeetRoom } from '@/app/actions/sabmeet.actions';

interface LobbyClientProps {
  room: MeetRoom;
}

export function LobbyClient({ room }: LobbyClientProps) {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [passcode, setPasscode] = React.useState('');
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [requesting, setRequesting] = React.useState(false);
  const [joining, setJoining] = React.useState(false);

  // Acquire device preview.
  React.useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      setRequesting(true);
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        stream.getVideoTracks().forEach(t => (t.enabled = camOn));
        stream.getAudioTracks().forEach(t => (t.enabled = micOn));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Camera / microphone permission denied.',
        );
      } finally {
        setRequesting(false);
      }
    };
    acquire();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    streamRef.current?.getVideoTracks().forEach(t => (t.enabled = camOn));
  }, [camOn]);
  React.useEffect(() => {
    streamRef.current?.getAudioTracks().forEach(t => (t.enabled = micOn));
  }, [micOn]);

  const handleJoin = async () => {
    setError(null);
    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (room.passcode && passcode !== room.passcode) {
      setError('Incorrect passcode.');
      return;
    }
    setJoining(true);
    try {
      const res = await joinMeetRoom({
        roomId: room._id,
        displayName: displayName.trim(),
      });
      if (res.success) {
        const qs = new URLSearchParams({
          participantId: res.data._id,
          displayName: displayName.trim(),
          mic: micOn ? '1' : '0',
          cam: camOn ? '1' : '0',
        });
        // Pass stream through window so room can pick it up. The hand-off
        // is intentionally non-React because MediaStream isn't serializable.
        (window as Window & { __MEET_LOCAL_STREAM__?: MediaStream | null }).__MEET_LOCAL_STREAM__ =
          streamRef.current;
        // Don't stop the stream here — the room reuses it.
        router.push(`/dashboard/meetings/${room._id}/room?${qs.toString()}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-zoru-bg p-6">
      <div className="mx-auto max-w-4xl grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Device check</CardTitle>
            <CardDescription>Preview your camera and microphone.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black grid place-items-center">
              {requesting ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : null}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${camOn ? '' : 'hidden'}`}
              />
              {!camOn && !requesting ? (
                <div className="text-white/60 text-sm">Camera off</div>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant={micOn ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMicOn(v => !v)}
                aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant={camOn ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCamOn(v => !v)}
                aria-label={camOn ? 'Stop camera' : 'Start camera'}
              >
                {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{room.name}</CardTitle>
            <CardDescription>
              {room.description ?? 'Join the meeting'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Your name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Chen"
                autoFocus
              />
            </div>
            {room.passcode ? (
              <div className="grid gap-2">
                <Label htmlFor="passcode">Passcode</Label>
                <Input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value)}
                />
              </div>
            ) : null}
            <div className="text-xs text-zoru-ink-muted">
              Join code: <code className="font-mono">{room.joinCode}</code>
              {room.lobbyEnabled ? (
                <span className="ml-2">• Host will admit you from the lobby</span>
              ) : null}
            </div>
            {error ? (
              <div className="rounded-md border border-zoru-line/40 bg-zoru-ink/5 text-sm text-zoru-ink px-3 py-2">
                {error}
              </div>
            ) : null}
            <Button onClick={handleJoin} disabled={joining || requesting} className="w-full">
              {joining ? 'Joining…' : 'Join meeting'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
