'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrListPaginated,
  hrGetById,
  hrSave,
  hrDelete,
  formToObject,
  requireSession,
  serialize,
} from '@/lib/hr-crud';
import type {
  WsKnowledgeBase,
  WsKnowledgeBaseCategory,
  WsKnowledgeBaseFile,
  WsNotice,
  WsNoticeFile,
  WsNoticeView,
  WsEvent,
  WsEventAttendee,
  WsEventFile,
  WsDiscussion,
  WsDiscussionCategory,
  WsDiscussionReply,
  WsDiscussionFile,
  WsAward,
  WsAppreciation,
  WsStickyNote,
  WsEventAttendeeStatus,
} from '@/lib/worksuite/knowledge-types';

/**
 * Worksuite knowledge/collaboration actions.
 *
 * Mirror the HR CRUD style: generic `save*` signatures are
 * `(prev, formData) => { message?, error?, id? }` so they can plug
 * into `useActionState` and the existing `HrEntityPage` abstraction.
 */

type FormState = { message?: string; error?: string; id?: string };

const COLS = {
  kb: 'crm_knowledge_bases',
  kbCat: 'crm_kb_categories',
  kbFile: 'crm_kb_files',
  notice: 'crm_notices',
  noticeFile: 'crm_notice_files',
  noticeView: 'crm_notice_views',
  event: 'crm_events',
  eventAttendee: 'crm_event_attendees',
  eventFile: 'crm_event_files',
  discussion: 'crm_discussions',
  discussionCat: 'crm_discussion_categories',
  discussionReply: 'crm_discussion_replies',
  discussionFile: 'crm_discussion_files',
  award: 'crm_awards',
  appreciation: 'crm_appreciations',
  stickyNote: 'crm_sticky_notes',
} as const;

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    boolKeys?: string[];
    jsonKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    for (const k of options.boolKeys || []) {
      if (data[k] !== undefined) {
        const v = String(data[k]).toLowerCase();
        data[k] = v === 'true' || v === 'yes' || v === '1' || v === 'on';
      }
    }
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* ignore */
        }
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ═══════════════════ Knowledge Base ═══════════════════ */

export async function getKnowledgeBases() {
  return hrList<WsKnowledgeBase>(COLS.kb, { sortBy: { pinned: -1, createdAt: -1 } });
}
export async function getKnowledgeBaseById(id: string) {
  return hrGetById<WsKnowledgeBase>(COLS.kb, id);
}
export async function saveKnowledgeBase(_prev: any, formData: FormData) {
  return genericSave(COLS.kb, '/dashboard/crm/workspace/knowledge-base', formData, {
    idFields: ['category_id'],
    boolKeys: ['pinned'],
  });
}
export async function deleteKnowledgeBase(id: string) {
  const r = await hrDelete(COLS.kb, id);
  revalidatePath('/dashboard/crm/workspace/knowledge-base');
  return r;
}
export async function togglePinKnowledgeBase(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const current = await db
    .collection(COLS.kb)
    .findOne({ _id: new ObjectId(id), userId: new ObjectId(user._id) });
  if (!current) return { success: false, error: 'Not found' };
  await db
    .collection(COLS.kb)
    .updateOne({ _id: new ObjectId(id) }, { $set: { pinned: !current.pinned } });
  revalidatePath('/dashboard/crm/workspace/knowledge-base');
  return { success: true };
}

export async function getKnowledgeBaseCategories() {
  return hrList<WsKnowledgeBaseCategory>(COLS.kbCat, { sortBy: { name: 1 } });
}
export async function saveKnowledgeBaseCategory(_prev: any, formData: FormData) {
  return genericSave(COLS.kbCat, '/dashboard/crm/workspace/knowledge-base/categories', formData);
}
export async function deleteKnowledgeBaseCategory(id: string) {
  const r = await hrDelete(COLS.kbCat, id);
  revalidatePath('/dashboard/crm/workspace/knowledge-base/categories');
  return r;
}

