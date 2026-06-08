'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Field,
  Badge,
  Alert,
  Separator,
} from '@/components/sabcrm/20ui';
import { Mic, MicOff, Video, VideoOff, Loader2, ShieldCheck } from 'lucide-react';
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
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
        stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Camera and microphone access was denied.',
        );
      } finally {
        setRequesting(false);
      }
    };
    acquire();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);
  React.useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);

  const handleJoin = async () => {
    setError(null);
    if (!displayName.trim()) {
      setError('Enter your name before joining.');
      return;
    }
    if (room.passcode && passcode !== room.passcode) {
      setError('That passcode is incorrect.');
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
        (
          window as Window & { __MEET_LOCAL_STREAM__?: MediaStream | null }
        ).__MEET_LOCAL_STREAM__ = streamRef.current;
        // Don't stop the stream here — the room reuses it.
        router.push(`/dashboard/meetings/${room._id}/room?${qs.toString()}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the meeting.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-[var(--st-bg)] p-6">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Device check</CardTitle>
            <CardDescription>Preview your camera and microphone before joining.</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-[var(--st-radius)] bg-black">
              {requesting ? (
                <Loader2
                  className="h-6 w-6 animate-spin text-white/80"
                  aria-label="Requesting camera access"
                />
              ) : null}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${camOn ? '' : 'hidden'}`}
              />
              {!camOn && !requesting ? (
                <div className="flex flex-col items-center gap-2 text-sm text-white/60">
                  <VideoOff className="h-6 w-6" aria-hidden="true" />
                  Camera off
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <IconButton
                icon={micOn ? Mic : MicOff}
                variant={micOn ? 'secondary' : 'danger'}
                onClick={() => setMicOn((v) => !v)}
                label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              />
              <IconButton
                icon={camOn ? Video : VideoOff}
                variant={camOn ? 'secondary' : 'danger'}
                onClick={() => setCamOn((v) => !v)}
                label={camOn ? 'Stop camera' : 'Start camera'}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{room.name}</CardTitle>
            <CardDescription>
              {room.description ?? 'Set your name, then join the meeting.'}
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Your name" required>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Priya Nair"
                autoFocus
              />
            </Field>
            {room.passcode ? (
              <Field label="Passcode" required>
                <Input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter meeting passcode"
                />
              </Field>
            ) : null}

            <Separator />

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
              <span>
                Join code{' '}
                <code className="rounded bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-mono text-[var(--st-text)]">
                  {room.joinCode}
                </code>
              </span>
              {room.lobbyEnabled ? (
                <Badge tone="info" kind="soft">
                  <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                  Host admits from lobby
                </Badge>
              ) : null}
            </div>

            {error ? (
              <Alert tone="danger" title="Cannot join yet">
                {error}
              </Alert>
            ) : null}

            <Button
              variant="primary"
              onClick={handleJoin}
              loading={joining}
              disabled={joining || requesting}
              block
            >
              {joining ? 'Joining' : 'Join meeting'}
            </Button>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
