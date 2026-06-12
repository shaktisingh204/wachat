/**
 * Unit tests for the work-queue slice of the RecordSurface adapter
 * (`src/app/sabcrm/[objectSlug]/record-surface-adapter.ts`):
 *
 *   - `queueConfigFromWire` — defensive parse of the additive `queue` key on
 *     a Rust saved-view document (the `columnWidths` precedent);
 *   - `queueConfigToWire` — the reverse mapping (round-trip);
 *   - the URL view-state codec accepting `vt=queue`.
 *
 * Runs with Node's built-in `node:test` + `tsx` so no extra deps are needed:
 *   npx tsx --test src/lib/sabcrm/__tests__/record-surface-adapter-queue.test.ts
 *
 * The adapter module is deliberately React/CSS/server-only-free; all of its
 * composite/wire type imports are type-only (erased at runtime).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  queueConfigFromWire,
  queueConfigToWire,
  parseUrlViewState,
  applyUrlViewState,
  type QueueViewConfig,
} from '../../../app/sabcrm/[objectSlug]/record-surface-adapter';
import type { SabcrmRustView } from '../../rust-client/sabcrm-views';

/** Minimal wire view with an arbitrary additive `queue` payload. */
function viewWith(queue: unknown): SabcrmRustView {
  return {
    id: 'v1',
    projectId: 'p1',
    object: 'deals',
    name: 'Hot deals',
    createdAt: '2026-06-12T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
    ...(queue === undefined ? {} : { queue }),
  } as SabcrmRustView;
}

describe('queueConfigFromWire', () => {
  it('parses a full, well-formed config', () => {
    const cfg = queueConfigFromWire(
      viewWith({
        enabled: true,
        doneWhen: { field: 'status', op: 'eq', value: 'done' },
        slaField: 'dueDate',
        snoozeMinutes: 1440,
      }),
    );
    assert.deepEqual(cfg, {
      doneWhen: { fieldKey: 'status', op: 'eq', value: 'done' },
      slaFieldKey: 'dueDate',
      snoozeMinutes: 1440,
    });
  });

  it('returns null when the key is absent or not an object', () => {
    assert.equal(queueConfigFromWire(viewWith(undefined)), null);
    assert.equal(queueConfigFromWire(viewWith(null)), null);
    assert.equal(queueConfigFromWire(viewWith('queue')), null);
    assert.equal(queueConfigFromWire(viewWith([1, 2])), null);
  });

  it('drops a doneWhen with no field, keeps the rest', () => {
    const cfg = queueConfigFromWire(
      viewWith({ doneWhen: { op: 'eq', value: 'x' }, slaField: 'dueDate' }),
    );
    assert.deepEqual(cfg, { slaFieldKey: 'dueDate' });
  });

  it('normalises doneWhen operators (neq → ne, unknown → eq)', () => {
    const neq = queueConfigFromWire(
      viewWith({ doneWhen: { field: 'stage', op: 'neq', value: 'open' } }),
    );
    assert.equal(neq?.doneWhen?.op, 'ne');

    const unknown = queueConfigFromWire(
      viewWith({ doneWhen: { field: 'stage', op: 'matches', value: 'won' } }),
    );
    assert.equal(unknown?.doneWhen?.op, 'eq');
  });

  it('omits the value for unary doneWhen operators', () => {
    const cfg = queueConfigFromWire(
      viewWith({ doneWhen: { field: 'closedAt', op: 'isNotEmpty' } }),
    );
    assert.deepEqual(cfg?.doneWhen, { fieldKey: 'closedAt', op: 'isNotEmpty' });
    assert.equal('value' in (cfg?.doneWhen ?? {}), false);
  });

  it('stringifies non-string doneWhen values', () => {
    const cfg = queueConfigFromWire(
      viewWith({ doneWhen: { field: 'score', op: 'gte', value: 90 } }),
    );
    assert.deepEqual(cfg?.doneWhen, { fieldKey: 'score', op: 'gte', value: '90' });
  });

  it('ignores malformed slaField / snoozeMinutes entries', () => {
    const cfg = queueConfigFromWire(
      viewWith({ slaField: '   ', snoozeMinutes: 'soon' }),
    );
    assert.deepEqual(cfg, {});

    const negative = queueConfigFromWire(viewWith({ snoozeMinutes: -5 }));
    assert.deepEqual(negative, {});

    const fractional = queueConfigFromWire(viewWith({ snoozeMinutes: 90.4 }));
    assert.equal(fractional?.snoozeMinutes, 90);
  });
});

describe('queueConfigToWire ⇄ queueConfigFromWire round-trip', () => {
  it('round-trips a binary-op config', () => {
    const cfg: QueueViewConfig = {
      doneWhen: { fieldKey: 'status', op: 'eq', value: 'done' },
      slaFieldKey: 'dueDate',
      snoozeMinutes: 4320,
    };
    const wire = queueConfigToWire(cfg);
    assert.equal(wire.enabled, true);
    assert.deepEqual(wire.doneWhen, { field: 'status', op: 'eq', value: 'done' });
    assert.equal(wire.slaField, 'dueDate');
    assert.equal(wire.snoozeMinutes, 4320);

    assert.deepEqual(queueConfigFromWire(viewWith(wire)), cfg);
  });

  it('round-trips a unary-op config without a value key', () => {
    const cfg: QueueViewConfig = {
      doneWhen: { fieldKey: 'closedAt', op: 'isNotEmpty' },
      snoozeMinutes: 60,
    };
    const wire = queueConfigToWire(cfg);
    assert.equal('value' in (wire.doneWhen as Record<string, unknown>), false);
    assert.deepEqual(queueConfigFromWire(viewWith(wire)), cfg);
  });

  it('omits absent keys instead of writing empty ones', () => {
    const wire = queueConfigToWire({ snoozeMinutes: 1440 });
    assert.deepEqual(wire, { enabled: true, snoozeMinutes: 1440 });
  });
});

describe('URL view-state codec — vt=queue', () => {
  it('parses vt=queue (and still rejects unknown types)', () => {
    assert.equal(parseUrlViewState('?vt=queue').viewType, 'queue');
    assert.equal(parseUrlViewState('?vt=calendar').viewType, undefined);
  });

  it('writes and round-trips vt=queue, preserving foreign params', () => {
    const search = applyUrlViewState('?foo=bar', {
      viewId: 'v1',
      viewType: 'queue',
      page: 2,
    });
    const sp = new URLSearchParams(search);
    assert.equal(sp.get('vt'), 'queue');
    assert.equal(sp.get('view'), 'v1');
    assert.equal(sp.get('page'), '2');
    assert.equal(sp.get('foo'), 'bar');

    const parsed = parseUrlViewState(search);
    assert.equal(parsed.viewType, 'queue');
    assert.equal(parsed.viewId, 'v1');
    assert.equal(parsed.page, 2);
  });

  it('clears vt when switching back to table', () => {
    const search = applyUrlViewState('?vt=queue&view=v1', {
      viewId: 'v1',
      viewType: 'table',
    });
    const sp = new URLSearchParams(search);
    assert.equal(sp.get('vt'), null);
  });
});
