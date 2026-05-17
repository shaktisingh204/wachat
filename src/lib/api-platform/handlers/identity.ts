/**
 * Shared handler module for all identity endpoints under `/api/v1/me/*`,
 * `/api/v1/account`, `/api/v1/team/*`, `/api/v1/plans/*`, and
 * `/api/v1/rbac/*`.
 *
 * Every exported function is an `ApiV1Handler` — `withApiV1` wraps them in
 * the generated route files. Domain logic lives in Rust crates; these
 * handlers are thin shims that:
 *   1. Pull request data out of the body / params.
 *   2. Forward through `rustFetchAsUser` so the caller's tenancy + RBAC
 *      flow into the Rust handler via the issued JWT.
 *   3. Map Rust errors onto `ApiError` so the RFC 7807 envelope is
 *      consistent across the platform.
 *
 * No Mongo, no business logic. If you find yourself reaching for either,
 * push it down into the Rust crate.
 */

import 'server-only';

import { NextResponse } from 'next/server';

import type { ApiV1Handler } from '@/lib/api-platform';
import { ApiError } from '@/lib/api-platform';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
import { RustApiError } from '@/lib/rust-client';
import type {
  AdminApiKeyGenerateBody,
  AdminApiKeyGenerateResult,
  AdminApiKeyRevokeResult,
  AdminApiKeySummary,
} from '@/lib/rust-client/wachat-api-keys-admin';
import type {
  PatGenerateBody,
  PatGenerateResult,
  PatRevokeResult,
  PatSummary,
} from '@/lib/rust-client/developer-personal-tokens';

/* ── Helpers ────────────────────────────────────────────────────────────── */

function asString(v: unknown, max = 256): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  if (t.length > max) return t.slice(0, max);
  return t;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  return out.length ? out : undefined;
}

function mapRustError(err: unknown, fallback: string): never {
  if (err instanceof ApiError) throw err;
  if (err instanceof RustApiError) {
    throw new ApiError({
      type: err.status === 404 ? 'not_found' : 'server_error',
      status: err.status || 500,
      title: fallback,
      detail: err.message,
    });
  }
  throw ApiError.serverError(fallback, err);
}

/* ── API keys ────────────────────────────────────────────────────────────
 *
 * Delegates: Rust crate `wachat-api-keys-admin`, mounted at `/v1/api-keys`.
 * The Rust handler reads the JWT subject as `tenantId` so the routes are
 * implicitly tenant-scoped.
 * ────────────────────────────────────────────────────────────────────── */

export const listKeys: ApiV1Handler = async (_req, { ctx }) => {
  try {
    const data = await rustFetchAsUser<AdminApiKeySummary[]>(
      ctx.tenantId,
      '/v1/api-keys/',
      { method: 'GET' },
    );
    return NextResponse.json({ data });
  } catch (err) {
    mapRustError(err, 'Failed to list API keys');
  }
};

