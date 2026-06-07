'use client';
/**
 * CanvasEdgeToolbar — port of n8n's CanvasEdgeToolbar.vue.
 * Midpoint "+ insert node" and "trash" buttons, shown when the edge is hovered.
 */
import { Plus, Trash2 } from 'lucide-react';

import { IconButton } from '@/components/sabcrm/20ui';

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
        <IconButton
          label="Insert node on this connection"
          icon={Plus}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.();
          }}
        />
      ) : null}
      <IconButton
        label="Delete connection"
        icon={Trash2}
        variant="danger"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
      />
    </div>
  );
}
