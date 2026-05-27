import 'server-only';

/**
 * SabWebinar — Webinars client. Wraps `/v1/sabwebinar/webinars`.
 *
 * The host-scoped webinar entity (slug, schedule, landing theme, hero,
 * recording, status). The `/by-slug/:slug` route is public.
 */
import { makeCrmClient, type CrmListParams } from './crm-base';

export interface SabwebinarLandingTheme {
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headline?: string;
  subHeadline?: string;
  ctaLabel?: string;
  hostBio?: string;
}

export type SabwebinarStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface SabwebinarDoc {
  _id: string;
  userId: string;
  slug: string;
  title: string;
  description?: string;
  hostUserId: string;
  hostName?: string;
  scheduledStart?: string;
  durationMinutes?: number;
  timezone?: string;
  status: SabwebinarStatus;
  landingTheme?: SabwebinarLandingTheme;
  heroFileId?: string;
  recordingFileId?: string;
  requireRegistration?: boolean;
  capacity?: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabwebinarCreateInput {
  title: string;
  description?: string;
  slug?: string;
  hostUserId?: string;
  hostName?: string;
  scheduledStart?: string;
  durationMinutes?: number;
  timezone?: string;
  landingTheme?: SabwebinarLandingTheme;
  heroFileId?: string;
  requireRegistration?: boolean;
  capacity?: number;
}

export interface SabwebinarListParams extends CrmListParams {
  status?: SabwebinarStatus | 'all';
  when?: 'upcoming' | 'past' | 'live' | 'all';
}

export const sabwebinarWebinarsClient = makeCrmClient<SabwebinarDoc, SabwebinarCreateInput>(
  '/v1/sabwebinar/webinars',
);
