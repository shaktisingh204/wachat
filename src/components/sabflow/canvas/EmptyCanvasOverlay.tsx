'use client';
/**
 * EmptyCanvasOverlay — port of n8n's "Add first step" empty-canvas CTA.
 *
 * Shown when a workflow has zero nodes. Centered card with a single button
 * that pops the node creator (we don't filter to triggers here because SabFlow
 * chats can also start from a regular block).
 */
import { LuPlus, LuSparkles } from 'react-icons/lu';

type Props = { onAdd: () => void };

export function EmptyCanvasOverlay({ onAdd }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: 'var(--gray-1)',
          border: '1px dashed var(--gray-6)',
          borderRadius: 16,
          padding: '24px 28px',
          textAlign: 'center',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.18)',
          maxWidth: 320,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            margin: '0 auto 12px',
            borderRadius: 999,
            background: 'rgba(247, 104, 8, 0.1)',
            color: '#f76808',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LuSparkles className="h-5 w-5" />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-12)', marginBottom: 4 }}>
          Start your workflow
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-10)', lineHeight: 1.45, marginBottom: 14 }}>
          Add a first step — a trigger, message, or integration — and wire
          nodes together by dragging from a handle.
        </div>
        <button
          type="button"
          onClick={onAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#f76808',
            color: 'white',
            border: 0,
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <LuPlus className="h-3.5 w-3.5" />
          Add first step
        </button>
      </div>
    </div>
  );
}
