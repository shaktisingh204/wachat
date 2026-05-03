/**
 * Community / forum integration scaffold.
 *
 * Discourse SSO uses HMAC-signed query parameters, not JWT, in production —
 * but for the wider SabNode ecosystem (and forum providers like Vanilla,
 * NodeBB, custom embeds) we expose a `jose`-backed JWT bridge token. Hosts
 * can choose either path.
 */

import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { SignJWT, jwtVerify } from 'jose';

import { randomUUID } from 'node:crypto';
import type { Ambassador, CommunityMember, CommunityRole } from './types';

// ── Discourse classic SSO (HMAC-SHA256) ──────────────────────────────────────

export interface DiscourseSsoPayload {
  /** Internal user id — must be stable. */
  external_id: string;
  email: string;
  username?: string;
  name?: string;
  /** Avatar URL. */
  avatar_url?: string;
  /** `true` to grant moderator on Discourse side. */
  moderator?: boolean;
  /** `true` to grant admin on Discourse side. */
  admin?: boolean;
}

function getDiscourseSecret(): string {
  const secret = process.env.DISCOURSE_SSO_SECRET;
  if (!secret) {
    throw new Error('DISCOURSE_SSO_SECRET is not defined in the environment.');
  }
  return secret;
}

/**
 * Verify the inbound `sso` + `sig` payload sent by Discourse when a user
 * clicks "Log in" on the forum. Returns the decoded `nonce` + `return_sso_url`.
 */
export function verifyDiscoursePayload(
  sso: string,
  sig: string,
  secret: string = getDiscourseSecret(),
): { nonce: string; returnSsoUrl: string } {
  const expected = createHmac('sha256', secret).update(sso).digest('hex');
  const ok =
    expected.length === sig.length &&
    timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  if (!ok) throw new Error('Invalid Discourse SSO signature.');

  const decoded = Buffer.from(sso, 'base64').toString('utf-8');
  const params = new URLSearchParams(decoded);
  const nonce = params.get('nonce');
  const returnSsoUrl = params.get('return_sso_url');
  if (!nonce || !returnSsoUrl) {
    throw new Error('Missing nonce or return_sso_url in Discourse SSO payload.');
  }
  return { nonce, returnSsoUrl };
}

/**
 * Build the signed `sso` + `sig` parameters to redirect the user back to
 * Discourse with their identity attached.
 */
export function buildDiscourseSsoResponse(
  payload: DiscourseSsoPayload,
  nonce: string,
  secret: string = getDiscourseSecret(),
): { sso: string; sig: string } {
  const params = new URLSearchParams({ nonce });
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const sso = Buffer.from(params.toString(), 'utf-8').toString('base64');
  const sig = createHmac('sha256', secret).update(sso).digest('hex');
  return { sso, sig };
}

// ── jose-based bridge token (alternative forums / embeds) ────────────────────

export interface CommunityTokenClaims {
  sub: string;
  email: string;
  tenantId: string;
  role: CommunityRole;
  username?: string;
}

function getCommunitySecret(): Uint8Array {
  const secret = process.env.COMMUNITY_SSO_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('COMMUNITY_SSO_SECRET (or JWT_SECRET) is not defined.');
  }
  return new TextEncoder().encode(secret);
}

/** Issue a short-lived (5 min) JWT for forum SSO bridging. */
export async function issueCommunityToken(claims: CommunityTokenClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('sabnode')
    .setAudience('community')
    .setExpirationTime('5m')
    .setSubject(claims.sub)
    .sign(getCommunitySecret());
}

export async function verifyCommunityToken(token: string): Promise<CommunityTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getCommunitySecret(), {
      issuer: 'sabnode',
      audience: 'community',
    });
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.tenantId !== 'string') {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: (payload.role as CommunityRole) ?? 'member',
      username: typeof payload.username === 'string' ? payload.username : undefined,
    };
  } catch {
    return null;
  }
}

// ── Member / Ambassador helpers ──────────────────────────────────────────────

export interface CreateMemberInput {
  userId: string;
  tenantId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
}

export function createCommunityMember(input: CreateMemberInput): CommunityMember {
  return {
    userId: input.userId,
    tenantId: input.tenantId,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    bio: input.bio,
    role: 'member',
    points: 0,
    joinedAt: new Date(),
  };
}

export interface CreateAmbassadorInput {
  userId: string;
  tenantId: string;
  displayName: string;
  region: string;
  bio: string;
  cohort: string;
  avatarUrl?: string;
  socials?: Ambassador['socials'];
}

export function createAmbassador(input: CreateAmbassadorInput): Ambassador {
  return {
    ambassadorId: randomUUID(),
    userId: input.userId,
    tenantId: input.tenantId,
    slug: slugify(input.displayName),
    displayName: input.displayName,
    region: input.region,
    bio: input.bio,
    cohort: input.cohort,
    avatarUrl: input.avatarUrl,
    socials: input.socials ?? {},
    active: true,
    joinedAt: new Date(),
  };
}

/** Generate a fresh nonce suitable for use in the Discourse SSO handshake. */
export function makeSsoNonce(): string {
  return randomBytes(16).toString('hex');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