export async function getKnowledgeBaseFiles(kbId: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.kbFile)
    .find({ kb_id: kbId, userId: new ObjectId(user._id) })
    .toArray();
  return serialize(docs) as unknown as WsKnowledgeBaseFile[];
}

/* ═══════════════════ Notices ═══════════════════ */

export async function getNotices() {
  return hrList<WsNotice>(COLS.notice, { sortBy: { pinned: -1, createdAt: -1 } });
}
export async function getNoticeById(id: string) {
  return hrGetById<WsNotice>(COLS.notice, id);
}
export async function saveNotice(_prev: any, formData: FormData) {
  return genericSave(COLS.notice, '/dashboard/crm/workspace/notices', formData, {
    boolKeys: ['file_attached', 'pinned'],
    jsonKeys: ['employee_ids'],
    idFields: ['department_id'],
  });
}
export async function deleteNotice(id: string) {
  const r = await hrDelete(COLS.notice, id);
  revalidatePath('/dashboard/crm/workspace/notices');
  return r;
}

export async function markNoticeViewed(noticeId: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(noticeId)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.noticeView).updateOne(
    {
      notice_id: noticeId,
      user_id: user._id,
      userId: new ObjectId(user._id),
    },
    {
      $set: {
        notice_id: noticeId,
        user_id: user._id,
        userId: new ObjectId(user._id),
        viewed_at: new Date(),
      },
    },
    { upsert: true },
  );
  revalidatePath(`/dashboard/crm/workspace/notices/${noticeId}`);
  return { success: true };
}

export async function getNoticeViewsForUser() {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.noticeView)
    .find({ user_id: user._id, userId: new ObjectId(user._id) })
    .toArray();
  return serialize(docs) as unknown as WsNoticeView[];
}

/* ═══════════════════ Events ═══════════════════ */

export async function getEvents() {
  return hrList<WsEvent>(COLS.event, { sortBy: { start_date_time: 1 } });
}
export async function getEventById(id: string) {
  return hrGetById<WsEvent>(COLS.event, id);
}
export async function saveEvent(_prev: any, formData: FormData) {
  return genericSave(COLS.event, '/dashboard/crm/workspace/events', formData, {
    dateFields: ['start_date_time', 'end_date_time'],
    numericKeys: ['repeat_every', 'repeat_cycles', 'remind_time'],
    boolKeys: ['repeat', 'send_reminder', 'google_calendar'],
  });
}
export async function deleteEvent(id: string) {
  const r = await hrDelete(COLS.event, id);
  revalidatePath('/dashboard/crm/workspace/events');
  return r;
}

export async function getEventAttendees(eventId: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.eventAttendee)
    .find({ event_id: eventId, userId: new ObjectId(user._id) })
    .toArray();
  return serialize(docs) as unknown as WsEventAttendee[];
}

