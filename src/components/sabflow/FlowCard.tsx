'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  LuPencil,
  LuTrash2,
  LuCopy,
  LuChartColumn,
  LuShare2,
  LuWorkflow,
  LuZap,
  LuCircle,
  LuDownload,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────────── */

export type FlowItem = {
  _id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  groups: { id: string }[];
  edges: { id: string }[];
  updatedAt: string;
  createdAt: string;
  /** Lower-case tags surfaced by the flow-list filter chips. */
  tags?: string[];
  /** Folder id the flow lives in — null/undefined means "root". */
  folderId?: string;
};

type Props = {
  flow: FlowItem;
  onDelete: (flow: FlowItem) => void;
  onDuplicate: (flowId: string) => void;
  onRename: (flowId: string, newName: string) => void;
  onExport?: (flowId: string) => void;
};

/* ── FlowCard ───────────────────────────────────────────────────────────── */

export function FlowCard({ flow, onDelete, onDuplicate, onRename, onExport }: Props) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [nameValue, setNameValue] = React.useState(flow.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isPublished = flow.status === 'PUBLISHED';

  const commitRename = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== flow.name) {
      onRename(flow._id, trimmed);
    } else {
      setNameValue(flow.name);
    }
    setIsRenaming(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleCardClick = () => {
    if (!isRenaming) {
      router.push(`/dashboard/sabflow/flow-builder/${flow._id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setNameValue(flow.name);
      setIsRenaming(false);
    }
  };

  const updatedLabel = flow.updatedAt
    ? format(new Date(flow.updatedAt), 'MMM d, yyyy')
    : '—';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open flow ${flow.name}`}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className={cn(
        'group relative flex flex-col rounded-xl border border-[var(--st-border)]',
        'bg-[var(--st-bg)] overflow-hidden cursor-pointer',
        'shadow-sm hover:shadow-md transition-all duration-200',
        'hover:border-[var(--st-border-strong)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]/30',
      )}
    >
      {/* ── Thumbnail ─────────────────────────────────────────────────── */}
      <div className="relative flex h-[130px] items-center justify-center overflow-hidden border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(hsl(var(--zoru-line))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--zoru-line))_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex w-44 items-center justify-between">
          {[0, 1, 2].map((node) => (
            <React.Fragment key={node}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] shadow-sm">
                <LuWorkflow className="h-5 w-5 text-[var(--st-text)]" strokeWidth={1.7} />
              </div>
              {node < 2 ? (
                <div className="h-px flex-1 bg-[var(--st-border-strong)]" />
              ) : null}
            </React.Fragment>
          ))}
        </div>

        {/* Status badge — top right corner */}
        <span
          className={cn(
            'absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm',
            isPublished
              ? 'bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)] border-[var(--st-status-ok)]/30'
              : 'bg-[var(--st-warn)]/15 text-[var(--st-warn)] border-[var(--st-warn)]/30',
          )}
        >
          <LuCircle
            className={cn('h-1.5 w-1.5 fill-current', isPublished ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]')}
          />
          {isPublished ? 'Published' : 'Draft'}
        </span>

        {/* Hover action overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-[var(--st-text)]/55 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            'flex items-center justify-center gap-2',
          )}
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <ActionIconBtn
            label="Edit"
            icon={<LuPencil className="h-4 w-4" />}
            onClick={() => router.push(`/dashboard/sabflow/flow-builder/${flow._id}`)}
          />
          <ActionIconBtn
            label="Results"
            icon={<LuChartColumn className="h-4 w-4" />}
            onClick={() => router.push(`/dashboard/sabflow/logs?flowId=${flow._id}`)}
          />
          <ActionIconBtn
            label="Share"
            icon={<LuShare2 className="h-4 w-4" />}
            onClick={() => {
              const url = `${window.location.origin}/flow/${flow._id}`;
              void navigator.clipboard.writeText(url);
            }}
          />
          <ActionIconBtn
            label="Export"
            icon={<LuDownload className="h-4 w-4" />}
            onClick={() => {
              if (onExport) {
                onExport(flow._id);
              } else {
                // Default: trigger browser download directly
                const a = document.createElement('a');
                a.href = `/api/sabflow/export/${flow._id}`;
                a.download = `flow-${flow._id}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            }}
          />
          <ActionIconBtn
            label="Duplicate"
            icon={<LuCopy className="h-4 w-4" />}
            onClick={() => onDuplicate(flow._id)}
          />
          <ActionIconBtn
            label="Delete"
            icon={<LuTrash2 className="h-4 w-4" />}
            onClick={() => onDelete(flow)}
            danger
          />
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-3 py-3">
        {/* Flow name — double-click to rename */}
        {isRenaming ? (
          <input
            ref={inputRef}
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-md border border-[var(--st-border-strong)] bg-[var(--st-bg)] px-2 py-0.5 text-[13px] font-semibold text-[var(--st-text)] outline-none ring-2 ring-[var(--st-text)]/20"
          />
        ) : (
          <p
            className="truncate text-[13px] font-semibold leading-snug text-[var(--st-text)]"
            title={flow.name}
            onDoubleClick={handleDoubleClick}
          >
            {flow.name}
          </p>
        )}

        <div className="flex items-center justify-between mt-0.5">
          <span className="flex items-center gap-1 text-[10.5px] text-[var(--st-text-secondary)]">
            <LuZap className="h-3 w-3" />
            {flow.groups?.length ?? 0} groups
          </span>
          <span className="text-[10.5px] text-[var(--st-text-secondary)]">{updatedLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* ── ActionIconBtn (internal helper) ─────────────────────────────────────── */

function ActionIconBtn({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full border shadow-sm',
        'backdrop-blur-sm transition-colors duration-150',
        danger
          ? 'border-[var(--st-danger)] bg-[var(--st-danger)] text-[var(--st-text-inverted)] hover:bg-[var(--st-danger)]/90'
          : 'border-white/70 bg-white text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]',
      )}
    >
      {icon}
    </button>
  );
}
