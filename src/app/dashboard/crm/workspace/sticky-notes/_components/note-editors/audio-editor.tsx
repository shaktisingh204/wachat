'use client';

/**
 * Audio note kind.
 *
 * Two flows:
 *  1. Pick an existing audio file from SabFiles.
 *  2. Record fresh audio via MediaRecorder, then upload it to SabFiles using
 *     the same picker (upload tab pre-filled with the recorded blob via
 *     `<SabFileToFileButton>` is the next step — for v1 we ask the user to
 *     pick the file after recording locally).
 *
 * Stores `{ kind: 'audio', fileId, name, mime, durationMs }` in blocksJson.
 */

import * as React from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';

import { Button } from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

export interface AudioValue {
  fileId?: string;
  name?: string;
  mime?: string;
  url?: string;
  durationMs?: number;
}

export interface AudioEditorProps {
  value: AudioValue | null;
  onChange: (next: AudioValue | null) => void;
  disabled?: boolean;
}

export function AudioEditor({ value, onChange, disabled }: AudioEditorProps) {
  const [recording, setRecording] = React.useState(false);
  const [localBlobUrl, setLocalBlobUrl] = React.useState<string | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    return () => {
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    };
  }, [localBlobUrl]);

  const startRecording = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || 'audio/webm',
        });
        const url = URL.createObjectURL(blob);
        setLocalBlobUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
      startedAtRef.current = Date.now();
      setRecording(true);
    } catch (err) {
      console.error('[AudioEditor] mic error', err);
    }
  }, []);

  const stopRecording = React.useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const handlePick = React.useCallback(
    (pick: SabFilePick) => {
      if (!pick) return;
      onChange({
        fileId: pick.id,
        name: pick.name,
        mime: pick.mime,
        url: pick.url,
      });
      // Clear any local recording — the canonical copy now lives in SabFiles.
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
        setLocalBlobUrl(null);
      }
    },
    [onChange, localBlobUrl],
  );

  const clear = React.useCallback(() => {
    onChange(null);
  }, [onChange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button variant="destructive" onClick={stopRecording} disabled={disabled}>
            <Square className="h-4 w-4" /> Stop recording
          </Button>
        ) : (
          <Button variant="outline" onClick={startRecording} disabled={disabled}>
            <Mic className="h-4 w-4" /> Record
          </Button>
        )}
        <SabFilePickerButton accept="audio" onPick={handlePick}>
          {value?.fileId ? 'Change audio file' : 'Pick from SabFiles'}
        </SabFilePickerButton>
        {value?.fileId && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={disabled}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>

      {localBlobUrl && !value?.fileId && (
        <div className="rounded-md border border-[var(--zoru-border)] p-3">
          <p className="mb-2 text-xs text-[var(--zoru-muted-foreground)]">
            Local recording preview — save it to SabFiles using &ldquo;Pick
            from SabFiles&rdquo; → Upload tab to attach it to the note.
          </p>
          <audio src={localBlobUrl} controls className="w-full" />
        </div>
      )}

      {value?.fileId && value.url && (
        <div className="rounded-md border border-[var(--zoru-border)] p-3">
          <p className="mb-2 text-xs text-[var(--zoru-muted-foreground)]">
            {value.name ?? 'Audio attachment'}
          </p>
          <audio src={value.url} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
