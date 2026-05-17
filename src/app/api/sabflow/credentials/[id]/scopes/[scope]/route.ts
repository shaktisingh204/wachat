/**
 * SabFlow — Per-scope revoke endpoint.
 *
 *   DELETE /api/sabflow/credentials/[id]/scopes/[scope]
 *     → { ok: true; outcome: 'remote' | 'soft'; statusCode?: number; reason?: string }
 *
 * Revokes a single scope on an OAuth credential.  Strategy is provider-aware:
 *
 *   - If the provider exposes a programmatic revoke endpoint AND the scope
 *     drop should kill the whole token (e.g. Google), we hit the remote
 *     endpoint.  Note: most provider revoke endpoints are "kill the whole
 *     token", not per-scope — so a remote call effectively forces the user
 *     to re-authorise with the remaining scopes.  To avoid surprise, we
 *     default to soft-revoke (local DB marker) and only do remote-revoke
 *     when explicitly asked via the `?hard=1` query string.
 *
 *   - Otherwise, we soft-revoke: remove the scope from `data.scope`, add it
 *     to `data.revokedScopes`, and emit an audit-log entry.  The runtime
 *     credential resolver MUST check `revokedScopes` before letting a flow
 *     act on the credential.
 *
 * Required scopes (the minimum the provider needs for basic operation) are
 * refused with a 400.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getCredentialById } from '@/lib/sabflow/credentials/db';
import { encryptRecord } from '@/lib/sabflow/credentials/encryption';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import {
  isRequiredScope,
  joinScopes,
  parseScopes,
  revokeProviderToken,
} from '@/lib/sabflow/oauth/revoke';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string; scope: string }> };

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: string | { toString(): string }; id?: string };
  const userId = u._id ?? u.id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id, scope: scopeParam } = await params;
  const scope = decodeURIComponent(scopeParam);

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
        `[SABFLOW SCOPE REVOKE] forbidden user=${userId} credential=${id}`,
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const providerId = credential.data?.oauthProvider ?? '';
    if (!providerId) {
      return NextResponse.json(
        { error: 'This credential is not an OAuth credential' },
        { status: 400 },
      );
    }

    if (isRequiredScope(providerId, scope)) {
      return NextResponse.json(
        {
          error: 'This scope is required for basic provider functionality and cannot be revoked individually. Revoke the whole credential instead.',
        },
        { status: 400 },
      );
    }

    const granted = parseScopes(credential.data?.scope);
    const revokedAlready = parseScopes(credential.data?.revokedScopes);

    if (!granted.includes(scope) && !revokedAlready.includes(scope)) {
      return NextResponse.json(
        { error: `Scope "${scope}" is not granted on this credential` },
        { status: 404 },
      );
    }

    const url = new URL(req.url);
    const hard = url.searchParams.get('hard') === '1';

    /* ── Optional remote revoke ────────────────────────────────────────── */
    let outcome:
      | { kind: 'remote'; statusCode: number }
      | { kind: 'soft'; reason: string };

    if (hard) {
      const accessToken = credential.data?.accessToken ?? '';
      const remote = await revokeProviderToken(providerId, accessToken);
      if (remote.kind === 'remote') {
        outcome = { kind: 'remote', statusCode: remote.statusCode };
      } else if (remote.kind === 'soft') {
        outcome = { kind: 'soft', reason: remote.reason };
      } else {
        // Remote attempt failed — fall back to soft revoke so the user isn't
        // left with a scope they think they revoked.
        outcome = {
          kind: 'soft',
          reason: `Remote revoke failed (${remote.error}); SabFlow will refuse to use this scope locally`,
        };
      }
    } else {
      outcome = {
        kind: 'soft',
        reason: 'Soft-revoked: SabFlow will refuse to use this scope in any flow.',
      };
    }

    /* ── Persist the soft-revoke marker ────────────────────────────────── */
    const nextGranted = granted.filter((s) => s !== scope);
    const nextRevoked = Array.from(new Set([...revokedAlready, scope]));

    // The scope + revokedScopes fields are non-sensitive metadata used by the
    // UI; storing them encrypted matches the rest of the credential bag.
    // Use $set on the two fields only so we don't disturb whichever encryption
    // state the other fields (accessToken, refreshToken, …) are already in.
    const { db } = await connectToDatabase();
    const col = db.collection('sabflow_credentials');
    const scopeFields = encryptRecord({
      scope: joinScopes(nextGranted),
      revokedScopes: joinScopes(nextRevoked),
    });
    await col.updateOne(
      { _id: new ObjectId(id), workspaceId: userId },
      {
        $set: {
          'data.scope': scopeFields.scope,
          'data.revokedScopes': scopeFields.revokedScopes,
          updatedAt: new Date(),
        },
      },
    );

    console.log(
      `[SABFLOW SCOPE REVOKE] provider=${providerId} credential=${id} user=${userId} scope=${scope} outcome=${outcome.kind} hard=${hard}`,
    );

    void recordFlowAction('credential.scope.revoked', {
      userId,
      target: id,
      metadata: {
        provider: providerId,
        scope,
        outcome: outcome.kind,
        statusCode: outcome.kind === 'remote' ? outcome.statusCode : undefined,
        reason: outcome.kind === 'soft' ? outcome.reason : undefined,
        hard,
      },
      request: req,
    });

    if (hard && outcome.kind === 'remote') {
      void recordFlowAction('credential.oauth.revoked', {
        userId,
        target: id,
        metadata: {
          provider: providerId,
          scope,
          statusCode: outcome.statusCode,
        },
        request: req,
      });
    }

    return NextResponse.json({
      ok: true,
      outcome: outcome.kind,
      statusCode: outcome.kind === 'remote' ? outcome.statusCode : undefined,
      reason: outcome.kind === 'soft' ? outcome.reason : undefined,
      remainingScopes: nextGranted,
      revokedScopes: nextRevoked,
    });
  } catch (err) {
    console.error(
      `[SABFLOW SCOPE REVOKE] error credential=${id} scope=${scope}`,
      err,
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
