'use client';
/**
 * CanvasEdgeToolbar — port of n8n's CanvasEdgeToolbar.vue.
 * Midpoint "+ insert node" and "trash" buttons, shown when the edge is hovered.
 */
import { LuPlus, LuTrash2 } from 'react-icons/lu';

type Props = {
  onAdd?: () => void;
  onDelete?: () => void;
  /** Hide the "+" on non-main connections where insertion isn't supported. */
  canAdd?: boolean;
};

export function CanvasEdgeToolbar({ onAdd, onDelete, canAdd = true }: Props) {
  return (
    <div
      className="sabflow-edge-toolbar"
      data-testid="canvas-edge-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {canAdd ? (
        <button
          type="button"
          className="sabflow-edge-toolbar__btn"
          aria-label="Insert node on this connection"
          title="Insert node"
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.();
          }}
        >
          <LuPlus className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        className="sabflow-edge-toolbar__btn is-danger"
        aria-label="Delete connection"
        title="Delete connection"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
      >
        <LuTrash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
