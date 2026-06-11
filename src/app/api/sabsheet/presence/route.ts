/**
 * Presence heartbeat — the client POSTs its cursor here (~every 1.5s while editing). The server stamps
 * the user id/name/color and stores it with a short TTL; the SSE stream fans it out to collaborators.
 */
import { getSession } from "@/app/actions/user.actions";
import { setPresence } from "@/lib/sabsheet/collab/presence-store.server";
import { colorForUser, type PresenceInput } from "@/lib/sabsheet/collab/presence";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session?.user?._id) return new Response("unauthorized", { status: 401 });
  const userId = String(session.user._id);

  let body: { workbookId?: string; cursor?: PresenceInput };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const { workbookId, cursor } = body;
  if (!workbookId || !cursor) return new Response("workbookId + cursor required", { status: 400 });

  await setPresence(workbookId, {
    ...cursor,
    userId,
    name: session.user.name || session.user.email || "Someone",
    color: colorForUser(userId),
  });
  return new Response(null, { status: 204 });
}
