'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
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

export async function getAppreciations() {
  return hrList<WsAppreciation>(COLS.appreciation, { sortBy: { given_on: -1 } });
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
