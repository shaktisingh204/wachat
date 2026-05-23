import { NextRequest } from 'next/server';
import IORedis from 'ioredis';
import { getProjectForUser } from '@/lib/auth/project-auth'; // assuming project auth

export const dynamic = 'force-dynamic';

const CHANNEL_PREFIX = 'sabnode:wachat:realtime:';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  
  if (!projectId) {
    return new Response('Missing projectId', { status: 400 });
  }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('No REDIS_URL found, SSE disabled.');
    return new Response('SSE Disabled', { status: 503 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sub = new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      const channel = `${CHANNEL_PREFIX}${projectId}`;

      sub.on('message', (chan, message) => {
        if (chan === channel) {
          controller.enqueue(`data: ${message}\n\n`);
        }
      });

      sub.on('error', (err) => {
        console.error('SSE Redis Subscriber Error:', err);
      });

      try {
        await sub.subscribe(channel);
        // Send initial heartbeat to establish connection
        controller.enqueue(`: ping\n\n`);
        
        // Keep connection alive with a ping every 30 seconds
        const interval = setInterval(() => {
          controller.enqueue(`: ping\n\n`);
        }, 30000);

        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          sub.unsubscribe(channel);
          sub.quit();
          controller.close();
        });
      } catch (err) {
        console.error('SSE Sub Failed:', err);
        sub.quit();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
