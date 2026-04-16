'use client';
import { memo, useCallback } from 'react';
import type { Annotation, SabFlowDoc } from '@/lib/sabflow/types';
import { StickyNote } from './StickyNote';

type Props = {
  /** Full annotations array from the flow doc. */
  annotations: Annotation[] | undefined;
  /** Flow-change callback — updates the flow's `annotations` array. */
  onFlowChange: (changes: Partial<Pick<SabFlowDoc, 'annotations'>>) => void;
};

/**
 * AnnotationsLayer
 *
 * Renders every sticky-note / text-label annotation inside the graph's
 * transformed canvas layer (so they pan and zoom with the rest of the graph).
 *
 * Lives above edges but below focus rings / toolbars.  Annotation updates
 * immutably replace the `annotations` array on the flow doc.
 */
function AnnotationsLayerImpl({ annotations, onFlowChange }: Props) {
  const list = annotations ?? [];

  const handleChange = useCallback(
    (id: string, changes: Partial<Annotation>) => {
      const next = list.map((a) => (a.id === id ? { ...a, ...changes } : a));
      onFlowChange({ annotations: next });
    },
    [list, onFlowChange],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onFlowChange({ annotations: list.filter((a) => a.id !== id) });
    },
    [list, onFlowChange],
  );

  if (list.length === 0) return null;

  return (
    <>
      {list.map((annotation) => (
        <StickyNote
          key={annotation.id}
          annotation={annotation}
          onChange={handleChange}
          onDelete={handleDelete}
        />
      ))}
    </>
  );
}

export const AnnotationsLayer = memo(AnnotationsLayerImpl);
