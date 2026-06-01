// PORT-NOTE: Enterprise license; GraphQL @InputType and class-validator decorators
// replaced with plain TS types + zod schemas.

import { z } from "zod";

import { isX509Certificate } from "@/lib/sabcrm/server/src/engine/core-modules/sso/dtos/validators/x509.validator";

const setupSsoInputCommonSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().url(),
});

export type SetupSsoInputCommon = {
  name: string;
  issuer: string;
};

export type SetupOIDCSsoInput = SetupSsoInputCommon & {
  clientID: string;
  clientSecret: string;
};

export const setupOIDCSsoInputSchema = setupSsoInputCommonSchema.extend({
  clientID: z.string().min(1),
  clientSecret: z.string().min(1),
});

export type SetupSAMLSsoInput = SetupSsoInputCommon & {
  id: string;
  ssoURL: string;
  certificate: string;
  fingerprint?: string;
};

export const setupSAMLSsoInputSchema = setupSsoInputCommonSchema.extend({
  id: z.string().uuid(),
  ssoURL: z.string().url(),
  certificate: z.string().refine(isX509Certificate, {
    message: "The string is not a valid X509 certificate",
  }),
  fingerprint: z.string().optional(),
});
