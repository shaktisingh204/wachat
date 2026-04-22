/**
 * Handle-string helpers — ported 1:1 from n8n's canvas.utils.ts.
 * Handle format: "{mode}/{type}/{index}", e.g. "outputs/main/0".
 */
import type { PortType } from '@/lib/sabflow/types';
import { CanvasConnectionMode } from './types';

/** Build an n8n-style handle ID. */
export function createCanvasConnectionHandleString(args: {
  mode: CanvasConnectionMode;
  type?: PortType;
  index?: number;
}): string {
  const { mode, type = 'main', index = 0 } = args;
  return `${mode}/${type}/${index}`;
}

/** Parse a handle ID back to its parts; returns sane defaults on bad input. */
export function parseCanvasConnectionHandleString(
  handle: string | null | undefined,
): { mode: CanvasConnectionMode; type: PortType; index: number } {
  const parts = (handle ?? '').split('/');
  const mode: CanvasConnectionMode =
    parts[0] === 'inputs' || parts[0] === 'outputs'
      ? (parts[0] as CanvasConnectionMode)
      : CanvasConnectionMode.Output;
  const type = (parts[1] ?? 'main') as PortType;
  const parsedIndex = parseInt(parts[2] ?? '0', 10);
  const index = Number.isNaN(parsedIndex) ? 0 : parsedIndex;
  return { mode, type, index };
}

/** Stable ID for a canvas connection — matches n8n's createCanvasConnectionId. */
export function createCanvasConnectionId(args: {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}): string {
  return `[${args.source}/${args.sourceHandle ?? ''}][${args.target}/${args.targetHandle ?? ''}]`;
}

/** Ignore canvas keyboard shortcuts when the user is typing in a field. */
export function shouldIgnoreCanvasShortcut(el: Element | null): boolean {
  if (!el) return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  if (el.closest('[contenteditable="true"]') !== null) return true;
  if (el.closest('.ignore-key-press-canvas') !== null) return true;
  return false;
}
