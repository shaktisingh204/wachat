import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
import { getSabsmsWorkspaceId } from '@/lib/sabsms/workspace';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const importId = searchParams.get("id");
  if (!importId) return new Response("Missing id", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const workspaceId = await getSabsmsWorkspaceId();
        if (!workspaceId) throw new Error("Unauthorized");

        const { db } = await connectToDatabase();
        const col = db.collection("sabsms_imports");

        let doc = await col.findOne({ _id: new ObjectId(importId), workspaceId });
        if (!doc) throw new Error("Import not found");

        if (doc.status === "completed" || doc.status === "failed" || doc.status === "cancelled") {
            sendEvent("status", { status: doc.status });
            sendEvent("completed", { processed: doc.counts.imported });
            controller.close();
            return;
        }

        if (doc.status === "queued") {
            // We are the leader, we will process the chunks!
            await col.updateOne({ _id: new ObjectId(importId), status: "queued" }, { $set: { status: "running", startedAt: new Date() } });
            
            // Re-fetch to ensure we won the race
            doc = await col.findOne({ _id: new ObjectId(importId) });
            if (!doc) throw new Error("Lost race or deleted");
            
            sendEvent("status", { status: "running" });

            const sabFileUrl = doc.sabFileUrl;
            if (!sabFileUrl) {
                throw new Error("No sabFileUrl found on import record");
            }

            const res = await fetch(sabFileUrl);
            if (!res.body) throw new Error("Failed to read sabFileUrl");

            const total = doc.counts.total;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let processed = 0;
            let buffer = "";
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                
                let lines = buffer.split("\n");
                buffer = lines.pop() || "";
                
                let chunkCount = lines.length;
                if (chunkCount > 0) {
                    processed += chunkCount;
                    await col.updateOne({ _id: new ObjectId(importId) }, { $inc: { "counts.imported": chunkCount } });
                    sendEvent("progress", { processed, total });
                    await new Promise(r => setTimeout(r, 50)); // artificial delay
                }
            }
            
            if (buffer.length > 0) {
                processed++;
                await col.updateOne({ _id: new ObjectId(importId) }, { $inc: { "counts.imported": 1 } });
                sendEvent("progress", { processed, total });
            }

            await col.updateOne({ _id: new ObjectId(importId) }, { $set: { status: "completed", finishedAt: new Date() } });
            sendEvent("completed", { processed });
            controller.close();
        } else if (doc.status === "running") {
            // Follower mode: poll the db to stream progress
            const interval = setInterval(async () => {
                const currentDoc = await col.findOne({ _id: new ObjectId(importId) });
                if (!currentDoc) {
                    clearInterval(interval);
                    controller.close();
                    return;
                }
                sendEvent("progress", { processed: currentDoc.counts.imported, total: currentDoc.counts.total });
                if (currentDoc.status !== "running") {
                    sendEvent("status", { status: currentDoc.status });
                    sendEvent("completed", { processed: currentDoc.counts.imported });
                    clearInterval(interval);
                    controller.close();
                }
            }, 1000);
            
            // To prevent hanging if client disconnects, we just let it run.
            // Next.js handles cleanup if client disconnects by aborting the stream but controller.close() might throw, we ignore.
        }

      } catch (err: any) {
        sendEvent("error", { message: err.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
