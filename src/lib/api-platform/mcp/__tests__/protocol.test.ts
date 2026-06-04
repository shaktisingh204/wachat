/**
 * Pure unit tests for the MCP wire-format primitives in `../protocol.ts`.
 * No network, no `server-only`, no `@/` aliases — runs standalone.
 *
 * Run with:
 *   npx tsx --test src/lib/api-platform/mcp/__tests__/protocol.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  LATEST_PROTOCOL_VERSION,
  RpcErrorCode,
  isJsonRpcRequest,
  isNotification,
  negotiateProtocolVersion,
  rpcError,
  rpcSuccess,
  toolError,
  toolJson,
  type JsonRpcRequest,
} from '../protocol';

test('negotiateProtocolVersion echoes a supported version', () => {
  assert.equal(negotiateProtocolVersion('2025-03-26'), '2025-03-26');
  assert.equal(negotiateProtocolVersion('2024-11-05'), '2024-11-05');
});

test('negotiateProtocolVersion falls back to latest for unknown/garbage', () => {
  assert.equal(negotiateProtocolVersion('1999-01-01'), LATEST_PROTOCOL_VERSION);
  assert.equal(negotiateProtocolVersion(undefined), LATEST_PROTOCOL_VERSION);
  assert.equal(negotiateProtocolVersion(42), LATEST_PROTOCOL_VERSION);
});

test('isNotification distinguishes requests from notifications', () => {
  assert.equal(isNotification({ jsonrpc: '2.0', method: 'notifications/initialized' } as JsonRpcRequest), true);
  assert.equal(isNotification({ jsonrpc: '2.0', method: 'ping', id: 1 } as JsonRpcRequest), false);
  // id: 0 is a valid request id, not a notification.
  assert.equal(isNotification({ jsonrpc: '2.0', method: 'ping', id: 0 } as JsonRpcRequest), false);
  // explicit undefined id is treated as a notification.
  assert.equal(isNotification({ jsonrpc: '2.0', method: 'ping', id: undefined } as JsonRpcRequest), true);
});

test('isJsonRpcRequest validates the envelope', () => {
  assert.equal(isJsonRpcRequest({ jsonrpc: '2.0', method: 'ping' }), true);
  assert.equal(isJsonRpcRequest({ jsonrpc: '1.0', method: 'ping' }), false);
  assert.equal(isJsonRpcRequest({ method: 'ping' }), false);
  assert.equal(isJsonRpcRequest({ jsonrpc: '2.0' }), false);
  assert.equal(isJsonRpcRequest(null), false);
  assert.equal(isJsonRpcRequest('ping'), false);
});

test('rpcSuccess / rpcError build well-formed responses', () => {
  assert.deepEqual(rpcSuccess(7, { ok: true }), { jsonrpc: '2.0', id: 7, result: { ok: true } });

  const err = rpcError(7, RpcErrorCode.MethodNotFound, 'nope');
  assert.deepEqual(err, { jsonrpc: '2.0', id: 7, error: { code: -32601, message: 'nope' } });

  const errWithData = rpcError(null, RpcErrorCode.InvalidParams, 'bad', { field: 'x' });
  assert.deepEqual(errWithData.error.data, { field: 'x' });
});

test('toolJson produces text content plus a structured mirror', () => {
  const res = toolJson([{ id: '1' }]);
  assert.equal(res.isError, undefined);
  assert.equal(res.content[0].type, 'text');
  assert.deepEqual(JSON.parse(res.content[0].text), [{ id: '1' }]);
  assert.deepEqual(res.structuredContent, { data: [{ id: '1' }] });
});

test('toolError flags isError and carries the message in-band', () => {
  const res = toolError('boom');
  assert.equal(res.isError, true);
  assert.equal(res.content[0].text, 'boom');
});
