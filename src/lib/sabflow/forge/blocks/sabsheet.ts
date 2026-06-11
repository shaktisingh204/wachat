/**
 * Forge block: SabSheet.
 *
 * In-app integration (no external credential): SabSheet is a first-party
 * SabNode module, so this block routes through the Rust BFF acting as the
 * workspace owner (`ctx.userId`) — the same pattern the SabFiles forge blocks
 * use. No SabFlow Connection / API key is needed.
 *
 * Actions:
 *   • append_row  — append a row of cell values to a sheet (via `/v1/sabsheet/ops`).
 *   • read_range  — read a rectangular cell range back out (via `/v1/sabsheet/cells`).
 *   • update_cell — set a single cell's value or formula (via `/v1/sabsheet/ops`).
 */

import { registerForgeBlock } from '../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../types';
import { cmd, type Command } from '@/lib/sabsheet/commands/ops';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Parse a `values` field (JSON object/array, expression result, or CSV-ish). */
function parseValues(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => str(v));
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).map((v) => str(v));
  }
  const s = str(raw).trim();
  if (!s) return [];
  if (s.startsWith('[') || s.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => str(v));
      if (parsed && typeof parsed === 'object') {
        return Object.values(parsed as Record<string, unknown>).map((v) => str(v));
      }
    } catch {
      /* fall through to CSV */
    }
  }
  return s.split(',').map((v) => v.trim());
}

/** Mint a Rust JWT for the workspace owner and call the BFF. */
async function rustAs<T>(
  ctx: ForgeActionContext,
  path: string,
  init: RequestInit = { method: 'GET' },
): Promise<T> {
  if (!ctx.userId) {
    throw new Error('SabSheet: ctx.userId missing — cannot mint Rust JWT.');
  }
  const { rustFetchAs } = await import('@/lib/rust-client/fetcher');
  return rustFetchAs<T>(ctx.userId, path, init);
}

async function appendRow(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workbookId = str(ctx.options.workbookId);
  const sheetIndex = num(ctx.options.sheetId);
  const startRow = num(ctx.options.startRow, 1);
  const startCol = num(ctx.options.startCol, 1);
  const values = parseValues(ctx.options.values);
  const outputVariable = str(ctx.options.outputVariable);

  if (!workbookId) throw new Error('SabSheet append_row: workbookId is required');
  if (values.length === 0) throw new Error('SabSheet append_row: values is required');

  const commands: Command[] = values.map((value, i) =>
    cmd.setCell(sheetIndex, startRow, startCol + i, value),
  );

  const res = await rustAs<{ seq: number; rejected?: boolean }>(
    ctx,
    '/v1/sabsheet/ops',
    {
      method: 'POST',
      body: JSON.stringify({ workbookId, commands, origin: 'connection' }),
    },
  );

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = res;
  return {
    outputs,
    logs: [`SabSheet: appended ${values.length} cell(s) to row ${startRow} of ${workbookId}`],
  };
}

async function readRange(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sheetId = str(ctx.options.sheet);
  const minRow = num(ctx.options.minRow, 1);
  const maxRow = num(ctx.options.maxRow, minRow);
  const minCol = num(ctx.options.minCol, 1);
  const maxCol = num(ctx.options.maxCol, minCol);
  const outputVariable = str(ctx.options.outputVariable);

  if (!sheetId) throw new Error('SabSheet read_range: sheet is required');

  const sp = new URLSearchParams();
  sp.set('sheetId', sheetId);
  sp.set('minRow', String(minRow));
  sp.set('maxRow', String(maxRow));
  sp.set('minCol', String(minCol));
  sp.set('maxCol', String(maxCol));

  const res = await rustAs<{ cells?: unknown[] }>(
    ctx,
    `/v1/sabsheet/cells?${sp.toString()}`,
  );
  const cells = Array.isArray(res.cells) ? res.cells : [];

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = cells;
  return {
    outputs,
    logs: [`SabSheet: read ${cells.length} cell(s) from sheet ${sheetId}`],
  };
}

async function updateCell(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workbookId = str(ctx.options.workbookId);
  const sheetIndex = num(ctx.options.sheetId);
  const row = num(ctx.options.row, 1);
  const col = num(ctx.options.col, 1);
  const value = str(ctx.options.value);

  if (!workbookId) throw new Error('SabSheet update_cell: workbookId is required');

  const commands: Command[] = [cmd.setCell(sheetIndex, row, col, value)];
  const res = await rustAs<{ seq: number }>(ctx, '/v1/sabsheet/ops', {
    method: 'POST',
    body: JSON.stringify({ workbookId, commands, origin: 'connection' }),
  });

  return {
    outputs: { seq: res.seq },
    logs: [`SabSheet: set cell (${row},${col}) on sheet ${sheetIndex} of ${workbookId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_sabsheet',
  name: 'SabSheet',
  description: 'Append rows, read ranges, and update cells in a SabSheet workbook.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'append_row',
      label: 'Append Row',
      description: 'Write a row of values into a sheet starting at a cell.',
      fields: [
        {
          id: 'workbookId',
          label: 'Workbook ID',
          type: 'text',
          placeholder: '6650…',
          required: true,
        },
        {
          id: 'sheetId',
          label: 'Sheet Index',
          type: 'number',
          defaultValue: 0,
          helperText: '0-based sheet index within the workbook.',
        },
        {
          id: 'startRow',
          label: 'Row',
          type: 'number',
          defaultValue: 1,
          helperText: '1-based row to write the values into.',
        },
        {
          id: 'startCol',
          label: 'Start Column',
          type: 'number',
          defaultValue: 1,
          helperText: '1-based column the first value lands in.',
        },
        {
          id: 'values',
          label: 'Values',
          type: 'json',
          placeholder: '["{{name}}", "{{email}}", 42]',
          required: true,
          helperText: 'JSON array (or object) of cell values, left-to-right.',
        },
        { id: 'outputVariable', label: 'Save response to variable', type: 'variable' },
      ],
      run: appendRow,
    },
    {
      id: 'read_range',
      label: 'Read Range',
      description: 'Read a rectangular block of cells from a sheet.',
      fields: [
        { id: 'sheet', label: 'Sheet ID', type: 'text', required: true, placeholder: '6650…' },
        { id: 'minRow', label: 'From Row', type: 'number', defaultValue: 1 },
        { id: 'maxRow', label: 'To Row', type: 'number', defaultValue: 1 },
        { id: 'minCol', label: 'From Column', type: 'number', defaultValue: 1 },
        { id: 'maxCol', label: 'To Column', type: 'number', defaultValue: 1 },
        { id: 'outputVariable', label: 'Save cells to variable', type: 'variable', required: true },
      ],
      run: readRange,
    },
    {
      id: 'update_cell',
      label: 'Update Cell',
      description: 'Set a single cell to a value or formula (prefix formulas with =).',
      fields: [
        { id: 'workbookId', label: 'Workbook ID', type: 'text', required: true },
        { id: 'sheetId', label: 'Sheet Index', type: 'number', defaultValue: 0 },
        { id: 'row', label: 'Row', type: 'number', defaultValue: 1 },
        { id: 'col', label: 'Column', type: 'number', defaultValue: 1 },
        {
          id: 'value',
          label: 'Value',
          type: 'text',
          placeholder: 'Hello  — or  =SUM(A1:A10)',
          required: true,
        },
      ],
      run: updateCell,
    },
  ],
};

registerForgeBlock(block);

export default block;
