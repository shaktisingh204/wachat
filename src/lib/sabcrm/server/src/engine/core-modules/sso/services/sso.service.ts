// PORT-NOTE: Enterprise license. NestJS @Injectable + TypeORM repository replaced
// with plain async functions backed by MongoDB.
import "server-only";

import { Issuer } from "openid-client";
import { v4 as uuidv4 } from "uuid";

import {
  getWorkspaceSSOIdentityProviderCollection,
  IdentityProviderType,
  OIDCResponseType,
  SSOIdentityProviderStatus,
  type WorkspaceSSOIdentityProviderDocument,
} from "@/lib/sabcrm/server/src/engine/core-modules/sso/workspace-sso-identity-provider.entity";
import {
  SSOException,
  SSOExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/sso/sso.exception";
import type {
  OIDCConfiguration,
  SAMLConfiguration,
  SSOConfiguration,
} from "@/lib/sabcrm/server/src/engine/core-modules/sso/types/SSOConfigurations.type";

// Minimal config shape needed by the service
export type SSOServiceConfig = {
  get(key: "SERVER_URL"): string;
};

// ── Billing entitlement hook ──────────────────────────────────────────────────
// PORT-NOTE: BillingService removed; implement isSSOEnabled by injecting a
// billing check or toggling via an env var (SABCRM_SSO_ENABLED).
const isSSOBillingEnabled = async (_workspaceId: string): Promise<boolean> =>
  process.env.SABCRM_SSO_ENABLED === "true";

const assertSSOEnabled = async (workspaceId: string): Promise<void> => {
  if (!(await isSSOBillingEnabled(workspaceId))) {
    throw new SSOException(
      "No entitlement found for this workspace",
      SSOExceptionCode.SSO_DISABLE,
    );
  }
};

// ── OIDC helpers ─────────────────────────────────────────────────────────────

const getIssuerForOIDC = async (issuerUrl: string): Promise<Issuer> => {
  try {
    return await Issuer.discover(issuerUrl);
  } catch {
    throw new SSOException(
      "Invalid issuer",
      SSOExceptionCode.INVALID_ISSUER_URL,
    );
  }
};

// ── URL helpers ───────────────────────────────────────────────────────────────

const buildCallbackUrl = (
  identityProvider: Pick<WorkspaceSSOIdentityProviderDocument, "type" | "id">,
  serverUrl: string,
): string => {
  const callbackURL = new URL(serverUrl);

  callbackURL.pathname = `/auth/${identityProvider.type.toLowerCase()}/callback`;

  if (identityProvider.type === IdentityProviderType.SAML) {
    callbackURL.pathname += `/${identityProvider.id}`;
  }

  return callbackURL.toString();
};

export const buildIssuerURL = (
  identityProvider: Pick<WorkspaceSSOIdentityProviderDocument, "id" | "type">,
  serverUrl: string,
  searchParams?: Record<string, string | boolean>,
): string => {
  const authorizationUrl = new URL(serverUrl);

  authorizationUrl.pathname = `/auth/${identityProvider.type.toLowerCase()}/login/${identityProvider.id}`;

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      authorizationUrl.searchParams.append(key, value.toString());
    });
  }

  return authorizationUrl.toString();
};

// ── Type guards ────────────────────────────────────────────────────────────────

const isOIDCIdentityProvider = (
  identityProvider: WorkspaceSSOIdentityProviderDocument,
): identityProvider is OIDCConfiguration & WorkspaceSSOIdentityProviderDocument =>
  identityProvider.type === IdentityProviderType.OIDC;

export const isSAMLIdentityProvider = (
  identityProvider: WorkspaceSSOIdentityProviderDocument,
): identityProvider is SAMLConfiguration & WorkspaceSSOIdentityProviderDocument =>
  identityProvider.type === IdentityProviderType.SAML;

// ── Service functions ─────────────────────────────────────────────────────────

export const createOIDCIdentityProvider = async (
  data: {
    issuer: string;
    clientID: string;
    clientSecret: string;
    name: string;
  },
  workspaceId: string,
  serverUrl: string,
): Promise<
  | { id: string; type: IdentityProviderType; name: string; status: SSOIdentityProviderStatus; issuer: string }
  | SSOException
