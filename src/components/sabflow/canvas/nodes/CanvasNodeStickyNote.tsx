'use client';
/**
 * CanvasNodeStickyNote - port of n8n's CanvasNodeStickyNote.vue.
 *
 * A resizable sticky note rendered as its own React Flow node type. Features:
 *   - 6 color presets (matches SabFlow's AnnotationColor palette)
 *   - Click-to-edit: double-click (or Enter) enters edit mode; blur commits.
 *   - Corner resize handle: drag-to-resize, clamps to min 160x100.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import type { AnnotationColor } from '@/lib/sabflow/types';
import { Palette, Trash2 } from 'lucide-react';
import { Button, IconButton, Textarea } from '@/components/sabcrm/20ui';

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
      className={[
        'ui20 sabflow-sticky relative overflow-visible rounded-[var(--st-radius-lg)] p-3 text-[13px] text-[var(--st-text)]',
        selected
          ? 'shadow-[0_0_0_3px_var(--st-accent-ring),var(--st-shadow-md)]'
          : 'shadow-[var(--st-shadow-md)]',
      ].join(' ')}
      data-testid="canvas-sticky-note"
      style={{
        width: w,
        height: h,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
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
         * onResizeEnd (not onResize): otherwise React Flow fires onResize
         * during mount with the measured DOM size, which round-trips through
         * flow state and triggers a re-render to onResize to ... (React #185).
         */
        onResizeEnd={(_e, params) => {
          onUpdate?.(id, { width: params.width, height: params.height });
        }}
        lineStyle={{ borderColor: palette.border }}
        handleStyle={{
          background: palette.border,
          border: '2px solid var(--st-bg)',
          width: 10,
          height: 10,
        }}
      />

      {editing ? (
        <Textarea
          ref={textareaRef}
          aria-label="Sticky note content"
          defaultValue={d.content ?? ''}
          onBlur={(e) => {
            setEditing(false);
            onContentCommit(e.currentTarget.value);
          }}
          className="nodrag nopan h-full !min-h-0 !resize-none !border-0 !bg-transparent !p-0 !leading-snug !text-inherit !shadow-none"
        />
      ) : (
        <div
          className={[
            'h-full overflow-hidden whitespace-pre-wrap leading-snug',
            d.content ? 'text-[var(--st-text)]' : 'text-[var(--st-text-tertiary)]',
          ].join(' ')}
        >
          {d.content || 'Double-click to edit'}
        </div>
      )}

      {selected && !isReadOnly && !editing ? (
        <div
          className="nodrag nopan absolute -top-[34px] right-0 flex gap-1 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-[var(--st-shadow-pop)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <IconButton
            label="Change color"
            icon={Palette}
            size="sm"
            onClick={() => setShowPalette((v) => !v)}
          />
          <IconButton
            label="Delete"
            icon={Trash2}
            size="sm"
            variant="danger"
            onClick={() => onDelete?.(id)}
          />
          {showPalette ? (
            <div className="absolute right-0 top-[34px] flex gap-1 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1.5 shadow-[var(--st-shadow-pop)]">
              {COLOR_KEYS.map((k) => (
                <Button
                  key={k}
                  variant="ghost"
                  size="sm"
                  aria-label={`Use ${k}`}
                  title={`Use ${k}`}
                  className="!h-5 !w-5 !min-w-0 !rounded-full !border-2 !p-0"
                  style={{
                    borderColor: COLOR_PALETTE[k].border,
                    background: COLOR_PALETTE[k].bg,
                  }}
                  onClick={() => {
                    onUpdate?.(id, { color: k });
                    setShowPalette(false);
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
