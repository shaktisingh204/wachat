/**
 * Corpus replay tests for the SabFlow executor expression engine.
 *
 *   npx tsx --test src/lib/sabflow/executor/expression/__tests__/corpus.test.ts
 *
 * For each entry in `corpus.json` we either:
 *   - assert deep-equality of the evaluated value (when `expectedValue` is set), or
 *   - assert the thrown error's class name + a message substring
 *     (when `expectedError` is set).
 *
 * The engine entrypoints are imported from `./fuzz.test.ts`, which forward-
 * declares them and provides a reference implementation faithful to the
 * documented grammar.  When the production sibling files (tokenize.ts,
 * parse.ts, evaluate.ts) land, they should be swapped in by updating the
 * shared declarations — corpus + fuzz are framework-only and stay stable.
 *
 * The corpus mirrors n8n's public expression test fixtures by shape — the
 * inputs are written fresh; no test strings copied verbatim from n8n.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ExpressionError,
  ParseError,
  TokenizeError,
  tokenize,
  parse,
  evaluate,
  type Scope,
} from './fuzz.test';

/* ── Corpus shape ────────────────────────────────────────────────────────── */

type CorpusEntry = {
  name: string;
  source: string;
  scope: Record<string, unknown>;
  expectedValue?: unknown;
  expectedError?: { class: string; messageSubstring: string };
};
type Corpus = { entries: CorpusEntry[] };

function loadCorpus(): Corpus {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, 'corpus.json'), 'utf8');
  return JSON.parse(raw) as Corpus;
}

/* ── Scope normaliser ────────────────────────────────────────────────────── */

/** Convert a corpus `scope` field into a runtime Scope.
 *  - `now` strings are parsed as ISO dates.
 *  - Missing fields fall through to engine defaults. */
function buildScope(raw: Record<string, unknown>): Scope {
  const out: Scope = {};
  if ('json' in raw) out.json = raw.json;
  if ('input' in raw) out.input = raw.input as Scope['input'];
  if ('node' in raw) out.node = raw.node as Scope['node'];
  if ('vars' in raw) out.vars = raw.vars as Scope['vars'];
  if ('env' in raw) out.env = raw.env as Scope['env'];
  if ('workflow' in raw) out.workflow = raw.workflow as Scope['workflow'];
  if ('execution' in raw) out.execution = raw.execution as Scope['execution'];
  if ('now' in raw) {
    const n = raw.now;
    out.now = typeof n === 'string' ? new Date(n) : (n as Date | undefined);
  }
  return out;
}

/* ── Normalise undefined → null for deep-compare with JSON `null` ────────── */

function normaliseValue(v: unknown): unknown {
  if (v === undefined) return null;
  return v;
}

/* ── The corpus test ─────────────────────────────────────────────────────── */

const corpus = loadCorpus();

assert.ok(corpus.entries.length >= 40, `corpus has ${corpus.entries.length} entries, need ≥ 40`);

for (const entry of corpus.entries) {
  test(`corpus: ${entry.name}`, () => {
    const scope = buildScope(entry.scope);

    let result: unknown;
    let thrown: unknown;
    try {
      const tokens = tokenize(entry.source);
      const ast = parse(tokens);
      result = evaluate(ast, scope);
    } catch (err) {
      thrown = err;
    }

    if (entry.expectedError !== undefined) {
      // Error path
      assert.ok(thrown !== undefined, `expected error '${entry.expectedError.class}' for '${entry.name}', got value ${JSON.stringify(result)}`);
      const errName =
        thrown instanceof TokenizeError ? 'TokenizeError' :
        thrown instanceof ParseError    ? 'ParseError' :
        thrown instanceof ExpressionError ? 'ExpressionError' :
        thrown instanceof Error ? thrown.name : 'unknown';
      assert.equal(
        errName,
        entry.expectedError.class,
        `error class mismatch for '${entry.name}': expected ${entry.expectedError.class}, got ${errName} (msg=${
          thrown instanceof Error ? thrown.message : String(thrown)
        })`,
      );
      if (entry.expectedError.messageSubstring) {
        const msg = thrown instanceof Error ? thrown.message : String(thrown);
        assert.ok(
          msg.includes(entry.expectedError.messageSubstring),
          `error message for '${entry.name}' missing substring '${entry.expectedError.messageSubstring}': ${msg}`,
        );
      }
      return;
    }

    // Value path
    if (thrown !== undefined) {
      assert.fail(
        `unexpected throw for '${entry.name}': ${
          thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown)
        }`,
      );
    }
    assert.deepStrictEqual(
      normaliseValue(result),
      normaliseValue(entry.expectedValue),
      `value mismatch for '${entry.name}'`,
    );
  });
}
