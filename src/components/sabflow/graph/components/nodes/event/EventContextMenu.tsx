'use client';
import { useEffect, useRef, useCallback } from 'react';
import { Pencil, Network } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/sabcrm/20ui';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { useSelectionStore } from '../../../hooks/useSelectionStore';

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  /** The event (e.g. Start) node's own ID. */
  eventId: string;
  position: { x: number; y: number };
  onClose: () => void;
  /** Full flow slice - needed for edge traversal in "Select connected". */
  flow?: Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>;
  /** Triggered when "Edit description" is chosen. */
  onEditDescription?: () => void;
  /** Optional: pan/zoom to the given group after selection. */
  onFocusGroup?: (groupId: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * EventContextMenu - right-click context menu for event nodes (Start, etc.).
 *
 * Intentionally minimal: event nodes are structural anchors and cannot be
 * deleted. Available actions are:
 *   - Edit description: focuses the event node's description input
 *   - Select connected: BFS from this event's outgoing edges to select all
 *     reachable group nodes
 */
export function EventContextMenu({
  eventId,
  position,
  onClose,
  flow,
  onEditDescription,
  onFocusGroup,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  const { setFocusedElements } = useSelectionStore(
    useShallow((s) => ({ setFocusedElements: s.setFocusedElements })),
  );

  // ── Close on outside click + Escape ──────────────────────────────────────────
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // ── Edit description ──────────────────────────────────────────────────────────
  const handleEditDescription = () => {
    onEditDescription?.();
    onClose();
  };

  // ── Select connected ──────────────────────────────────────────────────────────
  // BFS: start from edges whose source is this event, then follow group->group edges.
  const handleSelectConnected = useCallback(() => {
    if (!flow) { onClose(); return; }

    const visitedGroups = new Set<string>();
    const groupQueue: string[] = [];

    // Seed: find the first group reachable directly from the event's outgoing edge
    flow.edges.forEach((edge) => {
      if ('eventId' in edge.from && edge.from.eventId === eventId && edge.to.groupId) {
        if (!visitedGroups.has(edge.to.groupId)) {
          visitedGroups.add(edge.to.groupId);
          groupQueue.push(edge.to.groupId);
          onFocusGroup?.(edge.to.groupId);
        }
      }
    });

    // Traverse forward through group->group edges
    while (groupQueue.length > 0) {
      const current = groupQueue.shift()!;
      flow.edges.forEach((edge) => {
        if (edge.from.groupId === current && edge.to.groupId && !visitedGroups.has(edge.to.groupId)) {
          visitedGroups.add(edge.to.groupId);
          groupQueue.push(edge.to.groupId);
        }
      });
    }

    if (visitedGroups.size > 0) {
      setFocusedElements(Array.from(visitedGroups));
    }

    onClose();
  }, [flow, eventId, setFocusedElements, onFocusGroup, onClose]);

  return (
    <div
      ref={menuRef}
      // Runtime-computed: anchored to the cursor where the right-click landed.
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-label="Event actions"
      className="20ui fixed z-[9999] flex min-w-[190px] flex-col gap-0.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-xl select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Button
        variant="ghost"
        size="sm"
        block
        iconLeft={Pencil}
        role="menuitem"
        onClick={handleEditDescription}
        className="justify-start"
      >
        Edit description
      </Button>
      <Button
        variant="ghost"
        size="sm"
        block
        iconLeft={Network}
        role="menuitem"
        onClick={handleSelectConnected}
        className="justify-start"
      >
        Select connected
      </Button>
    </div>
  );
}
