import 'server-only';

/**
 * SabWebinar — Q&A client. Wraps `/v1/sabwebinar/qna`.
 *
 * Public ask/upvote/list-by-webinar endpoints are unauthenticated.
 */
import { makeCrmClient, type CrmListParams } from './crm-base';

export interface SabwebinarQnaDoc {
  _id: string;
  userId: string;
  webinarId: string;
  askerName?: string;
  question: string;
  answer?: string;
  answered: boolean;
  upvotes: number;
  upvoters?: string[];
  createdAt: string;
  answeredAt?: string;
}

export interface SabwebinarQnaCreateInput {
  webinarId: string;
  question: string;
  askerName?: string;
}

export interface SabwebinarQnaListParams extends CrmListParams {
  webinarId?: string;
  filter?: 'answered' | 'open' | 'all';
}

export const sabwebinarQnaClient = makeCrmClient<SabwebinarQnaDoc, SabwebinarQnaCreateInput>(
  '/v1/sabwebinar/qna',
);
