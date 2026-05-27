import 'server-only';

/**
 * SabWebinar — Registrations client. Wraps `/v1/sabwebinar/registrations`.
 *
 * Public POST by slug is exposed via `createPublicBySlug` (no auth).
 * Host list/get use the standard CRM client surface.
 */
import { makeCrmClient, type CrmListParams } from './crm-base';

export interface SabwebinarRegistrationDoc {
  _id: string;
  userId: string;
  webinarId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  customFields?: Record<string, unknown>;
  source?: string;
  registeredAt: string;
  joinedAt?: string;
  leftAt?: string;
  joinToken: string;
}

export interface SabwebinarRegistrationCreateInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  customFields?: Record<string, unknown>;
  source?: string;
}

export interface SabwebinarRegistrationListParams extends CrmListParams {
  webinarId?: string;
  source?: string;
}

export const sabwebinarRegistrationsClient = makeCrmClient<
  SabwebinarRegistrationDoc,
  SabwebinarRegistrationCreateInput
>('/v1/sabwebinar/registrations');
