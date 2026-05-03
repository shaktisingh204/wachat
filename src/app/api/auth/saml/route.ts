/**
 * SAML 2.0 ACS (Assertion Consumer Service) endpoint stub.
 *
 * The IdP POSTs a base64-encoded `SAMLResponse` here; this stub parses the
 * NameID + attributes via `consumeSamlResponse` and returns a JSON payload
 * the caller can use to seed a session. Cookie issuance + session
 * persistence are intentionally left to the host app's session helpers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { consumeSamlResponse } from '@/lib/identity/sso';
import type { SamlSsoConfig } from '@/lib/identity/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadSamlConfig(_orgId: string | null): Promise<SamlSsoConfig | null> {
    // TODO: load tenant SAML config from Mongo (`sso_configs` collection).
    return null;
}

export async function POST(req: NextRequest) {
    let samlResponse: string | null;
    let relayState: string | null;
    try {
        const form = await req.formData();
        samlResponse = (form.get('SAMLResponse') as string | null) ?? null;
        relayState = (form.get('RelayState') as string | null) ?? null;
    } catch (err) {
        console.error('[SAML_ACS] invalid form body', err);
        return NextResponse.json({ error: 'Invalid SAML POST body' }, { status: 400 });
    }
    if (!samlResponse) {
        console.warn('[SAML_ACS] missing SAMLResponse');
        return NextResponse.json({ error: 'Missing SAMLResponse' }, { status: 400 });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('org');
    const config = await loadSamlConfig(orgId);
    if (!config) {
        console.warn('[SAML_ACS] no SAML config for org', orgId);
        return NextResponse.json({ error: 'SAML not configured for tenant' }, { status: 404 });
    }

    try {
        const claims = consumeSamlResponse(config, samlResponse);
        console.log('[SAML_ACS] consumed assertion for', claims.nameId);
        // TODO: upsert user, mint session cookie via host-app helper.
        return NextResponse.json({ ok: true, relayState, claims });
    } catch (err) {
        console.error('[SAML_ACS] verification error', err);
        const message = err instanceof Error ? err.message : 'SAML verification failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function GET() {
    // ACS requires POST per SAML 2.0 HTTP-POST binding.
    return NextResponse.json(
        { error: 'Use POST with SAMLResponse form field' },
        { status: 405, headers: { Allow: 'POST' } },
    );
}
