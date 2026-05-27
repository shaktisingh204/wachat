import 'server-only';

/**
 * SabWebinar — Chat client. Wraps `/v1/sabwebinar/chat`.
 *
 * All HTTP routes are unauthenticated (real-time fan-out lives on the
 * transport layer; HTTP is persistence + replay).
 */

export interface SabwebinarChatMessage {
  _id: string;
  userId: string;
  webinarId: string;
  sessionId?: string;
  senderName: string;
  senderUserId?: string;
  body: string;
  ts: string;
}

export interface SabwebinarChatSendInput {
  webinarId: string;
  sessionId?: string;
  senderName: string;
  body: string;
}

export interface SabwebinarChatListParams {
  webinarId: string;
  sessionId?: string;
  since?: string;
  limit?: number;
}
