/**
 * Unit tests for the visible-columns slice of the RecordSurface adapter
 * (`src/app/sabcrm/[objectSlug]/record-surface-adapter.ts`):
 *
 *   - `visibleColumnsFromWire` — reads the TYPED saved-view `viewFields`
 *     channel (`{ fieldKey, position, isVisible, size? }`), filtering
 *     `isVisible === false`, sorting by `position`, and degrading to `null`
 *     for absent/empty/unusable payloads;
 *   - `savedViewToWireInput` — the write side emits canonical `viewFields`
 *     entries in EXACTLY the `{ fieldKey, position, isVisible, size? }`
 *     shape (risk note: the Rust deserializer may reject malformed entries);
 *   - the round-trip: wire → keys → wire is stable.
 *
 * Runs with Node's built-in `node:test` + `tsx` so no extra deps are needed:
 *   npx tsx --test src/lib/sabcrm/__tests__/record-surface-adapter-columns.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  visibleColumnsFromWire,
  savedViewFromWire,
  savedViewToWireInput,
  type ViewStateSnapshot,
} from '../../../app/sabcrm/[objectSlug]/record-surface-adapter';
import type { SabcrmRustView } from '../../rust-client/sabcrm-views';

/** Minimal wire view with an arbitrary `viewFields` payload. */
function viewWith(viewFields: unknown): SabcrmRustView {
  return {
    id: 'v1',
    projectId: 'p1',
    object: 'deals',
    name: 'Hot deals',
    createdAt: '2026-06-12T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
    ...(viewFields === undefined ? {} : { viewFields }),
  } as SabcrmRustView;
}

/** A baseline snapshot for the write-side tests. */
function snap(partial: Partial<ViewStateSnapshot>): ViewStateSnapshot {
  return {
    viewType: 'table',
    filters: { op: 'and', conditions: [] },
    sorts: [],
    groupBy: null,
    ...partial,
  };
}

describe('visibleColumnsFromWire', () => {
  it('returns null when viewFields is absent', () => {
    assert.equal(visibleColumnsFromWire(viewWith(undefined)), null);
  });

  it('returns null for an empty array', () => {
    assert.equal(visibleColumnsFromWire(viewWith([])), null);
  });

  it('returns null when no entry has a usable fieldKey', () => {
    assert.equal(
      visibleColumnsFromWire(
        viewWith([{ position: 0 }, { fieldKey: '', position: 1 }, null]),
      ),
      null,
    );
  });

  it('sorts unsorted positions and maps to fieldKey', () => {
    const cols = visibleColumnsFromWire(
      viewWith([
        { fieldKey: 'stage', position: 2, isVisible: true },
        { fieldKey: 'name', position: 0, isVisible: true },
        { fieldKey: 'amount', position: 1, isVisible: true },
      ]),
    );
    assert.deepEqual(cols, ['name', 'amount', 'stage']);
  });

  it('drops isVisible === false entries, keeps default-true ones', () => {
    const cols = visibleColumnsFromWire(
      viewWith([
        { fieldKey: 'hidden', position: 0, isVisible: false },
        { fieldKey: 'shown', position: 1 }, // isVisible defaults true
      ]),
    );
    assert.deepEqual(cols, ['shown']);
  });

  it('tolerates missing positions (treated as 0, stable for the rest)', () => {
    const cols = visibleColumnsFromWire(
      viewWith([
        { fieldKey: 'b', position: 1 },
        { fieldKey: 'a' }, // no position → 0
      ]),
    );
    assert.deepEqual(cols, ['a', 'b']);
  });

  it('surfaces on savedViewFromWire as visibleColumns', () => {
    const view = savedViewFromWire(
      viewWith([{ fieldKey: 'name', position: 0, isVisible: true }]),
    );
    assert.deepEqual(view.visibleColumns, ['name']);
    const none = savedViewFromWire(viewWith(undefined));
    assert.equal(none.visibleColumns, null);
  });
});

describe('viewFields write side (savedViewToWireInput)', () => {
  it('emits the EXACT { fieldKey, position, isVisible, size? } shape', () => {
    const input = savedViewToWireInput(
      'deals',
      'My view',
      snap({
        visibleColumns: ['name', 'amount'],
        columnWidths: { amount: 142.6 },
      }),
    ) as unknown as Record<string, unknown>;
    assert.deepEqual(input.viewFields, [
      { fieldKey: 'name', position: 0, isVisible: true },
      { fieldKey: 'amount', position: 1, isVisible: true, size: 143 },
    ]);
  });

  it('emits an empty array when visibleColumns is null (default columns)', () => {
    const input = savedViewToWireInput(
      'deals',
      'My view',
      snap({ visibleColumns: null }),
    ) as unknown as Record<string, unknown>;
    assert.deepEqual(input.viewFields, []);
  });

  it('keeps writing the legacy columnWidths map (back-compat)', () => {
    const input = savedViewToWireInput(
      'deals',
      'My view',
      snap({ visibleColumns: ['name'], columnWidths: { name: 200 } }),
    ) as unknown as Record<string, unknown>;
    assert.deepEqual(input.columnWidths, { name: 200 });
  });

  it('round-trips: wire → visibleColumns → wire is stable', () => {
    const original = viewWith([
      { fieldKey: 'stage', position: 2, isVisible: true },
      { fieldKey: 'name', position: 0, isVisible: true, size: 180 },
      { fieldKey: 'amount', position: 1, isVisible: true },
    ]);
    const cols = visibleColumnsFromWire(original);
    assert.deepEqual(cols, ['name', 'amount', 'stage']);
    const written = savedViewToWireInput(
      'deals',
      'rt',
      snap({ visibleColumns: cols, columnWidths: { name: 180 } }),
    ) as unknown as { viewFields: Array<Record<string, unknown>> };
    // Re-read what we wrote — the same ordered key list comes back.
    const reread = visibleColumnsFromWire(
      viewWith(written.viewFields),
    );
    assert.deepEqual(reread, ['name', 'amount', 'stage']);
    // And the entries are exactly the canonical shape.
    assert.deepEqual(written.viewFields[0], {
      fieldKey: 'name',
      position: 0,
      isVisible: true,
      size: 180,
    });
  });
});
