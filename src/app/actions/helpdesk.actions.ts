'use server';

/**
 * Helpdesk facade — single import surface for the Zoho-Desk-equivalent
 * helpdesk module (workspace, SLA policies, KB, ticket templates, support
 * portal). All work delegates to the existing per-entity action modules
 * (`crm/tickets.actions`, `crm-sla.actions`, `crm-knowledge-base.actions`,
 * `crm-reply-templates.actions`, `crm-kb-categories.actions`), which own
 * the Rust-BFF + Mongo fallback wiring.
 *
 * Adds:
 *   - `addTicketReply` / `addTicketInternalNote` — workspace composer.
 *   - `setTicketStatus` / `setTicketPriority` / `setTicketAssignee` —
 *     quick mutations from the properties panel.
 *   - `listSupportTicketsForRequester` — `/portal/support` listing.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';



/* ─── Workspace composer ──────────────────────────────────────── */

const TICKETS_COLL = 'crm_tickets';

type ActionResult = { success: boolean; error?: string };

function makeNote(body: string, authorId: string, isInternal: boolean): {
  _id: ObjectId;
  body: string;
  authorId: ObjectId;
  isInternal: boolean;
  createdAt: Date;
} {
  return {
    _id: new ObjectId(),
    body: body.trim(),
    authorId: new ObjectId(authorId),
    isInternal,
    createdAt: new Date(),
  };
}

/**
 * Append a public reply to a ticket's conversation. Visible to the
 * requester in `/portal/support` and re-sent via the original channel by
 * the outbound worker.
 */
export async function addTicketReply(
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  if (!ticketId || !ObjectId.isValid(ticketId)) {
    return { success: false, error: 'Invalid ticket id.' };
  }
  if (!body?.trim()) return { success: false, error: 'Reply body is required.' };

  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection(TICKETS_COLL).updateOne(
      {
        _id: new ObjectId(ticketId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $push: { internalNotes: makeNote(body, session.user._id as string, false) as never },
        $set: { updatedAt: new Date() },
      },
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Ticket not found.' };
    }
    revalidatePath(`/dashboard/sabdesk/${ticketId}`);
    revalidatePath('/dashboard/sabdesk/workspace');
    return { success: true };
  } catch (e) {
    console.error('[addTicketReply] failed:', e);
    return { success: false, error: 'Failed to post reply.' };
  }
}

/** Append a staff-only internal note (not visible to the requester). */
export async function addTicketInternalNote(
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  if (!ticketId || !ObjectId.isValid(ticketId)) {
    return { success: false, error: 'Invalid ticket id.' };
  }
  if (!body?.trim()) return { success: false, error: 'Note body is required.' };

  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection(TICKETS_COLL).updateOne(
      {
        _id: new ObjectId(ticketId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $push: { internalNotes: makeNote(body, session.user._id as string, true) as never },
        $set: { updatedAt: new Date() },
      },
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Ticket not found.' };
    }
    revalidatePath(`/dashboard/sabdesk/${ticketId}`);
    revalidatePath('/dashboard/sabdesk/workspace');
    return { success: true };
  } catch (e) {
    console.error('[addTicketInternalNote] failed:', e);
    return { success: false, error: 'Failed to post note.' };
  }
}

/* ─── Quick-mutation helpers (properties panel) ──────────────── */

const ALLOWED_STATUS = new Set(['open', 'pending', 'on_hold', 'resolved', 'closed', 'reopened']);
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high', 'urgent']);

