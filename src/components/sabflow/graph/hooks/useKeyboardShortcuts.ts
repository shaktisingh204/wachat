'use client';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSelectionStore } from './useSelectionStore';
import type { SabFlowDoc, GraphPosition, Group } from '@/lib/sabflow/types';

/* ─── Constants (kept in sync with ZoomButtons) ──────────────────────────── */
const MAX_SCALE = 2;
const MIN_SCALE = 0.2;
const ZOOM_STEP = 0.2;

/** Approximate group-node dimensions in canvas space (mirrors ZoomButtons). */
const GROUP_NODE_WIDTH = 300;
const GROUP_NODE_HEIGHT = 100;
const EVENT_NODE_WIDTH = 200;
const EVENT_NODE_HEIGHT = 70;
const FIT_PADDING = 80;

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type KeyboardShortcutsConfig = {
  flow: SabFlowDoc;
  onFlowChange: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>>) => void;
  graphPosition: GraphPosition;
  setGraphPosition: (pos: GraphPosition | ((prev: GraphPosition) => GraphPosition)) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  undo?: () => void;
  redo?: () => void;
  /** Called when Escape is pressed — use to close any open panel. */
  onEscape?: () => void;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // contenteditable elements
  return target.isContentEditable;
}

function computeFitView(
  flow: SabFlowDoc,
  canvasEl: HTMLDivElement,
): GraphPosition {
  const items = [
    ...flow.groups.map((g) => ({
      x: g.graphCoordinates.x,
      y: g.graphCoordinates.y,
      w: GROUP_NODE_WIDTH,
      h: GROUP_NODE_HEIGHT,
    })),
    ...flow.events.map((ev) => ({
      x: ev.graphCoordinates.x,
      y: ev.graphCoordinates.y,
      w: EVENT_NODE_WIDTH,
      h: EVENT_NODE_HEIGHT,
    })),
  ];

  if (items.length === 0) return { x: 0, y: 0, scale: 1 };

  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.w));
  const maxY = Math.max(...items.map((i) => i.y + i.h));

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const canvasW = canvasEl.clientWidth;
  const canvasH = canvasEl.clientHeight;

  const scaleX = (canvasW - FIT_PADDING * 2) / contentW;
  const scaleY = (canvasH - FIT_PADDING * 2) / contentH;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(scaleX, scaleY)));

  const scaledW = contentW * newScale;
  const scaledH = contentH * newScale;

  return {
    x: (canvasW - scaledW) / 2 - minX * newScale,
    y: (canvasH - scaledH) / 2 - minY * newScale,
    scale: newScale,
  };
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */

/**
 * Registers all graph-canvas keyboard shortcuts.
 *
 * Shortcuts handled here (does NOT duplicate shortcuts already handled in
 * ElementsSelectionMenu or EditorPage):
 *   Ctrl/Cmd + Z            → undo (delegates to `undo` prop)
 *   Ctrl/Cmd + Shift + Z    → redo (delegates to `redo` prop)
 *   Ctrl/Cmd + Y            → redo (Windows alias)
 *   Ctrl/Cmd + =  /  +      → zoom in
 *   Ctrl/Cmd + -            → zoom out
 *   Ctrl/Cmd + 0            → reset zoom to 100%
 *   Ctrl/Cmd + Shift + F    → fit view
 *   Arrow keys              → nudge selected elements 10px (50px with Shift)
 *   Escape                  → deselect all + call onEscape
 */
export function useKeyboardShortcuts({
  flow,
  onFlowChange,
  graphPosition,
  setGraphPosition,
  canvasRef,
  undo,
  redo,
  onEscape,
}: KeyboardShortcutsConfig): void {
  const { blurElements, moveFocusedElements, getElementsCoordinates, focusedElementsId } =
    useSelectionStore(
      useShallow((s) => ({
        blurElements: s.blurElements,
        moveFocusedElements: s.moveFocusedElements,
        getElementsCoordinates: s.getElementsCoordinates,
        focusedElementsId: s.focusedElementsId,
      })),
    );

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target)) return;

      const isMeta = e.metaKey || e.ctrlKey;

      /* ── Undo / Redo ─────────────────────────────────────────────────── */
      if (isMeta && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo?.();
        return;
      }

      if (isMeta && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo?.();
        return;
      }

      if (isMeta && !e.shiftKey && e.key === 'y') {
        e.preventDefault();
        redo?.();
        return;
      }

      /* ── Zoom in: Ctrl/Cmd + = or Ctrl/Cmd + + ───────────────────────── */
      if (isMeta && !e.shiftKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setGraphPosition((pos) => ({
          ...pos,
          scale: Math.min(MAX_SCALE, pos.scale + ZOOM_STEP),
        }));
        return;
      }

      /* ── Zoom out: Ctrl/Cmd + - ──────────────────────────────────────── */
      if (isMeta && !e.shiftKey && e.key === '-') {
        e.preventDefault();
        setGraphPosition((pos) => ({
          ...pos,
          scale: Math.max(MIN_SCALE, pos.scale - ZOOM_STEP),
        }));
        return;
      }

      /* ── Reset zoom: Ctrl/Cmd + 0 ────────────────────────────────────── */
      if (isMeta && !e.shiftKey && e.key === '0') {
        e.preventDefault();
        setGraphPosition({ x: 0, y: 0, scale: 1 });
        return;
      }

      /* ── Fit view: Ctrl/Cmd + Shift + F ─────────────────────────────── */
      if (isMeta && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (!canvasRef.current) return;
        setGraphPosition(computeFitView(flow, canvasRef.current));
        return;
      }

      /* ── Arrow-key nudge ─────────────────────────────────────────────── */
      if (
        focusedElementsId.length > 0 &&
        !isMeta &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 50 : 10;
        const delta =
          e.key === 'ArrowUp'
            ? { x: 0, y: -step }
            : e.key === 'ArrowDown'
              ? { x: 0, y: step }
              : e.key === 'ArrowLeft'
                ? { x: -step, y: 0 }
                : { x: step, y: 0 };

        moveFocusedElements(delta);

        // Persist the nudge into the flow document
        const coords = getElementsCoordinates();
        if (!coords) return;

        const updatedGroups: Group[] = flow.groups.map((g) =>
          focusedElementsId.includes(g.id) && coords[g.id]
            ? { ...g, graphCoordinates: coords[g.id] }
            : g,
        );

        onFlowChange({ groups: updatedGroups });
        return;
      }

      /* ── Escape: deselect all + close panel ──────────────────────────── */
      if (e.key === 'Escape') {
        blurElements();
        onEscape?.();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    flow,
    onFlowChange,
    graphPosition,
    setGraphPosition,
    canvasRef,
    undo,
    redo,
    onEscape,
    blurElements,
    moveFocusedElements,
    getElementsCoordinates,
    focusedElementsId,
  ]);
}
