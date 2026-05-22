import IORedis, { type Redis } from 'ioredis';

const CHANNEL_PREFIX = 'sabnode:wachat:realtime:';

declare global {
  // eslint-disable-next-line no-var
  var __wachatRealtimePub: Redis | undefined;
}

/** Lazy-create the publisher connection. */
function getPublisher(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (globalThis.__wachatRealtimePub) return globalThis.__wachatRealtimePub;
  try {
    const pub = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    pub.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[wachat-realtime] redis publisher error:', err.message);
      }
    });
    globalThis.__wachatRealtimePub = pub;
    return pub;
  } catch {
    return null;
  }
}

export type WachatRealtimeEvent = {
  type: 'CONTACT_UPDATED' | 'NEW_MESSAGE' | 'CONVERSATION_READ' | 'BROADCAST_STATUS' | 'TEMPLATE_STATUS' | 'FLOW_UPDATED';
  projectId: string;
  payload: any;
};

/**
 * Publish a real-time UI event to a specific project.
 * This is meant strictly for UI sync (SSE clients), not for domain logic.
 */
export async function publishRealtimeEvent(event: WachatRealtimeEvent) {
  const pub = getPublisher();
  if (pub) {
    const channel = `${CHANNEL_PREFIX}${event.projectId}`;
    await pub.publish(channel, JSON.stringify(event)).catch(() => {
      // Best-effort push to UI.
    });
  }
}
