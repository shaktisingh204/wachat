/**
 * Canvas geometry constants — ported from n8n's nodeViewUtils.ts
 * (packages/frontend/editor-ui/src/app/utils/nodeViewUtils.ts).
 *
 * Keep values in sync with n8n so snap-to-grid, default positions,
 * and zoom math behave identically.
 */

export const GRID_SIZE = 16;

/** Default canvas node dimensions. 96×96 = 6×6 grid units in n8n. */
export const DEFAULT_NODE_WIDTH = GRID_SIZE * 6;
export const DEFAULT_NODE_HEIGHT = GRID_SIZE * 6;

/** Configurable (wide) node — used by trigger/configurable variants. */
export const CONFIGURABLE_NODE_WIDTH = GRID_SIZE * 16;

/** Trigger node rounded-corner radius on its left side. */
export const TRIGGER_NODE_RADIUS = 36;

/** Default starting position for the first node on an empty canvas. */
export const DEFAULT_START_POSITION_X = GRID_SIZE * 11;
export const DEFAULT_START_POSITION_Y = GRID_SIZE * 15;

/** Horizontal offset between a source node and the new node spawned from it. */
export const PUSH_NODES_OFFSET = DEFAULT_NODE_WIDTH * 2 + GRID_SIZE;

/** Edge toolbar shows up after this long of hovering (ms). */
export const EDGE_TOOLBAR_HOVER_DELAY = 600;

/** Zoom bounds — matches n8n. */
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;

/** Color palette — keeps Typebot's orange primary (`#f76808`) while
 *  mapping n8n's status colors to semantic CSS variables. */
export const CANVAS_COLORS = {
  primary: '#f76808',
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  pinned: '#7c3aed',
  running: '#f76808',
  nodeBorder: 'var(--gray-6)',
  nodeBorderSelected: '#f76808',
  nodeBackground: 'var(--gray-1)',
  canvasBackground: 'var(--gray-2)',
  gridDot: 'var(--gray-6)',
  edgeDefault: 'var(--gray-8)',
  edgeHover: 'var(--gray-11)',
} as const;
