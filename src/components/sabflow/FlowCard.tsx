'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Pencil,
  Trash2,
  Copy,
  ChartColumn,
  Share2,
  Workflow,
  Zap,
  Download,
} from 'lucide-react';
import { Badge, IconButton, Input, cn } from '@/components/sabcrm/20ui';

/* -- Types --------------------------------------------------------------- */

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
  /** Folder id the flow lives in. null/undefined means "root". */
  folderId?: string;
};

type Props = {
  flow: FlowItem;
  onDelete: (flow: FlowItem) => void;
  onDuplicate: (flowId: string) => void;
  onRename: (flowId: string, newName: string) => void;
  onExport?: (flowId: string) => void;
};

/* -- FlowCard ------------------------------------------------------------- */

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
    : '-';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open flow ${flow.name}`}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className={cn(
        'group relative flex flex-col rounded-[var(--st-radius)] border border-[var(--st-border)]',
        'bg-[var(--st-bg)] overflow-hidden cursor-pointer',
        'shadow-sm hover:shadow-md transition-all duration-200',
        'hover:border-[var(--st-border-strong)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]/40',
      )}
    >
      {/* -- Thumbnail ------------------------------------------------------ */}
      <div className="relative flex h-[130px] items-center justify-center overflow-hidden border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--st-border)_1px,transparent_1px),linear-gradient(90deg,var(--st-border)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex w-44 items-center justify-between">
          {[0, 1, 2].map((node) => (
            <React.Fragment key={node}>
              <div className="flex h-11 w-11 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-sm">
                <Workflow className="h-5 w-5 text-[var(--st-text)]" strokeWidth={1.7} aria-hidden="true" />
              </div>
              {node < 2 ? (
                <div className="h-px flex-1 bg-[var(--st-border-strong)]" />
              ) : null}
            </React.Fragment>
          ))}
        </div>

        {/* Status badge, top-right corner */}
        <div className="absolute top-2.5 right-2.5">
          <Badge tone={isPublished ? 'success' : 'warning'} dot>
            {isPublished ? 'Published' : 'Draft'}
          </Badge>
        </div>

        {/* Hover action overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-[var(--st-text)]/55 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            'flex items-center justify-center gap-2',
          )}
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <IconButton
            label="Edit"
            icon={Pencil}
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/sabflow/flow-builder/${flow._id}`);
            }}
          />
          <IconButton
            label="Results"
            icon={ChartColumn}
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/sabflow/logs?flowId=${flow._id}`);
            }}
          />
          <IconButton
            label="Share"
            icon={Share2}
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              const url = `${window.location.origin}/flow/${flow._id}`;
              void navigator.clipboard.writeText(url);
            }}
          />
          <IconButton
            label="Export"
            icon={Download}
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
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
          <IconButton
            label="Duplicate"
            icon={Copy}
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(flow._id);
            }}
          />
          <IconButton
            label="Delete"
            icon={Trash2}
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(flow);
            }}
          />
        </div>
      </div>

      {/* -- Card body ----------------------------------------------------- */}
      <div className="flex flex-col gap-1 px-3 py-3">
        {/* Flow name, double-click to rename */}
        {isRenaming ? (
          <Input
            ref={inputRef}
            inputSize="sm"
            autoFocus
            aria-label="Flow name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
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
            <Zap className="h-3 w-3" aria-hidden="true" />
            {flow.groups?.length ?? 0} groups
          </span>
          <span className="text-[10.5px] text-[var(--st-text-secondary)]">{updatedLabel}</span>
        </div>
      </div>
    </div>
  );
}
