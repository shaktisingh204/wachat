'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  type BadgeTone,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  Separator,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import {
  ArrowLeft,
  Video as VideoIcon,
  FileText,
  Play,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import type { MeetRoom, MeetRecording } from '@/app/actions/sabmeet.actions.types';
import {
  completeMeetRecording,
  startMeetRecording,
} from '@/app/actions/sabmeet.actions';

interface RecordingsClientProps {
  room: MeetRoom;
  initialRecordings: MeetRecording[];
}

const STATUS_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  ready: { tone: 'success', label: 'Ready' },
  recording: { tone: 'warning', label: 'Recording' },
  processing: { tone: 'info', label: 'Processing' },
  failed: { tone: 'danger', label: 'Failed' },
};

function formatDuration(secs?: number): string {
  if (!secs) return '—';
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export function RecordingsClient({ room, initialRecordings }: RecordingsClientProps) {
  const [recordings, setRecordings] =
    React.useState<MeetRecording[]>(initialRecordings);
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
        setRecordings((prev) => [
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

  const readyCount = recordings.filter((r) => r.status === 'ready').length;
  const totalSecs = recordings.reduce((sum, r) => sum + (r.durationSecs ?? 0), 0);

  return (
    <main className="space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabMeet · Recordings</PageEyebrow>
          <PageTitle>{room.name}</PageTitle>
          <PageDescription>
            Play, download, and manage recordings captured in this room.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back to meetings
            </Link>
          </Button>
          <SabFilePickerButton accept="video" onPick={handleAttachFile} variant="default">
            {busy ? 'Attaching…' : 'Attach recording from SabFiles'}
          </SabFilePickerButton>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Recording overview"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Recordings"
          value={recordings.length}
          icon={VideoIcon}
          accent="#6366f1"
        />
        <StatCard
          label="Ready to play"
          value={readyCount}
          icon={CheckCircle2}
          accent="#16a34a"
        />
        <StatCard
          label="Total runtime"
          value={formatDuration(totalSecs)}
          icon={Clock}
          accent="#0ea5e9"
        />
      </section>

      <Card padding="none">
        <CardHeader className="flex items-center gap-2">
          <VideoIcon
            className="h-4 w-4 text-[var(--st-text-tertiary)]"
            aria-hidden="true"
          />
          <div>
            <CardTitle>All recordings</CardTitle>
            <CardDescription>
              SabFiles owns playback — links resolve through the secure stream
              endpoint.
            </CardDescription>
          </div>
        </CardHeader>
        <Separator />
        <CardBody>
          {recordings.length === 0 ? (
            <EmptyState
              icon={VideoIcon}
              title="No recordings yet"
              description="Recordings made during a meeting appear here. You can also attach an existing SabFile."
              action={
                <SabFilePickerButton
                  accept="video"
                  onPick={handleAttachFile}
                  variant="default"
                >
                  Attach from SabFiles
                </SabFilePickerButton>
              }
            />
          ) : (
            <TooltipProvider>
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Started</Th>
                    <Th>Duration</Th>
                    <Th>Status</Th>
                    <Th>Transcript</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {recordings.map((rec) => (
                    <RecordingRow key={rec._id} recording={rec} />
                  ))}
                </TBody>
              </Table>
            </TooltipProvider>
          )}
        </CardBody>
      </Card>
    </main>
  );
}

function RecordingRow({ recording }: { recording: MeetRecording }) {
  const start = new Date(recording.startedAt);
  const badge = STATUS_BADGE[recording.status] ?? {
    tone: 'neutral' as BadgeTone,
    label: recording.status,
  };
  // SabFiles owns the playback URL. We never paste a user-provided URL here.
  const playbackUrl = recording.fileId
    ? `/api/sabfiles/${recording.fileId}/stream`
    : null;

  return (
    <Tr>
      <Td>
        <div className="flex items-center gap-2">
          <Play
            className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)]"
            aria-hidden="true"
          />
          <span className="font-medium tabular-nums text-[var(--st-text)]">
            {start.toLocaleString()}
          </span>
        </div>
      </Td>
      <Td>
        <span className="tabular-nums text-[var(--st-text-secondary)]">
          {formatDuration(recording.durationSecs)}
        </span>
      </Td>
      <Td>
        <Badge tone={badge.tone} kind="soft" dot={recording.status === 'recording'}>
          {badge.label}
        </Badge>
        {recording.errorMessage ? (
          <span className="ml-2 text-xs text-[var(--st-danger)]">
            {recording.errorMessage}
          </span>
        ) : null}
      </Td>
      <Td>
        {recording.transcriptFileId ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Available
          </span>
        ) : (
          <span className="text-xs text-[var(--st-text-tertiary)]">—</span>
        )}
      </Td>
      <Td align="right">
        {playbackUrl ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="sm">
                <a href={playbackUrl} target="_blank" rel="noopener noreferrer">
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Play recording</span>
                  <span aria-hidden="true">Play</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in a new tab</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-[var(--st-text-tertiary)]">
            Media not ready
          </span>
        )}
      </Td>
    </Tr>
  );
}
