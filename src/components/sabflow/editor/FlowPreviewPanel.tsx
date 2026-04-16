'use client';

import { useState, useCallback, useRef } from 'react';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { SabFlowChat } from '@/components/sabflow/chat/SabFlowChat';
import { cn } from '@/lib/utils';
import {
  LuX,
  LuPlay,
  LuRotateCcw,
  LuTriangle,
  LuSmartphone,
  LuMonitor,
} from 'react-icons/lu';

/* ── Types ──────────────────────────────────────────────── */

interface Props {
  flow: Pick<SabFlowDoc, 'status' | 'theme'> & { _id: string };
  onClose: () => void;
}

type ViewMode = 'mobile' | 'desktop';

/* ── FlowPreviewPanel ───────────────────────────────────── */

export function FlowPreviewPanel({ flow, onClose }: Props) {
  const [key, setKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('mobile');
  const isPublished = flow.status === 'PUBLISHED';

  const restart = useCallback(() => setKey((k) => k + 1), []);

  return (
    <div className="w-[380px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 shrink-0">
          <LuPlay className="h-3.5 w-3.5 translate-x-px" strokeWidth={2} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">Preview</span>

        {/* View mode toggles */}
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--gray-5)] p-0.5 bg-[var(--gray-2)]">
          {([
            { id: 'mobile' as ViewMode,  Icon: LuSmartphone },
            { id: 'desktop' as ViewMode, Icon: LuMonitor    },
          ]).map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              title={id}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                viewMode === id
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          ))}
        </div>

        {/* Restart */}
        <button
          onClick={restart}
          title="Restart preview"
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* ── Preview area ────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex items-start justify-center overflow-hidden bg-[var(--gray-3)] p-4">
        {isPublished ? (
          <div
            className={cn(
              'relative flex flex-col overflow-hidden rounded-2xl shadow-lg bg-white transition-all duration-200',
              viewMode === 'mobile'
                ? 'w-full max-w-[340px] h-[540px]'
                : 'w-full h-full',
            )}
          >
            {/* Phone chrome for mobile */}
            {viewMode === 'mobile' && (
              <div className="flex items-center justify-center h-6 bg-[var(--gray-2)] border-b border-[var(--gray-5)] shrink-0">
                <div className="h-1.5 w-12 rounded-full bg-[var(--gray-6)]" />
              </div>
            )}

            <SabFlowChat
              key={key}
              flowId={flow._id}
              theme={flow.theme}
              height="100%"
            />
          </div>
        ) : (
          /* ── Unpublished state ────────────────────────── */
          <div className="flex flex-col items-center justify-center gap-4 text-center px-6 py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <LuTriangle className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div className="space-y-1">
              <p className="text-[13.5px] font-semibold text-[var(--gray-12)]">
                Flow not published
              </p>
              <p className="text-[12px] text-[var(--gray-9)] leading-relaxed max-w-[220px]">
                Publish the flow from the header to enable the live preview.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Status footer ───────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-t border-[var(--gray-4)] bg-[var(--gray-2)]">
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            isPublished ? 'bg-green-500' : 'bg-amber-400',
          )}
        />
        <span className="text-[11.5px] text-[var(--gray-9)]">
          {isPublished
            ? 'Live — testing against the published version'
            : 'Publish to enable interactive preview'}
        </span>
      </div>
    </div>
  );
}
