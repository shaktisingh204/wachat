import 'server-only';

/**
 * SabWebinar — Polls client. Wraps `/v1/sabwebinar/polls`.
 *
 * Public vote endpoint is at `POST /v1/sabwebinar/polls/public/:pollId/vote`.
 */
import { makeCrmClient, type CrmListParams } from './crm-base';

export interface SabwebinarPollOption {
  id: string;
  label: string;
  voters?: string[];
  voteCount: number;
}

export type SabwebinarPollStatus = 'draft' | 'open' | 'closed';

export interface SabwebinarPollDoc {
  _id: string;
  userId: string;
  webinarId: string;
  question: string;
  options: SabwebinarPollOption[];
  anonymous?: boolean;
  status: SabwebinarPollStatus;
  openedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabwebinarPollCreateInput {
  webinarId: string;
  question: string;
  options: string[];
  anonymous?: boolean;
}

export interface SabwebinarPollListParams extends CrmListParams {
  webinarId?: string;
  status?: SabwebinarPollStatus;
}

export const sabwebinarPollsClient = makeCrmClient<SabwebinarPollDoc, SabwebinarPollCreateInput>(
  '/v1/sabwebinar/polls',
);
