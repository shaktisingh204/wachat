'use client';

/**
 * "Drag and drop files, or Browse" upload affordance. A click or keyboard
 * activation opens the file dialog; files dropped on it are forwarded to
 * `onFiles`. Used in the SabFiles empty state and inside the picker's Upload
 * mode so the upload look is identical everywhere.
 */
import * as React from 'react';
import { UploadCloud } from 'lucide-react';

export interface SabUploadDropzoneProps {
    onFiles: (files: File[]) => void;
    accept?: string;
    /** Tighter padding for in-panel use (e.g. inside the picker). */
    compact?: boolean;
    /** Helper line under the title. */
    hint?: React.ReactNode;
    className?: string;
}

export function SabUploadDropzone({
    onFiles,
    accept,
    compact,
    hint,
    className,
}: SabUploadDropzoneProps): React.JSX.Element {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = React.useState(false);

    const pick = React.useCallback(() => inputRef.current?.click(), []);

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label="Choose or drop files to upload"
            onClick={pick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick();
                }
            }}
            onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    setDragging(true);
                }
            }}
            onDragLeave={(e) => {
                if (e.currentTarget === e.target) setDragging(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files?.length) onFiles(Array.from(e.dataTransfer.files));
            }}
            className={[
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--st-radius-lg)] border-2 border-dashed text-center transition-colors',
                compact ? 'min-h-[160px] p-5' : 'min-h-[180px] p-6',
                dragging
                    ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
                    : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 hover:border-[var(--st-text)]/40 hover:bg-[var(--st-bg-secondary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent-ring)]',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg)] text-[var(--st-text-secondary)] shadow-[var(--st-shadow-sm)]">
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-[var(--st-text)]">
                Drag and drop files, or{' '}
                <span className="text-[var(--st-accent)] underline">Browse</span>
            </span>
            {hint ? (
                <span className="text-xs text-[var(--st-text-secondary)]">{hint}</span>
            ) : null}
            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                accept={accept}
                onChange={(e) => {
                    if (e.target.files?.length) onFiles(Array.from(e.target.files));
                    if (inputRef.current) inputRef.current.value = '';
                }}
            />
        </div>
    );
}
