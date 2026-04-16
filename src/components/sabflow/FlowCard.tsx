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
        'group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800',
        'bg-white dark:bg-zinc-900 overflow-hidden cursor-pointer',
        'shadow-sm hover:shadow-md transition-all duration-200',
        'hover:border-amber-300 dark:hover:border-amber-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
      )}
    >
      {/* ── Thumbnail ─────────────────────────────────────────────────── */}
      <div className="relative h-[130px] bg-gradient-to-br from-amber-400 via-orange-400 to-amber-600 flex items-center justify-center overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10" />
        <div className="absolute top-6 left-6 h-10 w-10 rounded-full bg-white/10" />
        {/* Flow icon */}
        <LuWorkflow className="h-12 w-12 text-white/90" strokeWidth={1.5} />

        {/* Status badge — top right corner */}
        <span
          className={cn(
            'absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm',
            isPublished
              ? 'bg-green-50/90 text-green-700 border-green-200'
              : 'bg-amber-50/90 text-amber-700 border-amber-200',
          )}
        >
          <LuCircle
            className={cn('h-1.5 w-1.5 fill-current', isPublished ? 'text-green-500' : 'text-amber-500')}
          />
          {isPublished ? 'Published' : 'Draft'}
        </span>

        {/* Hover action overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
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
            className="w-full rounded-md border border-amber-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 outline-none ring-2 ring-amber-500/30"
          />
        ) : (
          <p
            className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug"
            title={flow.name}
            onDoubleClick={handleDoubleClick}
          >
            {flow.name}
          </p>
        )}

        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10.5px] text-zinc-400 flex items-center gap-1">
            <LuZap className="h-3 w-3" />
            {flow.groups?.length ?? 0} groups
          </span>
          <span className="text-[10.5px] text-zinc-400">{updatedLabel}</span>
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
        'flex h-8 w-8 items-center justify-center rounded-full text-white',
        'backdrop-blur-sm transition-colors duration-150',
        danger
          ? 'bg-red-500/80 hover:bg-red-500'
          : 'bg-white/20 hover:bg-white/40',
      )}
    >
      {icon}
    </button>
  );
}
