'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { LuPalette, LuTrash2, LuX } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import type { Annotation, AnnotationColor } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { useGraph } from '../../providers/GraphProvider';
import { useSelectionStore } from '../../hooks/useSelectionStore';

/* ─── Colour palette ──────────────────────────────────────────────────────── */

type ColorTokens = {
  /** Paper background */
  bg: string;
  /** Slightly darker top strip (the "tape" / header) */
  strip: string;
  /** Border colour */
  border: string;
  /** Text colour */
  text: string;
};

const COLOR_TOKENS: Record<AnnotationColor, ColorTokens> = {
  yellow: { bg: '#fff4b3', strip: '#ffe680', border: '#e6c200', text: '#5a4800' },
  pink:   { bg: '#ffd6e0', strip: '#ffb6c7', border: '#e69fb0', text: '#6b2438' },
  blue:   { bg: '#cfe8ff', strip: '#a9d2fb', border: '#86b7ea', text: '#0f3a66' },
  green:  { bg: '#d4f2d6', strip: '#b3e0b7', border: '#86c48c', text: '#1f5128' },
  purple: { bg: '#e2d6ff', strip: '#c8b6f5', border: '#a489e6', text: '#3b2478' },
  orange: { bg: '#ffe0c2', strip: '#ffc68a', border: '#eaa767', text: '#6b3708' },
};

const COLOR_ORDER: AnnotationColor[] = [
  'yellow',
  'pink',
  'blue',
  'green',
  'purple',
  'orange',
];

/* ─── Constants ───────────────────────────────────────────────────────────── */

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 150;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 90;
const DEFAULT_COLOR: AnnotationColor = 'yellow';

/** Deterministic "playful" rotation per annotation id — range ±2deg. */
function rotationFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  // Map hash to [-2, 2]
  const normalized = ((hash % 400) + 400) % 400; // 0..399
  return (normalized - 200) / 100;
}

