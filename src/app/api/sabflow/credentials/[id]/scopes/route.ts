/**
 * SabFlow — Credential scopes API
 *
 *   GET  /api/sabflow/credentials/[id]/scopes
 *     → { provider, granted, revoked, required, catalog, providerLabel }
 *
 *   POST /api/sabflow/credentials/[id]/scopes
 *     Body: { scopes: string[]; mode?: 'replace' | 'append' }
 *     → { authorizeUrl }
 *     Kicks off an OAuth re-consent flow with the union (or replacement) of
 *     the requested scope list.  The response is a URL the client should
 *     redirect the browser to.
 *
 * Only the owning workspace may read or mutate scopes.  All mutations are
 * audit-logged via `recordFlowAction`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getCredentialById } from '@/lib/sabflow/credentials/db';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import {
  getScopeCatalog,
  isKnownProvider,
  PROVIDER_LABEL,
  describeScope,
} from '@/lib/sabflow/oauth/scopeCatalog';
import {
  parseScopes,
  requiredScopesFor,
} from '@/lib/sabflow/oauth/revoke';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: string | { toString(): string }; id?: string };
  const userId = u._id ?? u.id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

/* ── GET — list scopes ──────────────────────────────────────────────────── */

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const credential = await getCredentialById(id);
    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }
    if (credential.workspaceId !== userId) {
      console.warn(
        `[SABFLOW CREDENTIAL SCOPES] forbidden user=${userId} credential=${id}`,
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const provider = credential.data?.oauthProvider ?? '';
    if (!provider) {
      return NextResponse.json({
        provider: null,
        providerLabel: null,
        granted: [],
        revoked: [],
        required: [],
        catalog: [],
        isOAuth: false,
      });
    }

    const grantedTokens = parseScopes(credential.data?.scope);
    const revokedTokens = parseScopes(credential.data?.revokedScopes);
    const required = requiredScopesFor(provider);
    const catalog = getScopeCatalog(provider);

    const granted = grantedTokens.map((scope) => ({
      scope,
      description: describeScope(provider, scope),
      required: required.includes(scope),
      revoked: revokedTokens.includes(scope),
    }));

    return NextResponse.json({
      provider,
      providerLabel: isKnownProvider(provider) ? PROVIDER_LABEL[provider] : provider,
      granted,
      revoked: revokedTokens,
      required,
      catalog,
      isOAuth: true,
    });
  } catch (err) {
    console.error(
      `[SABFLOW CREDENTIAL SCOPES] GET error credential=${id}`,
      err,
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── POST — request additional scopes (kicks off re-consent) ───────────── */

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const credential = await getCredentialById(id);
    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }
    if (credential.workspaceId !== userId) {
      console.warn(
        `[SABFLOW CREDENTIAL SCOPES] POST forbidden user=${userId} credential=${id}`,
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const provider = credential.data?.oauthProvider ?? '';
    if (!provider) {
      return NextResponse.json(
        { error: 'This credential is not an OAuth credential' },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
    }
    const raw = body as { scopes?: unknown; mode?: unknown; returnTo?: unknown };
    if (!Array.isArray(raw.scopes)) {
      return NextResponse.json({ error: '`scopes` must be an array of strings' }, { status: 400 });
    }
    const requested = raw.scopes.filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
    if (requested.length === 0) {
      return NextResponse.json({ error: 'At least one scope is required' }, { status: 400 });
    }
    const mode: 'replace' | 'append' = raw.mode === 'replace' ? 'replace' : 'append';

    const existing = parseScopes(credential.data?.scope);
    const final =
      mode === 'replace'
        ? Array.from(new Set(requested))
        : Array.from(new Set([...existing, ...requested]));

    // Build the start-of-OAuth URL the browser will follow.  We re-use the
    // existing /api/sabflow/oauth/authorize endpoint so the state-store and
    // callback paths are unchanged.
    const url = new URL(req.url);
    const returnTo =
      typeof raw.returnTo === 'string' && raw.returnTo.startsWith('/')
        ? raw.returnTo
        : `/dashboard/sabflow/credentials/${id}/scopes`;
    const authorizeUrl = new URL('/api/sabflow/oauth/authorize', url.origin);
    authorizeUrl.searchParams.set('provider', provider);
    authorizeUrl.searchParams.set('credentialId', id);
    authorizeUrl.searchParams.set('scopes', final.join(','));
    authorizeUrl.searchParams.set('returnTo', returnTo);

    console.log(
      `[SABFLOW CREDENTIAL SCOPES] reconsent provider=${provider} credential=${id} user=${userId} mode=${mode} scopes=${final.length}`,
    );

    void recordFlowAction('credential.scope.reconsent_started', {
      userId,
      target: id,
      metadata: {
        provider,
        mode,
        requestedScopes: requested,
        finalScopes: final,
      },
      request: req,
    });

    return NextResponse.json({
      ok: true,
      authorizeUrl: authorizeUrl.pathname + authorizeUrl.search,
      finalScopes: final,
    });
  } catch (err) {
    console.error(
      `[SABFLOW CREDENTIAL SCOPES] POST error credential=${id}`,
      err,
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
