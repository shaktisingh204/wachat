/**
 * Client portal — branded subdomain config + signed link generator.
 *
 * Uses `jose` (already a project dep) to mint short-lived JWTs that
 * are embedded in signed magic-links delivered to clients. The token
 * carries the project, client, and scope claims and is verified by
 * the portal's middleware on each request.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

import type { ClientPortalSession, ID } from './types';

export interface PortalBranding {
  /** Subdomain slug (lowercase, kebab). e.g. `acme`. */
  subdomain: string;
  /** Root portal domain — typically `clients.sabnode.com`. */
  rootDomain: string;
  /** Optional logo URL shown in the portal header. */
  logoUrl?: string;
  /** Primary brand colour (hex). */
  primaryColor?: string;
  /** Display name for the portal. */
  displayName?: string;
}

export type PortalScope =
  | 'view_project'
  | 'view_invoices'
  | 'comment'
  | 'approve';

export interface IssueLinkInput {
  userId: ID;
  projectId: ID;
  clientId: ID;
  branding: PortalBranding;
  scopes: PortalScope[];
  /** Lifetime in seconds. Defaults to 7 days. */
  ttlSeconds?: number;
  /** Path within the portal (e.g. `/invoices/inv_123`). */
  path?: string;
  /** HMAC secret. Pulled from env in callers; passed in for testability. */
  secret: string;
  /** Token issuer claim. Defaults to `sabnode-worksuite`. */
  issuer?: string;
}

export interface SignedPortalLink {
  url: string;
  token: string;
  session: ClientPortalSession;
}

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateSubdomain(slug: string): boolean {
  return SUBDOMAIN_RE.test(slug);
}

export function buildPortalOrigin(b: PortalBranding): string {
  if (!validateSubdomain(b.subdomain)) {
    throw new Error(`Invalid subdomain: ${b.subdomain}`);
  }
  return `https://${b.subdomain}.${b.rootDomain}`;
}

const newJti = (): ID =>
  'cps_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function issueClientPortalLink(
  input: IssueLinkInput,
): Promise<SignedPortalLink> {
  if (!input.secret) throw new Error('issueClientPortalLink: missing secret');
  if (!input.scopes.length) {
    throw new Error('issueClientPortalLink: at least one scope is required');
  }
  const ttl = input.ttlSeconds ?? 7 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;
  const jti = newJti();

  const token = await new SignJWT({
    pid: input.projectId,
    cid: input.clientId,
    scp: input.scopes,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(input.issuer ?? 'sabnode-worksuite')
    .setSubject(input.clientId)
    .setAudience(`portal:${input.projectId}`)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(new TextEncoder().encode(input.secret));

  const origin = buildPortalOrigin(input.branding);
  const path = input.path && input.path.startsWith('/') ? input.path : '/';
  const url = `${origin}${path}${path.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;

  const session: ClientPortalSession = {
    id: jti,
    userId: input.userId,
    projectId: input.projectId,
    clientId: input.clientId,
    subdomain: input.branding.subdomain,
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    scopes: input.scopes,
    createdAt: new Date(now * 1000).toISOString(),
  };

  return { url, token, session };
}

export interface PortalClaims extends JWTPayload {
  pid: string;
  cid: string;
  scp: PortalScope[];
}

export async function verifyClientPortalToken(
  token: string,
  secret: string,
  expectedProjectId?: ID,
): Promise<PortalClaims> {
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(secret),
    expectedProjectId
      ? { audience: `portal:${expectedProjectId}` }
      : undefined,
  );
  if (
    typeof (payload as PortalClaims).pid !== 'string' ||
    typeof (payload as PortalClaims).cid !== 'string' ||
    !Array.isArray((payload as PortalClaims).scp)
  ) {
    throw new Error('Invalid portal token claims');
  }
  return payload as PortalClaims;
}