export async function rsvpEvent(eventId: string, status: WsEventAttendeeStatus) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(eventId)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(COLS.eventAttendee).updateOne(
    {
      event_id: eventId,
      user_id: user._id,
      userId: new ObjectId(user._id),
    },
    {
      $set: {
        event_id: eventId,
        user_id: user._id,
        userId: new ObjectId(user._id),
        status,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  revalidatePath(`/dashboard/crm/workspace/events/${eventId}`);
  return { success: true };
}

/* ═══════════════════ Discussions ═══════════════════ */

export async function getDiscussions() {
  return hrList<WsDiscussion>(COLS.discussion);
}
export async function getDiscussionById(id: string) {
  return hrGetById<WsDiscussion>(COLS.discussion, id);
}
export async function saveDiscussion(_prev: any, formData: FormData) {
  return genericSave(COLS.discussion, '/dashboard/crm/workspace/discussions', formData, {
    idFields: ['category_id', 'project_id'],
  });
}
export async function deleteDiscussion(id: string) {
  const r = await hrDelete(COLS.discussion, id);
  revalidatePath('/dashboard/crm/workspace/discussions');
  return r;
}

export async function getDiscussionCategories() {
  return hrList<WsDiscussionCategory>(COLS.discussionCat, { sortBy: { name: 1 } });
}
export async function saveDiscussionCategory(_prev: any, formData: FormData) {
  return genericSave(COLS.discussionCat, '/dashboard/crm/workspace/discussions/categories', formData);
}
export async function deleteDiscussionCategory(id: string) {
  const r = await hrDelete(COLS.discussionCat, id);
  revalidatePath('/dashboard/crm/workspace/discussions/categories');
  return r;
}

export async function getDiscussionReplies(discussionId: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.discussionReply)
    .find({ discussion_id: discussionId, userId: new ObjectId(user._id) })
    .sort({ createdAt: 1 })
    .toArray();
  return serialize(docs) as unknown as WsDiscussionReply[];
}

export async function addDiscussionReply(
  discussionId: string,
  body: string,
  parentReplyId?: string,
) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!body?.trim()) return { success: false, error: 'Body required' };
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(COLS.discussionReply).insertOne({
    discussion_id: discussionId,
    user_id: user._id,
    user_name: user._id, // display name unavailable here — UI can hydrate
    body: body.trim(),
    parent_reply_id: parentReplyId,
    userId: new ObjectId(user._id),
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath(`/dashboard/crm/workspace/discussions/${discussionId}`);
  return { success: true };
}

export async function deleteDiscussionReply(id: string) {
  const r = await hrDelete(COLS.discussionReply, id);
  return r;
}

/* ═══════════════════ Awards & Appreciations ═══════════════════ */

export async function getAwards() {
  return hrList<WsAward>(COLS.award, { sortBy: { createdAt: -1 } });
}
export async function getAwardById(id: string) {
  return hrGetById<WsAward>(COLS.award, id);
}
export async function saveAward(_prev: any, formData: FormData) {
  return genericSave(COLS.award, '/dashboard/crm/workspace/awards', formData);
}
export async function deleteAward(id: string) {
  const r = await hrDelete(COLS.award, id);
  revalidatePath('/dashboard/crm/workspace/awards');
  return r;
}

export async function getAppreciationsPaginated(skip = 0, limit = 20) {
  return hrListPaginated<WsAppreciation>(COLS.appreciation, { sortBy: { given_on: -1 }, skip, limit });
}
export async function getAppreciations() {
  return hrList<WsAppreciation>(COLS.appreciation, { sortBy: { given_on: -1 } });
}
export async function getAppreciationsByAward(awardId: string) {
  return hrList<WsAppreciation>(COLS.appreciation, { 
    sortBy: { given_on: -1 }, 
    extraFilter: { award_id: awardId } 
  });
}
export async function getAppreciationById(id: string) {
  return hrGetById<WsAppreciation>(COLS.appreciation, id);
}
export async function saveAppreciation(_prev: any, formData: FormData) {
  return genericSave(COLS.appreciation, '/dashboard/crm/workspace/awards/appreciations', formData, {
    idFields: ['award_id'],
    dateFields: ['given_on'],
  });
}
export async function deleteAppreciation(id: string) {
  const r = await hrDelete(COLS.appreciation, id);
  revalidatePath('/dashboard/crm/workspace/awards/appreciations');
  return r;
}

/* ═══════════════════ Sticky Notes ═══════════════════ */

export async function getStickyNotes() {
  return hrList<WsStickyNote>(COLS.stickyNote, { sortBy: { pinned: -1, createdAt: -1 } });
}
export async function getStickyNoteById(id: string) {
  return hrGetById<WsStickyNote>(COLS.stickyNote, id);
}
export async function saveStickyNote(_prev: any, formData: FormData) {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  // Default belongs_to_user_id to the session user when absent.
  if (!formData.get('belongs_to_user_id')) {
    formData.set('belongs_to_user_id', user._id);
  }
  return genericSave(COLS.stickyNote, '/dashboard/crm/workspace/sticky-notes', formData, {
    boolKeys: ['pinned'],
  });
}
export async function deleteStickyNote(id: string) {
  const r = await hrDelete(COLS.stickyNote, id);
  revalidatePath('/dashboard/crm/workspace/sticky-notes');
  return r;
}
/* ═══════════════════ KPI helpers ═══════════════════ */

export interface AwardKpis {
    totalPrograms: number;
    thisMonth: number;
    uniqueRecipients: number;
    awardTypes: number;
}

export async function getAwardKpis(): Promise<AwardKpis> {
    const user = await requireSession();
    if (!user) return { totalPrograms: 0, thisMonth: 0, uniqueRecipients: 0, awardTypes: 0 };
    const [awards, apps] = await Promise.all([
        hrList<WsAward>(COLS.award, { sortBy: { createdAt: -1 } }),
        hrList<WsAppreciation>(COLS.appreciation, { sortBy: { given_on: -1 } }),
    ]);
    const now = new Date();
    let thisMonth = 0;
    for (const a of apps) {
        const d = new Date(a.given_on as string);
        if (
            Number.isFinite(d.getTime()) &&
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth()
        ) {
            thisMonth += 1;
        }
    }
    const uniqueRecipients = new Set(apps.map((a) => a.given_to_user_id)).size;
    const awardTypes = new Set(awards.map((a) => a.frequency)).size;
    return {
        totalPrograms: awards.length,
        thisMonth,
        uniqueRecipients,
        awardTypes,
    };
}

export interface DiscussionKpis {
    total: number;
    open: number;
    closed: number;
    repliesThisWeek: number;
}

export async function getDiscussionKpis(): Promise<DiscussionKpis> {
    const user = await requireSession();
    if (!user) return { total: 0, open: 0, closed: 0, repliesThisWeek: 0 };
    const { db } = await connectToDatabase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [discussions, recentReplies] = await Promise.all([
        hrList<WsDiscussion>(COLS.discussion),
        db
            .collection(COLS.discussionReply)
            .countDocuments({
                userId: new ObjectId(user._id),
                createdAt: { $gte: sevenDaysAgo },
            }),
    ]);
    let open = 0;
    let closed = 0;
    // Without an explicit status field, treat discussions with no replies
    // as "open" (pending). We track this from the list since we cannot
    // efficiently join per-discussion reply count server-side in this helper.
    // Discussions that have been updated recently are treated as open.
    for (const d of discussions) {
        const updated = d.updatedAt ? new Date(d.updatedAt as string) : null;
        if (updated && Date.now() - updated.getTime() < 30 * 24 * 60 * 60 * 1000) {
            open += 1;
        } else {
            closed += 1;
        }
    }
    return {
        total: discussions.length,
        open,
        closed,
        repliesThisWeek: recentReplies,
    };
}

export interface EventKpis {
    total: number;
    upcoming: number;
    todayCount: number;
    pastThisMonth: number;
}

export async function getEventKpis(): Promise<EventKpis> {
    const user = await requireSession();
    if (!user) return { total: 0, upcoming: 0, todayCount: 0, pastThisMonth: 0 };
    const events = await hrList<WsEvent>(COLS.event, { sortBy: { start_date_time: 1 } });
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let upcoming = 0;
    let todayCount = 0;
    let pastThisMonth = 0;
    for (const e of events) {
        const start = new Date(e.start_date_time as string);
        if (!Number.isFinite(start.getTime())) continue;
        if (start >= endOfDay) upcoming += 1;
        if (start >= startOfDay && start <= endOfDay) todayCount += 1;
        if (start < startOfDay && start >= startOfMonth) pastThisMonth += 1;
    }
    return { total: events.length, upcoming, todayCount, pastThisMonth };
}

export interface NoticeKpis {
    total: number;
    active: number;
    expired: number;
    expiringIn7Days: number;
}

export async function getNoticeKpis(): Promise<NoticeKpis> {
    const user = await requireSession();
    if (!user) return { total: 0, active: 0, expired: 0, expiringIn7Days: 0 };
    const notices = await hrList<WsNotice>(COLS.notice, { sortBy: { pinned: -1, createdAt: -1 } });
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    let active = 0;
    let expired = 0;
    let expiringIn7Days = 0;
    for (const n of notices) {
        const created = n.createdAt ? new Date(n.createdAt as string).getTime() : null;
        if (created === null) {
            active += 1;
            continue;
        }
        const age = now - created;
        if (age > ninetyDays) {
            expired += 1;
        } else {
            active += 1;
            const remaining = ninetyDays - age;
            if (remaining <= sevenDays) expiringIn7Days += 1;
        }
    }
    return { total: notices.length, active, expired, expiringIn7Days };
}

/* ═══════════════════ Bulk Knowledge Base ops ═══════════════════ */

export interface KbKpis {
    total: number;
    published: number;
    drafts: number;
    archived: number;
}

export async function getKbKpis(): Promise<KbKpis> {
    const user = await requireSession();
    if (!user) return { total: 0, published: 0, drafts: 0, archived: 0 };
    const articles = await hrList<WsKnowledgeBase>(COLS.kb, { sortBy: { createdAt: -1 } });
    let published = 0;
    let archived = 0;
    for (const a of articles) {
        if ((a as WsKnowledgeBase & { archived?: boolean }).archived) {
            archived += 1;
        } else if (a.pinned) {
            published += 1;
        }
    }
    const drafts = articles.length - published - archived;
    return {
        total: articles.length,
        published,
        drafts: Math.max(0, drafts),
        archived,
    };
}

export async function bulkPublishKbArticles(
    ids: string[],
): Promise<{ updated: number; failed: number; error?: string }> {
    const user = await requireSession();
    if (!user) return { updated: 0, failed: ids.length, error: 'Access denied' };
    const { ObjectId: OId } = await import('mongodb');
    const oids = ids.filter((id) => OId.isValid(id)).map((id) => new OId(id));
    if (oids.length === 0) return { updated: 0, failed: ids.length };
    const { db } = await connectToDatabase();
    const r = await db.collection(COLS.kb).updateMany(
        { _id: { $in: oids }, userId: new OId(user._id) },
        { $set: { pinned: true, archived: false, updatedAt: new Date() } },
    );
    revalidatePath('/dashboard/crm/workspace/knowledge-base');
    return { updated: r.modifiedCount, failed: Math.max(0, ids.length - r.modifiedCount) };
}

export async function bulkArchiveKbArticles(
    ids: string[],
): Promise<{ updated: number; failed: number; error?: string }> {
    const user = await requireSession();
    if (!user) return { updated: 0, failed: ids.length, error: 'Access denied' };
    const { ObjectId: OId } = await import('mongodb');
    const oids = ids.filter((id) => OId.isValid(id)).map((id) => new OId(id));
    if (oids.length === 0) return { updated: 0, failed: ids.length };
    const { db } = await connectToDatabase();
    const r = await db.collection(COLS.kb).updateMany(
        { _id: { $in: oids }, userId: new OId(user._id) },
        { $set: { archived: true, pinned: false, updatedAt: new Date() } },
    );
    revalidatePath('/dashboard/crm/workspace/knowledge-base');
    return { updated: r.modifiedCount, failed: Math.max(0, ids.length - r.modifiedCount) };
}

export async function bulkDeleteKbArticles(
    ids: string[],
): Promise<{ deleted: number; failed: number; error?: string }> {
    const { hrBulkDelete } = await import('@/lib/hr-crud');
    const r = await hrBulkDelete(COLS.kb, ids);
    revalidatePath('/dashboard/crm/workspace/knowledge-base');
    if (!r.success) return { deleted: 0, failed: ids.length, error: r.error };
    return { deleted: r.deleted, failed: Math.max(0, ids.length - r.deleted) };
}

export async function togglePinStickyNote(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const current = await db
    .collection(COLS.stickyNote)
    .findOne({ _id: new ObjectId(id), userId: new ObjectId(user._id) });
  if (!current) return { success: false, error: 'Not found' };
  await db
    .collection(COLS.stickyNote)
    .updateOne({ _id: new ObjectId(id) }, { $set: { pinned: !current.pinned } });
  revalidatePath('/dashboard/crm/workspace/sticky-notes');
  return { success: true };
}
