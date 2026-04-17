import type { BlockType, NodePort, PortType } from './types';

/* ── Helpers ──────────────────────────────────────────── */

/** Build a port ID in the n8n `{mode}/{type}/{index}` format. */
export function makePortId(
  mode: 'input' | 'output',
  type: PortType,
  index: number,
): string {
  return `${mode}s/${type}/${index}`;
}

/** Parse a port ID back into its constituent parts. Returns `null` on invalid IDs. */
export function parsePortId(
  id: string,
): { mode: 'input' | 'output'; type: PortType; index: number } | null {
  const parts = id.split('/');
  if (parts.length !== 3) return null;
  const modeRaw = parts[0];
  const type = parts[1] as PortType;
  const index = Number(parts[2]);
  if (Number.isNaN(index)) return null;
  if (modeRaw === 'inputs') return { mode: 'input', type, index };
  if (modeRaw === 'outputs') return { mode: 'output', type, index };
  return null;
}

function mkInput(type: PortType, index: number, label?: string, opts?: Partial<NodePort>): NodePort {
  return {
    id: makePortId('input', type, index),
    mode: 'input',
    type,
    index,
    label,
    maxConnections: 1,
    ...opts,
  };
}

function mkOutput(type: PortType, index: number, label?: string, opts?: Partial<NodePort>): NodePort {
  return {
    id: makePortId('output', type, index),
    mode: 'output',
    type,
    index,
    label,
    ...opts,
  };
}

/* ── Default port configurations per block type ──────── */

export type DefaultPorts = { inputs: NodePort[]; outputs: NodePort[] };

/**
 * Returns the default input/output ports for a given block type.
 *
 * Rules:
 * - All blocks get at least 1 main input + 1 main output.
 * - Integration blocks: 1 main input, 2 outputs (main + error).
 * - Condition / ab_test: 1 input, 2 outputs (true + false).
 * - Merge: 2 inputs, 1 output.
 * - Start event placeholder: 0 inputs, 1 output.
 * - AI blocks (open_ai, anthropic, etc.): 1 main input, 1 main output, optional AI tool input.
 */
export function getDefaultPorts(blockType: BlockType): DefaultPorts {
  switch (blockType) {
    /* ── Logic: branching ──────────────────────────── */
    case 'condition':
      return {
        inputs: [mkInput('main', 0)],
        outputs: [
          mkOutput('main', 0, 'True'),
          mkOutput('main', 1, 'False'),
        ],
      };

    case 'ab_test':
      return {
        inputs: [mkInput('main', 0)],
        outputs: [
          mkOutput('main', 0, 'Path A'),
          mkOutput('main', 1, 'Path B'),
        ],
      };

    /* ── Logic: merge (fan-in) ────────────────────── */
    case 'merge':
      return {
        inputs: [
          mkInput('main', 0, 'Input 1'),
          mkInput('main', 1, 'Input 2'),
        ],
        outputs: [mkOutput('main', 0)],
      };

    /* ── Integration blocks: main + error output ──── */
    case 'webhook':
    case 'send_email':
    case 'google_sheets':
    case 'google_analytics':
    case 'zapier':
    case 'make_com':
    case 'pabbly_connect':
    case 'chatwoot':
    case 'pixel':
    case 'segment':
    case 'cal_com':
    case 'nocodb':
    case 'forge_notion':
    case 'forge_airtable':
    case 'forge_slack':
    case 'forge_discord':
    case 'forge_github':
    case 'forge_twilio':
    case 'forge_sendgrid':
      return {
        inputs: [mkInput('main', 0)],
        outputs: [
          mkOutput('main', 0, 'Success'),
          mkOutput('main', 1, 'Error'),
        ],
      };

    /* ── AI blocks: main + optional AI tool port ──── */
    case 'open_ai':
    case 'anthropic':
    case 'together_ai':
    case 'mistral':
    case 'elevenlabs':
      return {
        inputs: [
          mkInput('main', 0),
          mkInput('ai', 1, 'Tools', { required: false }),
        ],
        outputs: [mkOutput('main', 0)],
      };

    /* ── Logic: jump / redirect — terminal blocks ─── */
    case 'jump':
    case 'redirect':
      return {
        inputs: [mkInput('main', 0)],
        outputs: [],
      };

    /* ── Default: 1 in, 1 out ─────────────────────── */
    default:
      return {
        inputs: [mkInput('main', 0)],
        outputs: [mkOutput('main', 0)],
      };
  }
}

/**
 * Default source handle ID — used for backward compatibility when an edge
 * has no `sourceHandle` field.
 */
export const DEFAULT_SOURCE_HANDLE = 'outputs/main/0';

/**
 * Default target handle ID — used for backward compatibility when an edge
 * has no `targetHandle` field.
 */
export const DEFAULT_TARGET_HANDLE = 'inputs/main/0';
