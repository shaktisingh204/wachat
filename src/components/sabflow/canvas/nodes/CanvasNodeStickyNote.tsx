'use client';
/**
 * CanvasNodeStickyNote — port of n8n's CanvasNodeStickyNote.vue.
 *
 * A resizable sticky note rendered as its own React Flow node type. Features:
 *   • 6 color presets (matches SabFlow's AnnotationColor palette)
 *   • Click-to-edit — double-click (or Enter) enters edit mode; blur commits.
 *   • Corner resize handle — drag-to-resize, clamps to min 160×100.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import type { AnnotationColor } from '@/lib/sabflow/types';
import { LuPalette, LuTrash2 } from 'react-icons/lu';

const COLOR_PALETTE: Record<AnnotationColor, { bg: string; border: string }> = {
  yellow: { bg: '#fef3c7', border: '#fcd34d' },
  pink: { bg: '#fce7f3', border: '#f472b6' },
  blue: { bg: '#dbeafe', border: '#60a5fa' },
  green: { bg: '#dcfce7', border: '#4ade80' },
  purple: { bg: '#ede9fe', border: '#a78bfa' },
  orange: { bg: '#ffedd5', border: '#fb923c' },
};
const COLOR_KEYS = Object.keys(COLOR_PALETTE) as AnnotationColor[];

export type StickyNoteNodeData = {
  id: string;
  content: string;
  color?: AnnotationColor;
  width?: number;
  height?: number;
  isSticky: true;
};

type Props = NodeProps & {
  onUpdate?: (id: string, patch: Partial<StickyNoteNodeData & { width: number; height: number }>) => void;
  onDelete?: (id: string) => void;
  isReadOnly?: boolean;
};

export const CanvasNodeStickyNote = memo(function CanvasNodeStickyNote({
  id,
  data,
  selected,
  width,
  height,
  onUpdate,
  onDelete,
  isReadOnly,
}: Props) {
  const d = data as StickyNoteNodeData;
  const palette = COLOR_PALETTE[d.color ?? 'yellow'];
  const [editing, setEditing] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const onContentCommit = useCallback(
    (value: string) => {
      onUpdate?.(id, { content: value });
    },
    [id, onUpdate],
  );

  const w = width ?? d.width ?? 240;
  const h = height ?? d.height ?? 160;

  return (
    <div
      className="sabflow-sticky"
      data-testid="canvas-sticky-note"
      style={{
        width: w,
        height: h,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        boxShadow: selected
          ? `0 0 0 3px rgba(247, 104, 8, 0.25), 0 8px 20px -6px rgba(0,0,0,0.18)`
          : `0 4px 12px -4px rgba(0,0,0,0.12)`,
        position: 'relative',
        padding: 12,
        fontSize: 13,
        color: 'var(--gray-12)',
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isReadOnly) setEditing(true);
      }}
    >
      <NodeResizer
        isVisible={selected && !isReadOnly}
        minWidth={160}
        minHeight={100}
        /**
         * onResizeEnd (not onResize) — otherwise React Flow fires onResize
         * during mount with the measured DOM size, which round-trips through
         * flow state and triggers a re-render → onResize → ... (React #185).
         */
        onResizeEnd={(_e, params) => {
          onUpdate?.(id, { width: params.width, height: params.height });
        }}
        lineStyle={{ borderColor: palette.border }}
        handleStyle={{
          background: palette.border,
          border: '2px solid var(--gray-1)',
          width: 10,
          height: 10,
        }}
      />

      {editing ? (
        <textarea
          ref={textareaRef}
          defaultValue={d.content ?? ''}
          onBlur={(e) => {
            setEditing(false);
            onContentCommit(e.currentTarget.value);
          }}
          className="nodrag nopan"
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 0,
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
            lineHeight: 1.4,
          }}
        />
      ) : (
        <div
          style={{
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            height: '100%',
            lineHeight: 1.4,
            color: d.content ? 'var(--gray-12)' : 'var(--gray-9)',
          }}
        >
          {d.content || 'Double-click to edit'}
        </div>
      )}

      {selected && !isReadOnly && !editing ? (
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            top: -34,
            right: 0,
            display: 'flex',
            gap: 4,
            padding: 4,
            background: 'var(--gray-1)',
            border: '1px solid var(--gray-5)',
            borderRadius: 8,
            boxShadow: '0 4px 14px -4px rgba(0,0,0,0.18)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Change color"
            className="sabflow-node__toolbar-btn"
            onClick={() => setShowPalette((v) => !v)}
          >
            <LuPalette className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            className="sabflow-node__toolbar-btn is-danger"
            onClick={() => onDelete?.(id)}
          >
            <LuTrash2 className="h-3.5 w-3.5" />
          </button>
          {showPalette ? (
            <div
              style={{
                position: 'absolute',
                top: 34,
                right: 0,
                display: 'flex',
                gap: 4,
                padding: 6,
                background: 'var(--gray-1)',
                border: '1px solid var(--gray-5)',
                borderRadius: 8,
                boxShadow: '0 4px 14px -4px rgba(0,0,0,0.18)',
              }}
            >
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={`Use ${k}`}
                  onClick={() => {
                    onUpdate?.(id, { color: k });
                    setShowPalette(false);
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    border: `2px solid ${COLOR_PALETTE[k].border}`,
                    background: COLOR_PALETTE[k].bg,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