/* ─── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  annotation: Annotation;
  /** Persist partial changes back into the flow doc. */
  onChange: (id: string, changes: Partial<Annotation>) => void;
  /** Remove this annotation from the flow doc. */
  onDelete: (id: string) => void;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function StickyNote({ annotation, onChange, onDelete }: Props) {
  const { graphPosition, isReadOnly } = useGraph();

  const isFocused = useSelectionStore(
    useShallow((s) => s.focusedElementsId.includes(annotation.id)),
  );
  const { focusElement } = useSelectionStore(
    useShallow((s) => ({ focusElement: s.focusElement })),
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(annotation.content);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Live drag/resize offsets — applied via transform to avoid per-frame React renders.
  const dragState = useRef<{
    mode: 'drag' | 'resize' | null;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>({
    mode: null,
    startClientX: 0,
    startClientY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  const [livePos, setLivePos] = useState<{ x: number; y: number }>(
    annotation.graphCoordinates,
  );
  const [liveSize, setLiveSize] = useState<{ width: number; height: number }>({
    width: annotation.width ?? DEFAULT_WIDTH,
    height: annotation.height ?? DEFAULT_HEIGHT,
  });

  // Sync local state when the persisted annotation changes (e.g. after save).
  useEffect(() => {
    setLivePos(annotation.graphCoordinates);
  }, [annotation.graphCoordinates]);

  useEffect(() => {
    setLiveSize({
      width: annotation.width ?? DEFAULT_WIDTH,
      height: annotation.height ?? DEFAULT_HEIGHT,
    });
  }, [annotation.width, annotation.height]);

  useEffect(() => {
    if (!isEditing) setDraftContent(annotation.content);
  }, [annotation.content, isEditing]);

  /* ─── Colours & style ───────────────────────────────────────────────────── */

  const color: AnnotationColor = annotation.color ?? DEFAULT_COLOR;
  const tokens = COLOR_TOKENS[color];
  const rotation = useMemo(() => rotationFor(annotation.id), [annotation.id]);

  const rootStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translate(${livePos.x}px, ${livePos.y}px) rotate(${rotation}deg)`,
    width: liveSize.width,
    height: liveSize.height,
    backgroundColor: tokens.bg,
    borderColor: tokens.border,
    color: tokens.text,
    fontSize: annotation.fontSize ?? 13,
    boxShadow:
      '0 1px 1px rgba(0,0,0,0.06), 0 6px 14px -6px rgba(0,0,0,0.25), 0 10px 24px -12px rgba(0,0,0,0.18)',
    touchAction: 'none',
  };

  /* ─── Drag ──────────────────────────────────────────────────────────────── */

  const onBodyPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isReadOnly) return;
      // Left button only
      if (e.button !== 0) return;
      // If currently editing the textarea, don't start a drag from within it
      if (isEditing) return;

      e.stopPropagation();
      focusElement(annotation.id, e.shiftKey);

      dragState.current = {
        mode: 'drag',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: livePos.x,
        startY: livePos.y,
        startWidth: liveSize.width,
        startHeight: liveSize.height,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [annotation.id, focusElement, isEditing, isReadOnly, livePos.x, livePos.y, liveSize.height, liveSize.width],
  );

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isReadOnly) return;
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      dragState.current = {
        mode: 'resize',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: livePos.x,
        startY: livePos.y,
        startWidth: liveSize.width,
        startHeight: liveSize.height,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [isReadOnly, livePos.x, livePos.y, liveSize.height, liveSize.width],
  );

  // Global pointermove / pointerup for drag + resize.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state.mode) return;

      const dx = (e.clientX - state.startClientX) / graphPosition.scale;
      const dy = (e.clientY - state.startClientY) / graphPosition.scale;

      if (state.mode === 'drag') {
        setLivePos({ x: state.startX + dx, y: state.startY + dy });
      } else {
        setLiveSize({
          width: Math.max(MIN_WIDTH, state.startWidth + dx),
          height: Math.max(MIN_HEIGHT, state.startHeight + dy),
        });
      }
    };
    const onUp = () => {
      const state = dragState.current;
      if (!state.mode) return;
      const mode = state.mode;
      dragState.current = { ...state, mode: null };

      if (mode === 'drag') {
        // Persist the final coordinates once.
        const next = { x: livePosRef.current.x, y: livePosRef.current.y };
        if (next.x !== state.startX || next.y !== state.startY) {
          onChange(annotation.id, { graphCoordinates: next });
        }
      } else if (mode === 'resize') {
        const size = liveSizeRef.current;
        if (size.width !== state.startWidth || size.height !== state.startHeight) {
          onChange(annotation.id, { width: size.width, height: size.height });
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [annotation.id, graphPosition.scale, onChange]);

  // Refs mirroring the latest live* values so the global pointerup handler
  // always reads fresh values (avoids stale closures).
  const livePosRef = useRef(livePos);
  const liveSizeRef = useRef(liveSize);
  useEffect(() => {
    livePosRef.current = livePos;
  }, [livePos]);
  useEffect(() => {
    liveSizeRef.current = liveSize;
  }, [liveSize]);

  /* ─── Editing ───────────────────────────────────────────────────────────── */

  const beginEditing = useCallback(() => {
    if (isReadOnly) return;
    setIsEditing(true);
    // Focus after the textarea mounts
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
  }, [isReadOnly]);

  const commitEditing = useCallback(() => {
    setIsEditing(false);
    if (draftContent !== annotation.content) {
      onChange(annotation.id, { content: draftContent });
    }
  }, [annotation.content, annotation.id, draftContent, onChange]);

  const onTextareaKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraftContent(annotation.content);
      setIsEditing(false);
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commitEditing();
    }
  };

  /* ─── Context menu ──────────────────────────────────────────────────────── */

  const onContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    focusElement(annotation.id);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const closeMenu = useCallback(() => setMenuPos(null), []);

  useEffect(() => {
    if (!menuPos) return;
    const onDoc = (e: MouseEvent) => {
      // Click anywhere except inside the open menu closes it.
      const el = e.target as Node | null;
      const menu = document.getElementById(`sticky-note-menu-${annotation.id}`);
      if (menu && el && menu.contains(el)) return;
      closeMenu();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onEsc);
    };
  }, [annotation.id, closeMenu, menuPos]);

  /* ─── Render ────────────────────────────────────────────────────────────── */

  return (
    <>
      <div
        ref={rootRef}
        id={`annotation-${annotation.id}`}
        data-moving-element={`annotation-${annotation.id}`}
        data-selectable={annotation.id}
        style={rootStyle}
        className={cn(
          'select-none rounded-[6px] border-[1.5px]',
          'will-change-transform',
          isFocused && 'ring-2 ring-[#f76808] ring-offset-1 ring-offset-transparent',
          isEditing ? 'cursor-text' : 'cursor-grab',
          dragState.current.mode === 'drag' && 'cursor-grabbing',
        )}
        onPointerDown={onBodyPointerDown}
        onClick={(e) => {
          e.stopPropagation();
          focusElement(annotation.id, e.shiftKey);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          beginEditing();
        }}
        onContextMenu={onContextMenu}
      >
        {/* "Tape" strip on top — purely decorative */}
        <div
          aria-hidden="true"
          className="h-[14px] w-full rounded-t-[4px]"
          style={{ backgroundColor: tokens.strip }}
        />

        {/* Body */}
        <div className="relative flex h-[calc(100%-14px)] w-full flex-col p-2">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              onBlur={commitEditing}
              onKeyDown={onTextareaKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Type a note..."
              className="h-full w-full resize-none bg-transparent outline-none placeholder:text-current/40"
              style={{ color: tokens.text }}
            />
          ) : (
            <div
              className="h-full w-full whitespace-pre-wrap break-words leading-snug"
              style={{ color: tokens.text }}
            >
              {annotation.content || (
                <span className="opacity-50">Double-click to edit</span>
              )}
            </div>
          )}

          {/* Resize handle — bottom right */}
          {!isReadOnly && (
            <div
              role="presentation"
              onPointerDown={onResizePointerDown}
              className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize"
              style={{
                background: `linear-gradient(135deg, transparent 50%, ${tokens.border} 50%)`,
                borderBottomRightRadius: 4,
              }}
            />
          )}
        </div>
      </div>

      {/* ─── Right-click context menu (fixed / screen coords) ─── */}
      {menuPos && (
        <div
          id={`sticky-note-menu-${annotation.id}`}
          role="menu"
          style={{ top: menuPos.y, left: menuPos.x }}
          className="fixed z-[9999] min-w-[200px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] py-1.5 shadow-xl select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pb-1.5 pt-0.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--gray-10)]">
              <LuPalette size={11} />
              Color
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeMenu}
              className="text-[var(--gray-10)] hover:text-[var(--gray-12)]"
            >
              <LuX size={12} />
            </button>
          </div>

          {/* Colour swatches */}
          <div className="flex items-center gap-1.5 px-3 pb-2">
            {COLOR_ORDER.map((c) => {
              const t = COLOR_TOKENS[c];
              const selected = c === color;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Set color ${c}`}
                  onClick={() => {
                    onChange(annotation.id, { color: c });
                    closeMenu();
                  }}
                  className={cn(
                    'h-5 w-5 rounded-full border transition-transform',
                    'hover:scale-110',
                    selected
                      ? 'ring-2 ring-offset-1 ring-[var(--gray-12)] ring-offset-[var(--gray-1)]'
                      : '',
                  )}
                  style={{ backgroundColor: t.bg, borderColor: t.border }}
                />
              );
            })}
          </div>

          <div className="my-1 h-px bg-[var(--gray-5)]" />

          {/* Delete */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDelete(annotation.id);
              closeMenu();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-[7px] text-[12.5px] text-[var(--red-11,_#d04b2d)] hover:bg-[var(--red-3,_#ffecec)]"
          >
            <LuTrash2 size={13} />
            <span className="flex-1 text-left">Delete note</span>
          </button>
        </div>
      )}
    </>
  );
}
