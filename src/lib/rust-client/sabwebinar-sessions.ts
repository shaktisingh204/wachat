import 'server-only';

/**
 * SabWebinar — Sessions client. Wraps `/v1/sabwebinar/sessions`.
 */
import { makeCrmClient, type CrmListParams } from './crm-base';

export interface SabwebinarSessionDoc {
  _id: string;
  userId: string;
  webinarId: string;
  startedAt: string;
  endedAt?: string;
  peakConcurrent: number;
  streamUrl?: string;
  sfuRoomId?: string;
}

export interface SabwebinarSessionCreateInput {
  webinarId: string;
  streamUrl?: string;
  sfuRoomId?: string;
}

export interface SabwebinarSessionListParams extends CrmListParams {
  webinarId?: string;
}

export const sabwebinarSessionsClient = makeCrmClient<
  SabwebinarSessionDoc,
  SabwebinarSessionCreateInput
>('/v1/sabwebinar/sessions');
