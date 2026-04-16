'use client';

/**
 * FileUploadInput
 *
 * Reusable drag-drop / click-to-browse uploader used by block settings
 * (image, video, audio bubbles) to let editors upload an asset and drop
 * the returned URL into the block's options.
 *
 * Integrates with `/api/sabflow/upload`.
 */

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  LuUpload,
  LuImage,
  LuX,
  LuFileText,
  LuLoader,
  LuTriangleAlert,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type UploadResponse = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

type Props = {
  /** Current persisted URL (uploaded previously). Empty string if none. */
  value?: string;
  /** Called with the new URL once the upload completes. */
  onChange: (url: string) => void;
  /** `accept` attribute passed through to <input type="file">. */
  accept?: string;
  /** Optional flow association for metadata. */
  flowId?: string;
  /** Owning workspace id (authoring user). */
  workspaceId: string;
  /** Visual-only label above the drop zone. */
  label?: string;
  className?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageUrl(url: string, contentType?: string): boolean {
  if (contentType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(url);
}

export function FileUploadInput({
  value,
  onChange,
  accept,
  flowId,
  workspaceId,
  label,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<Pick<
    UploadResponse,
    'filename' | 'contentType' | 'sizeBytes'
  > | null>(null);

  const uploading = progress !== null;

  const uploadFile = useCallback(
    (file: File) => {
      setError(null);
      setProgress(0);

      const fd = new FormData();
      fd.append('file', file);
      if (flowId) fd.append('flowId', flowId);
      if (workspaceId) fd.append('workspaceId', workspaceId);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/sabflow/upload');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setProgress(null);
        let parsed: UploadResponse | { error?: string } | null = null;
        try {
          parsed = xhr.responseText
            ? (JSON.parse(xhr.responseText) as UploadResponse | { error?: string })
            : null;
        } catch {
          parsed = null;
        }

        if (xhr.status >= 200 && xhr.status < 300 && parsed && 'url' in parsed) {
          onChange(parsed.url);
          setLastMeta({
            filename: parsed.filename,
            contentType: parsed.contentType,
            sizeBytes: parsed.sizeBytes,
          });
        } else {
          const msg =
            (parsed && 'error' in parsed && parsed.error) ||
            `Upload failed (${xhr.status})`;
          setError(msg);
        }
      };

      xhr.onerror = () => {
        setProgress(null);
        setError('Network error — please try again.');
      };

      xhr.send(fd);
    },
    [flowId, workspaceId, onChange],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      uploadFile(files[0]);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Allow re-selecting the same file.
      e.target.value = '';
    },
    [handleFiles],
  );

  const handleRemove = useCallback(() => {
    setError(null);
    setLastMeta(null);
    onChange('');
  }, [onChange]);

  const hasValue = Boolean(value);
  const showImagePreview = hasValue && isImageUrl(value ?? '', lastMeta?.contentType);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      {hasValue && !uploading ? (
        /* ── Uploaded state ─────────────────────────── */
        <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-2.5 space-y-2">
          {showImagePreview ? (
            <div className="relative h-[120px] w-full overflow-hidden rounded-md bg-[var(--gray-3)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt={lastMeta?.filename ?? 'Uploaded file'}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-md bg-[var(--gray-3)] px-3 py-2.5 text-[12.5px] text-[var(--gray-11)]">
              <LuFileText className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="truncate">
                {lastMeta?.filename ?? (value ?? '').split('/').pop()}
              </span>
              {lastMeta && (
                <span className="shrink-0 text-[11px] text-[var(--gray-8)]">
                  {formatBytes(lastMeta.sizeBytes)}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] px-2.5 py-1 text-[12px] text-[var(--gray-11)] hover:border-[#f76808] hover:text-[#f76808] transition-colors"
            >
              <LuUpload className="h-3 w-3" strokeWidth={2} />
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] px-2.5 py-1 text-[12px] text-[var(--gray-11)] hover:border-red-500 hover:text-red-500 transition-colors"
            >
              <LuX className="h-3 w-3" strokeWidth={2} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* ── Empty / drop-zone state ────────────────── */
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
            isDragging
              ? 'border-[#f76808] bg-[#f76808]/5'
              : 'border-[var(--gray-5)] bg-[var(--gray-2)] hover:border-[#f76808]/60',
            uploading && 'pointer-events-none opacity-80',
          )}
        >
          {uploading ? (
            <>
              <LuLoader
                className="h-5 w-5 animate-spin text-[#f76808]"
                strokeWidth={1.8}
              />
              <div className="w-full max-w-[180px]">
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--gray-4)]">
                  <div
                    className="h-full bg-[#f76808] transition-[width] duration-200"
                    style={{ width: `${progress ?? 0}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--gray-9)]">
                  Uploading… {progress ?? 0}%
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f76808]/10">
                <LuImage className="h-4 w-4 text-[#f76808]" strokeWidth={1.8} />
              </div>
              <p className="text-[12.5px] font-medium text-[var(--gray-11)]">
                Drop a file or click to browse
              </p>
              <p className="text-[11px] text-[var(--gray-8)]">
                Max 10 MB
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-[11.5px] text-red-400">
          <LuTriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
