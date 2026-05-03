/**
 * Identity, RBAC & Multi-Tenancy types.
 *
 * These types are intentionally framework-agnostic so they can be reused
 * by both server route handlers and pure logic modules in this folder.
 */

export type SsoProtocol = 'saml' | 'oidc';

export type SsoBaseConfig = {
    id: string;
    orgId: string;
    /** Display name shown to admins. */
    name: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
};

export type SamlSsoConfig = SsoBaseConfig & {
    protocol: 'saml';
    /** SAML 2.0 IdP entity / metadata URL */
    idpEntityId: string;
    /** Single Sign-On URL on the IdP side */
    idpSsoUrl: string;
    /** PEM-encoded x509 cert from the IdP */
    idpCertificate: string;
    /** Our service-provider entity ID (e.g. https://app.example.com/saml) */
    spEntityId: string;
    /** ACS URL (the consume endpoint) */
    spAcsUrl: string;
};

export type OidcSsoConfig = SsoBaseConfig & {
    protocol: 'oidc';
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    /** JWKS URL — used for token verification via `jose` */
    jwksUri: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
};

export type SsoConfig = SamlSsoConfig | OidcSsoConfig;

/* ── SCIM 2.0 (RFC 7643 / 7644) ─────────────────────────────── */

export type ScimEmail = {
    value: string;
    primary?: boolean;
    type?: 'work' | 'home' | 'other';
};

export type ScimName = {
    formatted?: string;
    familyName?: string;
    givenName?: string;
};

export type ScimMeta = {
    resourceType: 'User' | 'Group';
    created: string;
    lastModified: string;
    location?: string;
    version?: string;
};

export type ScimUser = {
    schemas: string[];
    id: string;
    externalId?: string;
    userName: string;
    name?: ScimName;
    displayName?: string;
    active: boolean;
    emails?: ScimEmail[];
    groups?: { value: string; display?: string }[];
    meta: ScimMeta;
};

export type ScimGroup = {
    schemas: string[];
    id: string;
    externalId?: string;
    displayName: string;
    members?: { value: string; display?: string; type?: 'User' | 'Group' }[];
    meta: ScimMeta;
};

export type ScimListResponse<T> = {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'];
    totalResults: number;
    startIndex: number;
    itemsPerPage: number;
    Resources: T[];
};

export type ScimError = {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'];
    detail?: string;
    status: string;
    scimType?: string;
};

/* ── Fine-grained ACL & RBAC ─────────────────────────────── */

export type AclAction = 'view' | 'create' | 'edit' | 'delete' | 'admin';

export type AclSubject =
    | { kind: 'user'; id: string }
    | { kind: 'group'; id: string }
    | { kind: 'role'; id: string };

export type ResourceAcl = {
    resourceType: string;
    resourceId: string;
    /** Optional parent ref for inheritance. */
    parent?: { resourceType: string; resourceId: string } | null;
    /** Subject -> allowed actions. Empty array means "no access". */
    grants: { subject: AclSubject; actions: AclAction[] }[];
    /** Explicit denies override grants (and inherited grants). */
    denies?: { subject: AclSubject; actions: AclAction[] }[];
};

export type Role = {
    id: string;
    orgId: string;
    name: string;
    description?: string;
    /** Map of `${resourceType}` -> allowed actions. */
    permissions: Record<string, AclAction[]>;
    /** Roles this role inherits from. */
    inherits?: string[];
};

export type Actor = {
    userId: string;
    orgId: string;
    /** Direct role ids. */
    roles: string[];
    /** Direct group memberships. */
    groups: string[];
};

/* ── Just-In-Time access grants ─────────────────────────────── */

export type JustInTimeGrant = {
    id: string;
    actor: Actor;
    resource: { type: string; id: string };
    actions: AclAction[];
    reason?: string;
    /** ISO timestamp when this expires. */
    expiresAt: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'denied' | 'revoked' | 'expired';
    approver?: { userId: string; at: string };
};

/* ── MFA ─────────────────────────────── */

export type MfaMethodKind = 'totp' | 'webauthn' | 'recovery';

export type TotpMethod = {
    kind: 'totp';
    id: string;
    userId: string;
    /** Base32-encoded shared secret. */
    secret: string;
    label: string;
    createdAt: string;
    lastUsedAt?: string;
};

export type WebAuthnMethod = {
    kind: 'webauthn';
    id: string;
    userId: string;
    credentialId: string;
    /** Stored COSE / SPKI public key (base64). */
    publicKey: string;
    counter: number;
    transports?: string[];
    label: string;
    createdAt: string;
    lastUsedAt?: string;
};

export type RecoveryCodeMethod = {
    kind: 'recovery';
    id: string;
    userId: string;
    /** Hashed recovery codes (sha256 hex). */
    codes: { hash: string; usedAt?: string }[];
    createdAt: string;
};

export type MfaMethod = TotpMethod | WebAuthnMethod | RecoveryCodeMethod;

/* ── Sessions ─────────────────────────────── */

export type Session = {
    id: string;
    userId: string;
    orgId?: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    /** Truncated user-agent string. */
    userAgent?: string;
    ip?: string;
    /** Optional MFA gate. */
    mfaPassed?: boolean;
    /** Distinguishes web/api/cli sessions. */
    kind?: 'web' | 'api' | 'cli';
    revokedAt?: string;
};

/* ── IP allowlist ─────────────────────────────── */

export type IpAllowRule = {
    id: string;
    orgId: string;
    /** Either a single IP (1.2.3.4) or CIDR (1.2.3.0/24). IPv4 + IPv6 both allowed. */
    cidr: string;
    label?: string;
    createdAt: string;
    createdBy: string;
};
