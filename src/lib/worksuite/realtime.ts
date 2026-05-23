import IORedis, { type Redis } from 'ioredis';

const CHANNEL_PREFIX = 'sabnode:worksuite:realtime:';

declare global {
  // eslint-disable-next-line no-var
  var __worksuiteRealtimePub: Redis | undefined;
}

/** Lazy-create the publisher connection. */
function getPublisher(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (globalThis.__worksuiteRealtimePub) return globalThis.__worksuiteRealtimePub;
  try {
    const pub = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    pub.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[worksuite-realtime] redis publisher error:', err.message);
      }
    });
    globalThis.__worksuiteRealtimePub = pub;
    return pub;
  } catch {
    return null;
  }
}

export type WorksuiteRealtimeEvent = {
  type: 'NEW_MESSAGE' | 'MESSAGE_READ' | 'TYPING' | 'NEW_NOTIFICATION';
  userId: string;
  payload: any;
};

/**
 * Publish a real-time UI event to a specific user's worksuite.
 */
export async function publishWorksuiteEvent(event: WorksuiteRealtimeEvent) {
  const pub = getPublisher();
  if (pub) {
    const channel = `${CHANNEL_PREFIX}${event.userId}`;
    await pub.publish(channel, JSON.stringify(event)).catch(() => {
      // Best-effort push to UI.
    });
  }
}