> => {
  try {
    await assertSSOEnabled(workspaceId);

    const issuer = await getIssuerForOIDC(data.issuer);
    const collection = await getWorkspaceSSOIdentityProviderCollection();

    const id = uuidv4();
    const now = new Date();
    const doc: WorkspaceSSOIdentityProviderDocument = {
      _id: id,
      id,
      type: IdentityProviderType.OIDC,
      clientID: data.clientID,
      clientSecret: data.clientSecret,
      issuer: issuer.metadata.issuer,
      name: data.name,
      status: SSOIdentityProviderStatus.Active,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(doc);

    return {
      id: doc.id,
      type: doc.type,
      name: doc.name,
      status: doc.status,
      issuer: doc.issuer,
    };
  } catch (err) {
    if (err instanceof SSOException) {
      return err;
    }

    return new SSOException(
      "Unknown SSO configuration error",
      SSOExceptionCode.UNKNOWN_SSO_CONFIGURATION_ERROR,
    );
  }
};

export const createSAMLIdentityProvider = async (
  data: {
    ssoURL: string;
    certificate: string;
    fingerprint?: string;
    id: string;
  },
  workspaceId: string,
  serverUrl: string,
): Promise<{ id: string; type: IdentityProviderType; name?: string; issuer: string; status: SSOIdentityProviderStatus }> => {
  await assertSSOEnabled(workspaceId);

  const collection = await getWorkspaceSSOIdentityProviderCollection();
  const now = new Date();
  const doc: WorkspaceSSOIdentityProviderDocument = {
    _id: data.id,
    id: data.id,
    type: IdentityProviderType.SAML,
    ssoURL: data.ssoURL,
    certificate: data.certificate,
    fingerprint: data.fingerprint,
    name: "",
    issuer: "",
    status: SSOIdentityProviderStatus.Active,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(doc);

  return {
    id: doc.id,
    type: doc.type,
    name: doc.name,
    issuer: buildIssuerURL(doc, serverUrl),
    status: doc.status,
  };
};

export const findSSOIdentityProviderById = async (
  identityProviderId: string,
): Promise<(SSOConfiguration & WorkspaceSSOIdentityProviderDocument) | null> => {
  const collection = await getWorkspaceSSOIdentityProviderCollection();

  return collection.findOne({ id: identityProviderId }) as Promise<
    (SSOConfiguration & WorkspaceSSOIdentityProviderDocument) | null
  >;
};

export const getOIDCClient = (
  identityProvider: WorkspaceSSOIdentityProviderDocument,
  issuer: Issuer,
  serverUrl: string,
) => {
  if (!isOIDCIdentityProvider(identityProvider)) {
    throw new SSOException(
      "Invalid Identity Provider type",
      SSOExceptionCode.INVALID_IDP_TYPE,
    );
  }

  return new issuer.Client({
    client_id: identityProvider.clientID,
    client_secret: identityProvider.clientSecret,
    redirect_uris: [buildCallbackUrl(identityProvider, serverUrl)],
    response_types: [OIDCResponseType.CODE],
  });
};

export const getAuthorizationUrlForSSO = async (
  identityProviderId: string,
  searchParams: Record<string, string | boolean>,
  serverUrl: string,
): Promise<{ id: string; authorizationURL: string; type: IdentityProviderType }> => {
  const collection = await getWorkspaceSSOIdentityProviderCollection();

  const identityProvider = await collection.findOne({ id: identityProviderId });

  if (!identityProvider) {
    throw new SSOException(
      "Identity Provider not found",
      SSOExceptionCode.USER_NOT_FOUND,
    );
  }

  return {
    id: identityProvider.id,
    authorizationURL: buildIssuerURL(identityProvider, serverUrl, searchParams),
    type: identityProvider.type,
  };
};

export const getSSOIdentityProviders = async (
  workspaceId: string,
): Promise<
  Array<
    Pick<
      WorkspaceSSOIdentityProviderDocument,
      "id" | "name" | "type" | "issuer" | "status"
    >
  >
> => {
  const collection = await getWorkspaceSSOIdentityProviderCollection();

  return collection
    .find({ workspaceId } as Partial<WorkspaceSSOIdentityProviderDocument>)
    .project<
      Pick<
        WorkspaceSSOIdentityProviderDocument,
        "id" | "name" | "type" | "issuer" | "status"
      >
    >({ id: 1, name: 1, type: 1, issuer: 1, status: 1 })
    .toArray();
};

export const deleteSSOIdentityProvider = async (
  identityProviderId: string,
  workspaceId: string,
): Promise<{ identityProviderId: string }> => {
  const collection = await getWorkspaceSSOIdentityProviderCollection();

  const identityProvider = await collection.findOne({
    id: identityProviderId,
    workspaceId,
  } as Partial<WorkspaceSSOIdentityProviderDocument>);

  if (!identityProvider) {
    throw new SSOException(
      "Identity Provider not found",
      SSOExceptionCode.IDENTITY_PROVIDER_NOT_FOUND,
    );
  }

  await collection.deleteOne({ id: identityProvider.id });

  return { identityProviderId: identityProvider.id };
};

export const editSSOIdentityProvider = async (
  payload: Partial<WorkspaceSSOIdentityProviderDocument>,
  workspaceId: string,
): Promise<{
  id: string;
  type: IdentityProviderType;
  issuer: string;
  name: string;
  status: SSOIdentityProviderStatus;
}> => {
  const collection = await getWorkspaceSSOIdentityProviderCollection();

  const ssoIdp = await collection.findOne({
    id: payload.id,
    workspaceId,
  } as Partial<WorkspaceSSOIdentityProviderDocument>);

  if (!ssoIdp) {
    throw new SSOException(
      "Identity Provider not found",
      SSOExceptionCode.IDENTITY_PROVIDER_NOT_FOUND,
    );
  }

  const updated: WorkspaceSSOIdentityProviderDocument = {
    ...ssoIdp,
    ...payload,
    updatedAt: new Date(),
  };

  await collection.replaceOne({ id: ssoIdp.id }, updated);

  return {
    id: updated.id,
    type: updated.type,
    issuer: updated.issuer,
    name: updated.name,
    status: updated.status,
  };
};