export async function setTicketStatus(
  ticketId: string,
  status: string,
): Promise<ActionResult> {
  if (!ticketId || !ObjectId.isValid(ticketId)) {
    return { success: false, error: 'Invalid ticket id.' };
  }
  if (!ALLOWED_STATUS.has(status)) return { success: false, error: 'Invalid status.' };

  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection(TICKETS_COLL).updateOne(
      {
        _id: new ObjectId(ticketId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { status, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) return { success: false, error: 'Ticket not found.' };
    revalidatePath(`/dashboard/sabdesk/${ticketId}`);
    revalidatePath('/dashboard/sabdesk/workspace');
    return { success: true };
  } catch (e) {
    console.error('[setTicketStatus] failed:', e);
    return { success: false, error: 'Failed to set status.' };
  }
}

export async function setTicketPriority(
  ticketId: string,
  priority: string,
): Promise<ActionResult> {
  if (!ticketId || !ObjectId.isValid(ticketId)) {
    return { success: false, error: 'Invalid ticket id.' };
  }
  if (!ALLOWED_PRIORITY.has(priority)) return { success: false, error: 'Invalid priority.' };

  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection(TICKETS_COLL).updateOne(
      {
        _id: new ObjectId(ticketId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { priority, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) return { success: false, error: 'Ticket not found.' };
    revalidatePath(`/dashboard/sabdesk/${ticketId}`);
    revalidatePath('/dashboard/sabdesk/workspace');
    return { success: true };
  } catch (e) {
    console.error('[setTicketPriority] failed:', e);
    return { success: false, error: 'Failed to set priority.' };
  }
}

export async function setTicketAssignee(
  ticketId: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  if (!ticketId || !ObjectId.isValid(ticketId)) {
    return { success: false, error: 'Invalid ticket id.' };
  }
  if (assigneeId && !ObjectId.isValid(assigneeId)) {
    return { success: false, error: 'Invalid assignee id.' };
  }

  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const update = assigneeId
      ? { $set: { assigneeId: new ObjectId(assigneeId), updatedAt: new Date() } }
      : { $set: { updatedAt: new Date() }, $unset: { assigneeId: '' } };
    const res = await db.collection(TICKETS_COLL).updateOne(
      {
        _id: new ObjectId(ticketId),
        userId: new ObjectId(session.user._id as string),
      },
      update,
    );
    if (res.matchedCount === 0) return { success: false, error: 'Ticket not found.' };
    revalidatePath(`/dashboard/sabdesk/${ticketId}`);
    revalidatePath('/dashboard/sabdesk/workspace');
    return { success: true };
  } catch (e) {
    console.error('[setTicketAssignee] failed:', e);
    return { success: false, error: 'Failed to set assignee.' };
  }
}

/* ─── Support portal ─────────────────────────────────────────── */

interface SupportTicketRow {
  _id: string;
  subject: string;
  status: string;
  priority?: string;
  channel?: string;
  severity?: string;
  dueBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Lists tickets created by the calling user — used by `/portal/support`.
 * Scopes to `requesterId == session.user._id`, *not* `userId`, because the
 * portal user is a customer-side requester, not the tenant owner.
 */
export async function listSupportTicketsForRequester(): Promise<{
  tickets: SupportTicketRow[];
  error?: string;
}> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { tickets: [], error: 'Sign in to view your tickets.' };
  }

  try {
    const { db } = await connectToDatabase();
    const userId = String(session.user._id);
    const docs = await db
      .collection(TICKETS_COLL)
      .find(
        { requesterId: ObjectId.isValid(userId) ? new ObjectId(userId) : userId },
        {
          projection: {
            subject: 1,
            status: 1,
            priority: 1,
            channel: 1,
            severity: 1,
            dueBy: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const tickets: SupportTicketRow[] = docs.map((d) => ({
      _id: String(d._id),
      subject: String(d.subject ?? '(no subject)'),
      status: String(d.status ?? 'open'),
      priority: d.priority ? String(d.priority) : undefined,
      channel: d.channel ? String(d.channel) : undefined,
      severity: d.severity ? String(d.severity) : undefined,
      dueBy: d.dueBy ? new Date(d.dueBy).toISOString() : undefined,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : undefined,
    }));

    return { tickets };
  } catch (e) {
    console.error('[listSupportTicketsForRequester] failed:', e);
    return { tickets: [], error: 'Failed to load tickets.' };
  }
}

/**
 * Creates a self-service support ticket on behalf of the portal user.
 * Always scoped with `channel = 'portal'` so the staff workspace can
 * filter portal-originated tickets.
 */
export async function createSupportTicket(input: {
  subject: string;
  body: string;
  priority?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Sign in to create a ticket.' };

  const subject = input.subject?.trim();
  const body = input.body?.trim();
  if (!subject) return { success: false, error: 'Subject is required.' };
  if (!body) return { success: false, error: 'Describe your issue.' };

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const requesterId = String(session.user._id);
    const tenantOwnerId =
      (session.user as { tenantOwnerId?: string; ownerId?: string }).tenantOwnerId ??
      (session.user as { tenantOwnerId?: string; ownerId?: string }).ownerId ??
      requesterId;

    const note = makeNote(body, requesterId, false);

    const insert = await db.collection(TICKETS_COLL).insertOne({
      userId: ObjectId.isValid(tenantOwnerId) ? new ObjectId(tenantOwnerId) : tenantOwnerId,
      subject,
      requesterId: ObjectId.isValid(requesterId) ? new ObjectId(requesterId) : requesterId,
      channel: 'portal',
      severity: 'sev3',
      priority: ALLOWED_PRIORITY.has(input.priority ?? '') ? input.priority : 'medium',
      status: 'open',
      internalNotes: [note],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath('/portal/support');
    revalidatePath('/dashboard/sabdesk');
    revalidatePath('/dashboard/sabdesk/workspace');

    return { success: true, id: String(insert.insertedId) };
  } catch (e) {
    console.error('[createSupportTicket] failed:', e);
    return { success: false, error: 'Failed to create ticket.' };
  }
}
