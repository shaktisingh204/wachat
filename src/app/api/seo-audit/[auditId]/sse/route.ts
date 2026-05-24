import { NextRequest } from 'next/server';
import { getAuditStatus } from '@/app/actions/seo-audit.actions';

export async function GET(request: NextRequest, { params }: { params: Promise<{ auditId: string }> }) {
    const { auditId } = await params;

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            let isRunning = true;

            // Optional timeout so we don't leak forever
            const timeout = setTimeout(() => {
                isRunning = false;
                controller.close();
            }, 60000 * 5); // 5 mins

            while (isRunning) {
                try {
                    const status = await getAuditStatus(auditId);
                    sendEvent(status);

                    if (status.status === 'completed' || status.status === 'failed') {
                        isRunning = false;
                        clearTimeout(timeout);
                        controller.close();
                        break;
                    }

                    await new Promise((resolve) => setTimeout(resolve, 2000));
                } catch (err) {
                    controller.error(err);
                    isRunning = false;
                    clearTimeout(timeout);
                }
            }
        },
        cancel() {
            // Client closed connection
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
