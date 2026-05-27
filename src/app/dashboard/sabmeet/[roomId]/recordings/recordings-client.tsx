'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  EmptyState,
  PageHeader,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { ArrowLeft, Video as VideoIcon, FileText } from 'lucide-react';
import type { MeetRoom, MeetRecording } from '@/app/actions/sabmeet.actions.types';
import { completeMeetRecording, startMeetRecording } from '@/app/actions/sabmeet.actions';

interface RecordingsClientProps {
  room: MeetRoom;
  initialRecordings: MeetRecording[];
}

export function RecordingsClient({ room, initialRecordings }: RecordingsClientProps) {
  const [recordings, setRecordings] = React.useState<MeetRecording[]>(initialRecordings);
  const [busy, setBusy] = React.useState(false);

  const handleAttachFile = async (pick: SabFilePick) => {
    setBusy(true);
    try {
      // Stub flow: create a "recording" row that's already complete, sourcing
      // from a SabFiles pick. Real flow: SFU's egress finishes → calls
      // completeMeetRecording. Either way SabFiles owns the bytes.
      const start = await startMeetRecording(room._id);
      if (start.success) {
        await completeMeetRecording({
          recordingId: start.data._id,
          fileId: pick.id,
        });
        setRecordings(prev => [
          {
            ...start.data,
            fileId: pick.id,
            status: 'ready',
            endedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <div>
          <ZoruPageTitle>Recordings</ZoruPageTitle>
          <ZoruPageDescription>{room.name}</ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Link>
          </Button>
          <SabFilePickerButton
            accept="video"
            onPick={handleAttachFile}
            variant="default"
          >
            {busy ? 'Attaching…' : 'Attach recording from SabFiles'}
          </SabFilePickerButton>
        </ZoruPageActions>
      </PageHeader>

      {recordings.length === 0 ? (
        <EmptyState
          icon={<VideoIcon className="h-6 w-6" />}
          title="No recordings yet"
          description="Recordings made during a meeting will appear here. You can also attach an existing SabFile."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {recordings.map(rec => (
            <RecordingCard key={rec._id} recording={rec} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecordingCard({ recording }: { recording: MeetRecording }) {
  const start = new Date(recording.startedAt);
  const variant =
    recording.status === 'ready'
      ? 'default'
      : recording.status === 'failed'
        ? 'destructive'
        : 'secondary';

  // SabFiles owns the playback URL. We never paste a user-provided URL here.
  // Resolve via the public share endpoint when present, else show metadata only.
  const playbackUrl = recording.fileId ? `/api/sabfiles/${recording.fileId}/stream` : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{start.toLocaleString()}</CardTitle>
          <Badge variant={variant as never}>{recording.status}</Badge>
        </div>
        <CardDescription>
          {recording.durationSecs
            ? `${Math.floor(recording.durationSecs / 60)}m ${recording.durationSecs % 60}s`
            : '—'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {playbackUrl ? (
          <video
            src={playbackUrl}
            controls
            preload="metadata"
            className="w-full rounded bg-black"
          />
        ) : (
          <div className="rounded border border-dashed border-zoru-line p-6 text-center text-sm text-zoru-ink-muted">
            Media not yet ready.
          </div>
        )}
        {recording.transcriptFileId ? (
          <div className="text-xs text-zoru-ink-muted flex items-center gap-1">
            <FileText className="h-3 w-3" /> Transcript available
          </div>
        ) : null}
        {recording.errorMessage ? (
          <div className="text-xs text-red-600">{recording.errorMessage}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
