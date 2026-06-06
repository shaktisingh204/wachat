'use client';

/**
 * Middle pane: renders an in-editor preview of each block with a hover
 * toolbar (move up/down, duplicate, delete). Clicking a block selects
 * it so the right inspector pane can edit its props.
 */
import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';

import { Button, EmptyState, ScrollArea, cn } from '@/components/sabcrm/20ui/compat';
import type {
  EmailBuilderBlock,
  EmailBuilderDocument,
} from '@/lib/email/types';

export interface BuilderCanvasProps {
  doc: EmailBuilderDocument;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BuilderCanvas({
  doc,
  selectedId,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: BuilderCanvasProps) {
  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: doc.settings.backgroundColor ?? '#f4f4f7',
      fontFamily: doc.settings.fontFamily ?? 'Inter, Arial, sans-serif',
    }),
    [doc.settings.backgroundColor, doc.settings.fontFamily],
  );

  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: doc.settings.contentBackgroundColor ?? '#ffffff',
      maxWidth: doc.settings.width ?? 600,
    }),
    [doc.settings.contentBackgroundColor, doc.settings.width],
  );

  return (
    <ScrollArea
      className="flex-1"
      onClick={() => onSelect(null)}
    >
      <div className="min-h-full px-6 py-8" style={containerStyle}>
        {doc.settings.preheader ? (
          <p className="mx-auto mb-2 max-w-[600px] text-xs italic text-zoru-ink-muted">
            Preheader: {doc.settings.preheader}
          </p>
        ) : null}
        <div
          className="mx-auto rounded-md shadow-sm"
          style={contentStyle}
        >
          {doc.blocks.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No blocks yet"
                description="Pick a block from the left rail to start building."
              />
            </div>
          ) : (
            doc.blocks.map((block, index) => (
              <BlockRow
                key={block.id}
                block={block}
                selected={block.id === selectedId}
                isFirst={index === 0}
                isLast={index === doc.blocks.length - 1}
                onSelect={onSelect}
                onMove={onMove}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

interface BlockRowProps {
  block: EmailBuilderBlock;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function BlockRow({
  block,
  selected,
  isFirst,
  isLast,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: BlockRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(block.id);
        }
      }}
      className={cn(
        'group relative cursor-pointer border border-transparent transition-colors',
        selected
          ? 'border-primary ring-2 ring-primary/30'
          : 'hover:border-primary/40',
      )}
      aria-label={`Block: ${block.type}`}
      aria-pressed={selected}
    >
      <div
        className={cn(
          'pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-zoru-line bg-zoru-surface p-1 opacity-0 shadow-sm transition-opacity',
          'group-hover:pointer-events-auto group-hover:opacity-100',
          selected && 'pointer-events-auto opacity-100',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move up"
          disabled={isFirst}
          onClick={() => onMove(block.id, 'up')}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move down"
          disabled={isLast}
          onClick={() => onMove(block.id, 'down')}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Duplicate block"
          onClick={() => onDuplicate(block.id)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete block"
          onClick={() => onDelete(block.id)}
          className="text-zoru-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <BlockPreview block={block} />
    </div>
  );
}

/* ────────── Per-type previews ────────── */

function BlockPreview({ block }: { block: EmailBuilderBlock }) {
  const p = block.props as Record<string, unknown>;
  const padding = typeof p.padding === 'number' ? p.padding : 12;

  switch (block.type) {
    case 'text': {
      const align = (p.align as React.CSSProperties['textAlign']) ?? 'left';
      return (
        <div
          style={{
            padding,
            color: (p.color as string) ?? '#1a1a1a',
            fontSize: (p.fontSize as number) ?? 16,
            textAlign: align,
            whiteSpace: 'pre-wrap',
          }}
        >
          {(p.content as string) || <span className="text-zoru-ink-muted">Empty text</span>}
        </div>
      );
    }
    case 'image': {
      const src = p.src as string;
      const align = (p.align as 'left' | 'center' | 'right') ?? 'center';
      return (
        <div
          style={{
            padding,
            textAlign: align,
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={(p.alt as string) ?? ''}
              style={{ maxWidth: (p.width as number) ?? 600, height: 'auto', display: 'inline-block' }}
            />
          ) : (
            <div className="rounded border border-dashed border-zoru-line bg-zoru-surface-2/40 p-8 text-xs text-zoru-ink-muted">
              Pick an image from SabFiles
            </div>
          )}
        </div>
      );
    }
    case 'button': {
      const align = (p.align as 'left' | 'center' | 'right') ?? 'center';
      return (
        <div style={{ padding, textAlign: align }}>
          <span
            style={{
              display: 'inline-block',
              padding: `${padding}px ${padding * 2}px`,
              backgroundColor: (p.backgroundColor as string) ?? '#111827',
              color: (p.textColor as string) ?? '#ffffff',
              borderRadius: (p.borderRadius as number) ?? 6,
              fontWeight: 600,
            }}
          >
            {(p.label as string) || 'Button'}
          </span>
        </div>
      );
    }
    case 'columns': {
      const columns = (p.columns as number) ?? 2;
      const gap = (p.gap as number) ?? 12;
      const children = block.children ?? [];
      return (
        <div
          style={{
            padding,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap,
          }}
        >
          {Array.from({ length: columns }).map((_, idx) => (
            <div key={idx} className="rounded border border-dashed border-zoru-line/60 bg-zoru-surface-2/30 p-2">
              {children[idx] ? <BlockPreview block={children[idx]} /> : (
                <span className="text-xs text-zoru-ink-muted">Column {idx + 1}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    case 'divider': {
      return (
        <div style={{ padding }}>
          <hr
            style={{
              border: 'none',
              borderTopWidth: (p.thickness as number) ?? 1,
              borderTopStyle: 'solid',
              borderTopColor: (p.color as string) ?? '#e5e7eb',
            }}
          />
        </div>
      );
    }
    case 'spacer': {
      return <div style={{ height: (p.height as number) ?? 24 }} aria-hidden />;
    }
    case 'social': {
      const networks = (p.networks as Array<{ network: string; url: string }>) ?? [];
      const align = (p.align as 'left' | 'center' | 'right') ?? 'center';
      return (
        <div style={{ padding, textAlign: align }}>
          {networks.map((n, idx) => (
            <span
              key={`${n.network}-${idx}`}
              className="mx-1 inline-block rounded bg-zoru-surface-2 px-2 py-1 text-xs text-zoru-ink-muted"
            >
              {n.network}
            </span>
          ))}
        </div>
      );
    }
    case 'video': {
      const src = p.src as string;
      return (
        <div style={{ padding, textAlign: 'center' }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(p.poster as string) || src}
              alt="Video poster"
              style={{ maxWidth: (p.width as number) ?? 600, height: 'auto' }}
            />
          ) : (
            <div className="rounded border border-dashed border-zoru-line bg-zoru-surface-2/40 p-8 text-xs text-zoru-ink-muted">
              Add video src
            </div>
          )}
        </div>
      );
    }
    case 'footer': {
      return (
        <div
          style={{
            padding,
            textAlign: 'center',
            color: (p.color as string) ?? '#6b7280',
            fontSize: 12,
          }}
        >
          <div>{(p.companyName as string) ?? ''}</div>
          <div>{(p.address as string) ?? ''}</div>
          <div className="mt-1 underline">{(p.unsubscribeText as string) ?? 'Unsubscribe'}</div>
        </div>
      );
    }
    case 'html': {
      return (
        <div className="m-2 rounded border border-dashed border-zoru-line bg-zoru-surface-2/40 p-3 font-mono text-xs">
          <span className="text-zoru-ink-muted">[Raw HTML]</span>
          <pre className="mt-1 whitespace-pre-wrap break-all">
            {((p.html as string) ?? '').slice(0, 240) || '<!-- empty -->'}
          </pre>
        </div>
      );
    }
    case 'amp': {
      return (
        <div className="m-2 rounded border border-dashed border-zoru-line/60 bg-zoru-ink/10 p-3 font-mono text-xs">
          <span className="text-zoru-ink">[AMP only]</span>
        </div>
      );
    }
    default: {
      return (
        <div className="p-3 text-xs text-zoru-ink-muted">
          Unknown block type
        </div>
      );
    }
  }
}
