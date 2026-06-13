/**
 * V2.13 — OpenAPI spec shape tests.
 *
 *   npx tsx --test src/lib/sabsms/__tests__/openapi-spec.test.ts
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { SABSMS_API_SCOPES } from '../apikeys/core';
import {
  buildSabsmsOpenApiSpec,
  sabsmsDocEndpoints,
  SABSMS_API_BASE_PATH,
} from '../apikeys/openapi';

const EXPECTED_OPERATIONS: Array<[path: string, method: string, scope: string | null]> = [
  ['/messages', 'post', 'messages:send'],
  ['/messages', 'get', 'messages:read'],
  ['/messages/{id}', 'get', 'messages:read'],
  ['/verify/send', 'post', 'otp'],
  ['/verify/check', 'post', 'otp'],
  ['/suppressions', 'get', 'messages:read'],
  ['/suppressions', 'post', 'messages:send'],
  ['/suppressions/{phone}', 'delete', 'messages:send'],
  ['/analytics/summary', 'get', 'analytics:read'],
];

describe('buildSabsmsOpenApiSpec', () => {
  const spec = buildSabsmsOpenApiSpec();

  it('is OpenAPI 3.1 with the /api/v1/sms server', () => {
    assert.equal(spec.openapi, '3.1.0');
    assert.equal(spec.servers[0].url, SABSMS_API_BASE_PATH);
    assert.ok(spec.info.title.includes('SabSMS'));
  });

  it('declares every expected operation with its scope', () => {
    for (const [path, method, scope] of EXPECTED_OPERATIONS) {
      const pathItem = spec.paths[path] as Record<string, { 'x-scopes': string[] }> | undefined;
      assert.ok(pathItem, `missing path ${path}`);
      const op = pathItem[method];
      assert.ok(op, `missing ${method.toUpperCase()} ${path}`);
      if (scope) {
        assert.deepEqual(op['x-scopes'], [scope], `${method.toUpperCase()} ${path} scope`);
      }
    }
  });

  it('every operation has a summary, tags, and at least one response', () => {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        assert.ok(op.summary, `${method} ${path} has no summary`);
        assert.ok(op.tags.length > 0, `${method} ${path} has no tags`);
        assert.ok(Object.keys(op.responses).length > 0, `${method} ${path} has no responses`);
        for (const scope of op['x-scopes']) {
          assert.ok(
            (SABSMS_API_SCOPES as readonly string[]).includes(scope),
            `${method} ${path} references unknown scope ${scope}`,
          );
        }
      }
    }
  });

  it('declares the bearer security scheme and shared schemas', () => {
    assert.ok(spec.components.securitySchemes.apiKey);
    assert.ok(spec.components.schemas.Error);
    assert.ok(spec.components.schemas.Message);
  });
});

describe('sabsmsDocEndpoints', () => {
  const endpoints = sabsmsDocEndpoints();

  it('derives one doc endpoint per spec operation', () => {
    assert.equal(endpoints.length, EXPECTED_OPERATIONS.length);
  });

  it('every endpoint carries cURL/Node/Python snippets with the sk_live_ placeholder', () => {
    for (const ep of endpoints) {
      for (const lang of ['cURL', 'Node.js', 'Python']) {
        assert.ok(ep.codeExamples[lang], `${ep.id} missing ${lang} snippet`);
      }
      assert.ok(
        ep.codeExamples.cURL.includes('sk_live_'),
        `${ep.id} curl example must show the sk_live_ placeholder`,
      );
      assert.ok(ep.scopes.length > 0, `${ep.id} has no scopes`);
    }
  });

  it('send-message documents SabFiles-only media (no raw URLs)', () => {
    const send = endpoints.find((e) => e.id === 'sendMessage');
    assert.ok(send);
    const mediaParam = send.parameters.find((p) => p.name === 'mediaSabFileIds');
    assert.ok(mediaParam, 'sendMessage must document mediaSabFileIds');
    assert.ok(!send.parameters.some((p) => p.name === 'mediaUrls'));
  });
});
