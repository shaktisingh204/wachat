/**
 * SSO flow handlers — SAML 2.0 + OIDC.
 *
 * These functions are intentionally pure: they accept the SSO config, return
 * data describing the next browser step (URL to redirect to / parsed claims)
 * and never read cookies or touch the DB. Persistence + session creation is
 * the caller's job.
 */

import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type {
    OidcSsoConfig,
    SamlSsoConfig,
    SsoConfig,
} from './types';

/* ── helpers ─────────────────────────────── */

function base64url(buf: Buffer | Uint8Array): string {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function pkceChallenge(verifier: string): string {
    return base64url(createHash('sha256').update(verifier).digest());
}

/* ── SAML ─────────────────────────────── */

export type BeginSamlAuthResult = {
    /** URL the browser should be redirected to. */
    redirectUrl: string;
    /** RelayState that the caller must round-trip + verify on consume. */
    relayState: string;
    /** SAMLRequest ID — useful to bind to the user's session. */
    requestId: string;
};

/**
 * Build a SAML 2.0 AuthnRequest, deflate+base64-encode it, and return the URL
 * the browser should be redirected to.
 *
 * The implementation deliberately avoids native deps: we generate the XML
 * inline and let the IdP validate it.
 */
export function beginSamlAuth(config: SamlSsoConfig): BeginSamlAuthResult {
    if (!config.enabled) {
        throw new Error('SAML connector is disabled');
    }
    const requestId = `_${randomBytes(16).toString('hex')}`;
    const issueInstant = new Date().toISOString();
    const relayState = randomBytes(16).toString('hex');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${config.idpSsoUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  AssertionConsumerServiceURL="${config.spAcsUrl}">
  <saml:Issuer>${config.spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;

    // HTTP-Redirect binding requires deflate+base64+urlencode. We use raw
    // base64 here (HTTP-POST friendly) — IdPs accept both for testing harnesses,
    // and SPs MAY upgrade to deflate when needed.
    const samlRequest = Buffer.from(xml, 'utf-8').toString('base64');
    const url = new URL(config.idpSsoUrl);
    url.searchParams.set('SAMLRequest', samlRequest);
    url.searchParams.set('RelayState', relayState);

    return { redirectUrl: url.toString(), relayState, requestId };
}

export type SamlClaims = {
    nameId: string;
    email?: string;
    displayName?: string;
    /** All <Attribute> elements found in the assertion. */
    attributes: Record<string, string[]>;
};

/**
 * Parse a base64-encoded SAML <Response>. NOTE: signature verification is
 * out of scope for this stub — production wiring should validate against
 * `config.idpCertificate` using `xml-crypto` or `xmldsig`.
 *
 * The parser is intentionally regex-based to avoid native XML deps. It is
 * good enough for typed access in tests and routing layers.
 */
export function consumeSamlResponse(
    config: SamlSsoConfig,
    samlResponseB64: string,
): SamlClaims {
    if (!config.enabled) {
        throw new Error('SAML connector is disabled');
    }
    const xml = Buffer.from(samlResponseB64, 'base64').toString('utf-8');

    const nameIdMatch = xml.match(/<saml[^:]*:NameID[^>]*>([^<]+)<\/saml[^:]*:NameID>/i);
    const nameId = nameIdMatch?.[1]?.trim() ?? '';
    if (!nameId) {
        throw new Error('SAML response missing NameID');
    }

    const attributes: Record<string, string[]> = {};
    const attrRegex =
        /<saml[^:]*:Attribute[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/saml[^:]*:Attribute>/gi;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(xml)) !== null) {
        const name = match[1];
        const inner = match[2];
        const values: string[] = [];
        const valRegex =
            /<saml[^:]*:AttributeValue[^>]*>([^<]*)<\/saml[^:]*:AttributeValue>/gi;
        let v: RegExpExecArray | null;
        while ((v = valRegex.exec(inner)) !== null) {
            values.push(v[1].trim());
        }
        if (values.length) attributes[name] = values;
    }

    const email =
        attributes['email']?.[0] ??
        attributes['urn:oid:0.9.2342.19200300.100.1.3']?.[0] ??
        (nameId.includes('@') ? nameId : undefined);
    const displayName =
        attributes['displayName']?.[0] ??
        attributes['name']?.[0] ??
        attributes['urn:oid:2.16.840.1.113730.3.1.241']?.[0];

    return { nameId, email, displayName, attributes };
}

/* ── OIDC ─────────────────────────────── */

export type BeginOidcAuthResult = {
    redirectUrl: string;
    state: string;
    nonce: string;
    /** PKCE verifier — caller must store + return on consume. */
    codeVerifier: string;
};

export function beginOidcAuth(config: OidcSsoConfig): BeginOidcAuthResult {
    if (!config.enabled) {
        throw new Error('OIDC connector is disabled');
    }
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    const codeVerifier = base64url(randomBytes(32));
    const codeChallenge = pkceChallenge(codeVerifier);

    const url = new URL(config.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('scope', (config.scopes ?? ['openid', 'email', 'profile']).join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return { redirectUrl: url.toString(), state, nonce, codeVerifier };
}

export type OidcClaims = {
    sub: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
    /** Raw verified ID token claims for callers needing more fields. */
    raw: Record<string, unknown>;
};

export type ConsumeOidcInput = {
    code: string;
    codeVerifier: string;
    /** When provided, verified against the `nonce` claim. */
    expectedNonce?: string;
};

/**
 * Exchange the auth code for tokens, then verify the ID token signature via
 * the IdP's JWKS using `jose`.
 */
export async function consumeOidcCode(
    config: OidcSsoConfig,
    input: ConsumeOidcInput,
): Promise<OidcClaims> {
    if (!config.enabled) {
        throw new Error('OIDC connector is disabled');
    }
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: input.codeVerifier,
    });

    const tokenRes = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!tokenRes.ok) {
        throw new Error(`OIDC token exchange failed: ${tokenRes.status}`);
    }
    const tokenJson = (await tokenRes.json()) as {
        id_token?: string;
        access_token?: string;
    };
    if (!tokenJson.id_token) {
        throw new Error('OIDC token response missing id_token');
    }

    const jwks = createRemoteJWKSet(new URL(config.jwksUri));
    const { payload } = await jwtVerify(tokenJson.id_token, jwks, {
        issuer: config.issuer,
        audience: config.clientId,
    });

    if (input.expectedNonce && payload.nonce !== input.expectedNonce) {
        throw new Error('OIDC nonce mismatch');
    }

    return {
        sub: String(payload.sub ?? ''),
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified:
            typeof payload.email_verified === 'boolean' ? payload.email_verified : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
        raw: payload as Record<string, unknown>,
    };
}

/* ── Convenience dispatch ─────────────────────────────── */

export function isSamlConfig(c: SsoConfig): c is SamlSsoConfig {
    return c.protocol === 'saml';
}
export function isOidcConfig(c: SsoConfig): c is OidcSsoConfig {
    return c.protocol === 'oidc';
}
