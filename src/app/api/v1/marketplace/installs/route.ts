/**
 * /api/v1/marketplace/installs — Marketplace install management.
 *
 *   GET  /api/v1/marketplace/installs
 *     → { data: Install[] }
 *
 *   POST /api/v1/marketplace/installs
 *     Body: { app_id: string, granted_scopes?: string[], config?: object }
 *     → 201 Install
 *
 * Auth: API key.  Required scopes:
 *   GET  → me:read
 *   POST → *  (install/uninstall is privileged — gated behind wildcard
 *              until a `marketplace:write` scope is added)
 *
 * POST is idempotent at the storage layer (`installApp` upserts), but we
 * still honour `Idempotency-Key` so retried requests get the same response
 * body and don't re-fire the developer install_callback_url.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import {
  ApiError,
  withApiV1,
  withIdempotency,
} from '@/lib/api-platform';
import { installApp, listInstallsForTenant } from '@/lib/marketplace/install';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── GET ────────────────────────────────────────────────────────────────── */

export const GET = withApiV1(
  async (_req: NextRequest, { ctx, requestId }) => {
    const installs = await listInstallsForTenant(ctx.tenantId);
    return NextResponse.json(
      {
        data: installs.map((i) => ({
          id: i._id,
          tenant_id: i.tenantId,
          app_id: i.appId,
          version: i.version,
          granted_scopes: i.grantedScopes,
          status: i.status,
          config: i.config,
          usage_units: i.usageUnits,
          installed_at:
            i.installedAt instanceof Date
              ? i.installedAt.toISOString()
              : i.installedAt,
          updated_at:
            i.updatedAt instanceof Date ? i.updatedAt.toISOString() : i.updatedAt,
        })),
      },
      { headers: { 'x-request-id': requestId } },
    );
  },
  { scope: 'me:read' },
);

/* ── POST ───────────────────────────────────────────────────────────────── */

interface InstallBody {
  app_id?: unknown;
  granted_scopes?: unknown;
  config?: unknown;
  idempotency_key?: unknown;
}

function parseBody(raw: unknown): {
  appId: string;
  grantedScopes?: string[];
  config?: Record<string, unknown>;
  idempotencyKey?: string;
} {
  if (!raw || typeof raw !== 'object') {
    throw ApiError.validationFailed([{ path: 'body', message: 'Body must be a JSON object' }]);
  }
  const b = raw as InstallBody;
  const errors: Array<{ path: string; message: string }> = [];
  if (typeof b.app_id !== 'string' || b.app_id.trim().length === 0) {
    errors.push({ path: 'app_id', message: 'Required non-empty string' });
  }
  let grantedScopes: string[] | undefined;
  if (b.granted_scopes !== undefined) {
    if (!Array.isArray(b.granted_scopes)) {
      errors.push({ path: 'granted_scopes', message: 'Must be an array of strings' });
    } else {
      grantedScopes = b.granted_scopes.filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
      );
    }
  }
  let config: Record<string, unknown> | undefined;
  if (b.config !== undefined) {
    if (!b.config || typeof b.config !== 'object') {
      errors.push({ path: 'config', message: 'Must be an object' });
    } else {
      config = b.config as Record<string, unknown>;
    }
  }
  if (errors.length) throw ApiError.validationFailed(errors);
  return {
    appId: (b.app_id as string).trim(),
    grantedScopes,
    config,
    idempotencyKey: typeof b.idempotency_key === 'string' ? b.idempotency_key : undefined,
  };
}

export const POST = withApiV1(
  async (req: NextRequest, { ctx, requestId }) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON' }]);
    }
    const parsed = parseBody(raw);
    const idempotencyKey =
      req.headers.get('idempotency-key') ?? parsed.idempotencyKey ?? null;

    const out = await withIdempotency(ctx.tenantId, idempotencyKey, raw, async () => {
      try {
        const install = await installApp(ctx.tenantId, parsed.appId, {
          grantedScopes: parsed.grantedScopes,
          config: parsed.config,
        });
        return {
          status: 201,
          body: {
            id: install._id,
            tenant_id: install.tenantId,
            app_id: install.appId,
            version: install.version,
            granted_scopes: install.grantedScopes,
            status: install.status,
            config: install.config,
            usage_units: install.usageUnits,
            installed_at:
              install.installedAt instanceof Date
                ? install.installedAt.toISOString()
                : install.installedAt,
            updated_at:
              install.updatedAt instanceof Date
                ? install.updatedAt.toISOString()
                : install.updatedAt,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // `installApp` throws plain Error('App not found: ...') / 'not available'.
        if (/not found/i.test(msg)) throw ApiError.notFound(msg);
        if (/not available/i.test(msg)) {
          throw ApiError.validationFailed([{ path: 'app_id', message: msg }]);
        }
        throw ApiError.serverError(msg, err);
      }
    });

    return new NextResponse(out.body, {
      status: out.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-request-id': requestId,
        ...out.headers,
      },
    });
  },
  { scope: '*' },
);
