import { NextRequest } from "next/server";
import { getCachedSession } from "@/lib/server-cache";
import { connectToDatabase } from "@/lib/mongodb";
import { getSabFlowsByUserId } from "@/lib/sabflow/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user?._id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user._id;

  const stream = new ReadableStream({
    async start(controller) {
      const { db } = await connectToDatabase();
      const col = db.collection("sabflow_executions");
      
      const flows = await getSabFlowsByUserId(userId);
      const flowIds = flows.map((f: any) => f._id.toString());
      
      if (flowIds.length === 0) {
        // Nothing to track, but keep connection alive
        const interval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
          } catch (e) {
            clearInterval(interval);
          }
        }, 15000);

        req.signal.addEventListener("abort", () => {
          clearInterval(interval);
        });
        return;
      }

      // Check for changes periodically
      let lastCheck = new Date();
      
      const interval = setInterval(async () => {
        try {
          const now = new Date();
          const query = {
            flowId: { $in: flowIds },
            startedAt: { $gt: lastCheck },
          };
          
          const newDocs = await col.find(query).toArray();
          if (newDocs.length > 0) {
            const data = JSON.stringify({ type: "update" });
            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
            lastCheck = now;
          } else {
            // Also check for status changes of recent executions (last 1 hour)
            const recentQuery = {
              flowId: { $in: flowIds },
              startedAt: { $gt: new Date(now.getTime() - 60 * 60 * 1000) }
            };
            const recentDocs = await col.find(recentQuery).toArray();
            const hasChanges = recentDocs.some(doc => doc.status === 'completed' || doc.status === 'failed' || doc.status === 'error' || doc.status === 'success'); 
            // In a real app we'd compare against previous states.
            // For now, if we don't have new docs, just keep alive or send an update if we want to be safe.
            controller.enqueue(new TextEncoder().encode(`: keep-alive\n\n`));
          }
        } catch (e) {
          console.error("SSE Error:", e);
        }
      }, 3000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch (e) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
