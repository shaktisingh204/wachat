'use client';
import { useEffect, useRef, useCallback } from 'react';
import { LuPencil, LuNetwork } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { useSelectionStore } from '../../../hooks/useSelectionStore';

// ── Sub-components ────────────────────────────────────────────────────────────

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function MenuItem({ icon, label, disabled = false, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2.5 px-3 py-[7px] text-[12.5px] transition-colors select-none',
        disabled
          ? 'cursor-not-allowed opacity-40 text-[var(--gray-12)]'
          : 'cursor-pointer text-[var(--gray-12)] hover:bg-[var(--gray-3)]',
      ].join(' ')}
    >
      <span className="shrink-0 text-[var(--gray-10)]">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  /** The event (e.g. Start) node's own ID. */
  eventId: string;
  position: { x: number; y: number };
  onClose: () => void;
  /** Full flow slice — needed for edge traversal in "Select connected". */
  flow?: Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>;
  /** Triggered when "Edit description" is chosen. */
  onEditDescription?: () => void;
  /** Optional: pan/zoom to the given group after selection. */
  onFocusGroup?: (groupId: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * EventContextMenu — right-click context menu for event nodes (Start, etc.).
 *
 * Intentionally minimal: event nodes are structural anchors and cannot be
 * deleted.  Available actions are:
 *   • Edit description — focuses the event node's description input
 *   • Select connected — BFS from this event's outgoing edges to select all
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
  // BFS: start from edges whose source is this event, then follow group→group edges.
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

    // Traverse forward through group→group edges
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
      style={{ top: position.y, left: position.x }}
      className="fixed z-[9999] min-w-[190px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-xl py-1 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem
        icon={<LuPencil size={13} />}
        label="Edit description"
        onClick={handleEditDescription}
      />
      <MenuItem
        icon={<LuNetwork size={13} />}
        label="Select connected"
        onClick={handleSelectConnected}
      />
    </div>
  );
}