export const createKey: ApiV1Handler = async (req, { ctx }) => {
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON body' }]);
  }
  const name = asString(raw.name, 100);
  if (!name) {
    throw ApiError.validationFailed([{ path: 'name', message: 'name is required' }]);
  }
  const body: AdminApiKeyGenerateBody = {
    name,
    scopes: asStringArray(raw.scopes),
    tier: typeof raw.tier === 'string' ? (raw.tier as AdminApiKeyGenerateBody['tier']) : undefined,
  };
  try {
    const result = await rustFetchAsUser<AdminApiKeyGenerateResult>(
      ctx.tenantId,
      '/v1/api-keys/',
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (!result.success || !result.apiKey || !result.keyId) {
      throw ApiError.serverError(result.error || 'Key generation failed');
    }
    // Caller gets the plaintext exactly once.
    return NextResponse.json(
      {
        apiKey: result.apiKey,
        key: {
          id: result.keyId,
          name,
          prefix: result.apiKey.slice(0, 8),
          scopes: body.scopes ?? ['*'],
          tier: body.tier ?? 'FREE',
          env: 'live',
          createdAt: new Date().toISOString(),
          revoked: false,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    mapRustError(err, 'Failed to generate API key');
  }
};

export const revokeKey: ApiV1Handler = async (_req, { ctx, params }) => {
  const keyId = asString((params as { keyId?: string }).keyId);
  if (!keyId) throw ApiError.validationFailed([{ path: 'keyId', message: 'keyId is required' }]);
  try {
    const result = await rustFetchAsUser<AdminApiKeyRevokeResult>(
      ctx.tenantId,
      `/v1/api-keys/${encodeURIComponent(keyId)}/revoke`,
      { method: 'PATCH' },
    );
    if (!result.success) {
      throw ApiError.notFound(result.error || 'API key not found');
    }
    return NextResponse.json({ success: true, message: 'API key revoked.' });
  } catch (err) {
    mapRustError(err, 'Failed to revoke API key');
  }
};

/* ── Personal Access Tokens ──────────────────────────────────────────────
 *
 * Delegates: Rust crate `developer-personal-tokens`, mounted at
 * `/v1/personal-access-tokens`.
 * ────────────────────────────────────────────────────────────────────── */

export const listPats: ApiV1Handler = async (_req, { ctx }) => {
  try {
    const data = await rustFetchAsUser<PatSummary[]>(
      ctx.tenantId,
      '/v1/personal-access-tokens/',
      { method: 'GET' },
    );
    return NextResponse.json({ data });
  } catch (err) {
    mapRustError(err, 'Failed to list personal access tokens');
  }
};

export const createPat: ApiV1Handler = async (req, { ctx }) => {
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON body' }]);
  }
  const name = asString(raw.name, 100);
  if (!name) throw ApiError.validationFailed([{ path: 'name', message: 'name is required' }]);

  const body: PatGenerateBody = {
    name,
    scopes: asStringArray(raw.scopes),
    expiresAt: asString(raw.expiresAt),
  };
  try {
    const result = await rustFetchAsUser<PatGenerateResult>(
      ctx.tenantId,
      '/v1/personal-access-tokens/',
      { method: 'POST', body: JSON.stringify(body) },
    );
    if (!result.success || !result.token || !result.tokenId) {
      throw ApiError.serverError(result.error || 'PAT generation failed');
    }
    return NextResponse.json(
      {
        token: result.token,
        pat: {
          id: result.tokenId,
          name,
          userId: ctx.userId ?? ctx.tenantId,
          scopes: body.scopes ?? ['*'],
          tier: 'FREE',
          createdAt: new Date().toISOString(),
          revoked: false,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    mapRustError(err, 'Failed to generate PAT');
  }
};

export const revokePat: ApiV1Handler = async (_req, { ctx, params }) => {
  const tokenId = asString((params as { tokenId?: string }).tokenId);
  if (!tokenId) throw ApiError.validationFailed([{ path: 'tokenId', message: 'tokenId is required' }]);
  try {
    const result = await rustFetchAsUser<PatRevokeResult>(
      ctx.tenantId,
      `/v1/personal-access-tokens/${encodeURIComponent(tokenId)}/revoke`,
      { method: 'PATCH' },
    );
    if (!result.success) throw ApiError.notFound(result.error || 'PAT not found');
    return NextResponse.json({ success: true, message: 'PAT revoked.' });
  } catch (err) {
    mapRustError(err, 'Failed to revoke PAT');
  }
};

/* ── Account / team / plan / RBAC ────────────────────────────────────────
 *
 * Read-only shims over existing Rust crates:
 *   - `account`:  proxies the existing `users` crate `/v1/me` shape.
 *   - `team`:     uses `users` crate listing.
 *   - `plan`:     proxies the existing `users::session` joined plan view.
 *   - `rbac`:     proxies the existing `rbac` crate roles listing.
 *
 * Each handler tolerates a missing upstream by returning an empty page +
 * 200, rather than 500, so a developer can probe surface shape without
 * tripping on per-tenant data gaps. Pure 5xx remains a Rust-side problem.
 * ────────────────────────────────────────────────────────────────────── */

interface UsersMe {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  timezone?: string;
  createdAt?: string;
}

export const getAccount: ApiV1Handler = async (_req, { ctx }) => {
  try {
    const me = await rustFetchAsUser<UsersMe>(ctx.tenantId, '/v1/me', { method: 'GET' });
    return NextResponse.json({
      tenantId: ctx.tenantId,
      name: me.name,
      email: me.email,
      timezone: me.timezone,
      createdAt: me.createdAt,
    });
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) {
      return NextResponse.json({ tenantId: ctx.tenantId });
    }
    mapRustError(err, 'Failed to load account');
  }
};

interface TeamMemberRaw {
  userId?: string;
  _id?: string;
  email?: string;
  name?: string;
  role?: string;
  joinedAt?: string;
  createdAt?: string;
}

export const listTeamMembers: ApiV1Handler = async (_req, { ctx }) => {
  try {
    const rows = await rustFetchAsUser<TeamMemberRaw[]>(
      ctx.tenantId,
      '/v1/team/members',
      { method: 'GET' },
    );
    const data = (rows ?? []).map((r) => ({
      userId: r.userId ?? r._id ?? '',
      email: r.email ?? '',
      name: r.name,
      role: r.role,
      joinedAt: r.joinedAt ?? r.createdAt,
    }));
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) {
      return NextResponse.json({ data: [] });
    }
    mapRustError(err, 'Failed to list team members');
  }
};

interface PlanRaw {
  _id?: string;
  id?: string;
  planId?: string;
  name?: string;
  tier?: 'FREE' | 'PRO' | 'ENTERPRISE';
  renewsAt?: string;
  limits?: Record<string, unknown>;
}

export const getCurrentPlan: ApiV1Handler = async (_req, { ctx }) => {
  try {
    // The `users` crate's `/v1/session` endpoint already returns the
    // resolved plan joined onto the user document. Reuse it to avoid a
    // second round-trip until a dedicated `/v1/plans/current` lands.
    const session = await rustFetchAsUser<{ plan?: PlanRaw }>(
      ctx.tenantId,
      '/v1/session',
      { method: 'GET' },
    );
    const plan = session.plan ?? {};
    return NextResponse.json({
      planId: plan.planId ?? plan._id ?? plan.id ?? 'free',
      name: plan.name,
      tier: plan.tier ?? ctx.tier,
      renewsAt: plan.renewsAt ?? null,
      limits: plan.limits ?? {},
    });
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) {
      return NextResponse.json({
        planId: 'free',
        tier: ctx.tier,
        renewsAt: null,
        limits: {},
      });
    }
    mapRustError(err, 'Failed to load plan');
  }
};

interface RoleRaw {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
  permissions?: string[];
}

export const listRoles: ApiV1Handler = async (_req, { ctx }) => {
  try {
    const rows = await rustFetchAsUser<RoleRaw[]>(ctx.tenantId, '/v1/rbac/roles', {
      method: 'GET',
    });
    const data = (rows ?? []).map((r) => ({
      id: r.id ?? r._id ?? '',
      name: r.name ?? '',
      description: r.description,
      permissions: r.permissions ?? [],
    }));
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) {
      return NextResponse.json({ data: [] });
    }
    mapRustError(err, 'Failed to list roles');
  }
};
