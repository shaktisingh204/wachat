/**
 * state-vector.test.ts — Vitest unit tests for state-vector helpers.
 *
 * Run via `vitest run services/sabflow-ws/src/sync/state-vector.test.ts`
 * once the sabflow-ws package wires vitest in. The tests are written against
 * Vitest's globals API (`describe`, `it`, `expect`) so they remain framework-
 * portable to Jest if we change harnesses.
 */

import { describe, expect, it } from "vitest";
import {
  computeMissingClock,
  decodeStateVector,
  encodeStateVector,
  isStateVectorBehind,
  mergeStateVectors,
  type StateVector,
} from "./state-vector.js";

describe("encodeStateVector / decodeStateVector", () => {
  it("round-trips a non-trivial state vector byte-identically", () => {
    const sv: StateVector = new Map([
      [1, 5],
      [42, 0],
      [200, 1_000_000],
      [9999, 17],
    ]);
    const encoded = encodeStateVector(sv);
    const decoded = decodeStateVector(encoded);
    expect(decoded.size).toBe(sv.size);
    for (const [k, v] of sv) expect(decoded.get(k)).toBe(v);
    // Re-encoding produces byte-identical output (determinism guarantee).
    const reEncoded = encodeStateVector(decoded);
    expect(Array.from(reEncoded)).toEqual(Array.from(encoded));
  });

  it("encodes deterministically regardless of map insertion order", () => {
    const a: StateVector = new Map([
      [3, 10],
      [1, 20],
      [2, 30],
    ]);
    const b: StateVector = new Map([
      [2, 30],
      [3, 10],
      [1, 20],
    ]);
    expect(Array.from(encodeStateVector(a))).toEqual(
      Array.from(encodeStateVector(b)),
    );
  });

  it("encodes the empty SV as a single zero byte and decodes it back", () => {
    const empty: StateVector = new Map();
    const bytes = encodeStateVector(empty);
    expect(bytes.length).toBe(1);
    expect(bytes[0]).toBe(0);
    expect(decodeStateVector(bytes).size).toBe(0);
  });

  it("handles varint boundary values (127, 128, 16383, 16384)", () => {
    const sv: StateVector = new Map([
      [127, 128],
      [16_383, 16_384],
      [2_097_151, 2_097_152],
    ]);
    const decoded = decodeStateVector(encodeStateVector(sv));
    for (const [k, v] of sv) expect(decoded.get(k)).toBe(v);
  });

  it("rejects truncated buffers", () => {
    const sv: StateVector = new Map([[1, 1_000_000]]);
    const encoded = encodeStateVector(sv);
    const truncated = encoded.slice(0, encoded.length - 1);
    expect(() => decodeStateVector(truncated)).toThrow();
  });
});

describe("mergeStateVectors", () => {
  it("takes the element-wise max and preserves disjoint keys", () => {
    const a: StateVector = new Map([
      [1, 10],
      [2, 5],
      [3, 7],
    ]);
    const b: StateVector = new Map([
      [2, 9],
      [3, 1],
      [4, 100],
    ]);
    const merged = mergeStateVectors(a, b);
    expect(merged.get(1)).toBe(10);
    expect(merged.get(2)).toBe(9);
    expect(merged.get(3)).toBe(7);
    expect(merged.get(4)).toBe(100);
    expect(merged.size).toBe(4);
  });

  it("does not mutate either input", () => {
    const a: StateVector = new Map([[1, 1]]);
    const b: StateVector = new Map([[1, 2]]);
    mergeStateVectors(a, b);
    expect(a.get(1)).toBe(1);
    expect(b.get(1)).toBe(2);
  });
});

describe("isStateVectorBehind", () => {
  it("returns true when remote knows about a higher clock for any clientId", () => {
    const local: StateVector = new Map([
      [1, 5],
      [2, 10],
    ]);
    const remote: StateVector = new Map([
      [1, 5],
      [2, 11],
    ]);
    expect(isStateVectorBehind(local, remote)).toBe(true);
  });

  it("returns true when remote knows about a clientId local does not", () => {
    const local: StateVector = new Map([[1, 5]]);
    const remote: StateVector = new Map([
      [1, 5],
      [99, 1],
    ]);
    expect(isStateVectorBehind(local, remote)).toBe(true);
  });

  it("returns false when local is equal to or ahead of remote everywhere", () => {
    const local: StateVector = new Map([
      [1, 5],
      [2, 10],
      [3, 7],
    ]);
    const remote: StateVector = new Map([
      [1, 5],
      [2, 9],
    ]);
    expect(isStateVectorBehind(local, remote)).toBe(false);
  });
});

describe("computeMissingClock", () => {
  it("returns ranges remote is missing, sorted by clientId", () => {
    const local: StateVector = new Map([
      [3, 30],
      [1, 10],
      [2, 5],
    ]);
    const remote: StateVector = new Map([
      [1, 4],
      [2, 5],
      // clientId 3 absent on remote
    ]);
    const missing = computeMissingClock(local, remote);
    expect(missing).toEqual([
      { clientId: 1, from: 4, to: 10 },
      { clientId: 3, from: 0, to: 30 },
    ]);
  });

  it("returns an empty array when remote is fully caught up", () => {
    const local: StateVector = new Map([
      [1, 10],
      [2, 20],
    ]);
    const remote: StateVector = new Map([
      [1, 10],
      [2, 20],
      [3, 5], // remote-only clientId is irrelevant here
    ]);
    expect(computeMissingClock(local, remote)).toEqual([]);
  });
});
