import 'server-only';

import type { SabsmsMessage } from '@/lib/sabsms/types';

/**
 * Public JSON shape for one message — a stable, deliberately narrow
 * projection of the internal `sabsms_messages` document (no provider
 * account ids, no wholesale cost, no DLT internals).
 */
export interface PublicMessage {
  id: string;
  to: string;
  from: string | null;
  body: string;
  direction: SabsmsMessage['direction'];
  channel: SabsmsMessage['channel'];
  category: SabsmsMessage['category'];
  status: SabsmsMessage['status'];
  segments: number | null;
  errorCode: string | null;
  templateId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
}

export function projectMessage(doc: SabsmsMessage): PublicMessage {
  return {
    id: doc._id ? String(doc._id) : '',
    to: doc.to,
    from: doc.from || null,
    body: doc.body,
    direction: doc.direction,
    channel: doc.channel,
    category: doc.category,
    status: doc.status,
    segments: typeof doc.segmentsCount === 'number' ? doc.segmentsCount : null,
    errorCode: doc.normalizedCode ?? doc.errorCode ?? null,
    templateId: doc.templateId ?? null,
    sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
    deliveredAt: doc.deliveredAt ? doc.deliveredAt.toISOString() : null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
  };
}
