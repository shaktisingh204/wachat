'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmKbArticlesApi } from '@/lib/rust-client/crm-kb-articles';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

interface KbArticleDoc {
  _id: string;
  title?: string;
  slug?: string;
  body?: string;
  category?: string;
  tags?: string[];
  visibility?: 'public' | 'portal' | 'internal' | string;
  status?: 'draft' | 'published' | 'archived' | string;
  helpfulCount?: number;
  helpfulYes?: number;
  helpfulNo?: number;
  viewCount?: number;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastReviewedAt?: string;
  /** Optional related article ids (entity refs). */
  relatedArticles?: string[];
  /** SEO meta fields. */
  seoTitle?: string;
  seoDescription?: string;
}

interface KbListResult {
  articles: KbArticleDoc[];
  error?: string;
}

/**
 * List KB articles for the current tenant.
 *
 * Returns the recently-updated articles up to `limit` (default 200). The
 * UI applies filtering / search / pagination client-side because the
 * dataset is small enough to ship in one round trip.
 */
export async function listKbArticles(
  limit = 200,
): Promise<KbListResult> {
  const session = await getSession();
  if (!session?.user?._id) return { articles: [], error: 'Access denied' };
  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id);
    const docs = await db
      .collection('crm_kb_articles')
      .find({ userId: userObjectId } as any)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .toArray();
    const articles = JSON.parse(JSON.stringify(docs)) as KbArticleDoc[];
    return { articles };
  } catch (e: any) {
    return { articles: [], error: e?.message ?? 'Failed to load articles.' };
  }
}

/** Hard-delete a KB article. */
export async function deleteKbArticle(
  articleId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(articleId)) return { success: false, error: 'Invalid ID.' };
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_kb_articles').deleteOne({
      _id: new ObjectId(articleId),
      userId: new ObjectId(session.user._id),
    } as any);
    if (res.deletedCount === 0) return { success: false, error: 'Not found.' };
    revalidatePath('/dashboard/sabdesk/knowledge-base');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to delete.' };
  }
}

/** Flip published / draft / archived without going through the form. */
export async function setKbArticleStatus(
  articleId: string,
  status: 'draft' | 'published' | 'archived',
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(articleId)) return { success: false, error: 'Invalid ID.' };
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_kb_articles').updateOne(
      {
        _id: new ObjectId(articleId),
        userId: new ObjectId(session.user._id),
      } as any,
      { $set: { status, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) return { success: false, error: 'Not found.' };
    revalidatePath('/dashboard/sabdesk/knowledge-base');
    revalidatePath(`/dashboard/sabdesk/knowledge-base/${articleId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to update.' };
  }
}

/** Record a helpful/not-helpful vote on an article. */
export async function recordKbHelpfulVote(
  articleId: string,
  helpful: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(articleId)) return { success: false, error: 'Invalid ID.' };
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };
  try {
    const { db } = await connectToDatabase();
    const inc = helpful ? { helpfulYes: 1, helpfulCount: 1 } : { helpfulNo: 1 };
    const res = await db.collection('crm_kb_articles').updateOne(
      {
        _id: new ObjectId(articleId),
        userId: new ObjectId(session.user._id),
      } as any,
      { $inc: inc as any, $set: { updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) return { success: false, error: 'Not found.' };
    revalidatePath(`/dashboard/sabdesk/knowledge-base/${articleId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to record vote.' };
  }
}

/** Increment view count. Fire-and-forget on detail page mount. */
export async function recordKbView(
  articleId: string,
): Promise<{ success: boolean }> {
  if (!ObjectId.isValid(articleId)) return { success: false };
  const session = await getSession();
  if (!session?.user?._id) return { success: false };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_kb_articles').updateOne(
      {
        _id: new ObjectId(articleId),
        userId: new ObjectId(session.user._id),
      } as any,
      { $inc: { viewCount: 1 } as any },
    );
    return { success: true };
  } catch {
    return { success: false };
  }
}

/** Bulk publish / unpublish / delete. */
export async function bulkKbAction(
  ids: string[],
  op: 'publish' | 'unpublish' | 'delete',
): Promise<{ success: boolean; processed: number; error?: string }> {
  const valid = ids.filter((id) => ObjectId.isValid(id));
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No valid IDs.' };
  }
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  try {
    const { db } = await connectToDatabase();
    const objIds = valid.map((id) => new ObjectId(id));
    const filter = {
      _id: { $in: objIds },
      userId: new ObjectId(session.user._id),
    } as any;
    if (op === 'delete') {
      const res = await db.collection('crm_kb_articles').deleteMany(filter);
      revalidatePath('/dashboard/sabdesk/knowledge-base');
      return { success: true, processed: res.deletedCount ?? 0 };
    }
    const nextStatus = op === 'publish' ? 'published' : 'draft';
    const res = await db.collection('crm_kb_articles').updateMany(filter, {
      $set: { status: nextStatus, updatedAt: new Date() },
    });
    revalidatePath('/dashboard/sabdesk/knowledge-base');
    return { success: true, processed: res.modifiedCount ?? 0 };
  } catch (e: any) {
    return { success: false, processed: 0, error: e?.message ?? 'Bulk failed.' };
  }
}

export async function saveKbArticle(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied' };

  try {
    const title = (formData.get('title') as string | null)?.trim() ?? '';
    if (!title) return { error: 'Title is required.' };

    const body = (formData.get('body') as string | null)?.trim() ?? '';
    if (!body) return { error: 'Article content is required.' };

    const rawSlug = (formData.get('slug') as string | null)?.trim();
    const slug = rawSlug
      ? rawSlug
      : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
        '-' +
        Date.now().toString().slice(-4);

    const category = (formData.get('category') as string | null)?.trim() || undefined;

    const rawTags = (formData.get('tags') as string | null)?.trim() || '';
    const tags: string[] = rawTags
      ? rawTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const visibility =
      (formData.get('visibility') as string | null) || 'internal';
    const status = (formData.get('status') as string | null) || 'draft';

    const rawOwnerId = (formData.get('ownerId') as string | null)?.trim();
    const ownerId = rawOwnerId || session.user._id;

    const now = new Date();
    const doc = {
      userId: new ObjectId(session.user._id),
      title,
      slug,
      ...(category ? { category } : {}),
      body,
      tags,
      visibility,
      status,
      ownerId,
      helpfulCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const { db } = await connectToDatabase();
    const result = await db.collection('crm_kb_articles').insertOne(doc as any);

    revalidatePath('/dashboard/sabdesk/knowledge-base');

    return {
      message: 'Article saved successfully.',
      id: result.insertedId.toString(),
    };
  } catch (e: any) {
    console.error('saveKbArticle error:', e);
    return { error: e?.message ?? 'Failed to save article. Please try again.' };
  }
}

export async function getKbArticleById(
  articleId: string,
): Promise<Record<string, any> | null> {
  if (!ObjectId.isValid(articleId)) return null;
  const session = await getSession();
  if (!session?.user?._id) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmKbArticlesApi.getById(articleId);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getKbArticleById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'kb_article',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  const { db } = await connectToDatabase();
  const doc = await db.collection('crm_kb_articles').findOne({
    _id: new ObjectId(articleId),
    userId: new ObjectId(session.user._id),
  } as any);
  return doc ? JSON.parse(JSON.stringify(doc)) : null;
}

export async function updateKbArticle(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const articleId = (formData.get('articleId') as string | null)?.trim() || '';
  if (!ObjectId.isValid(articleId)) return { error: 'Invalid article ID.' };

  const title = (formData.get('title') as string | null)?.trim() ?? '';
  if (!title) return { error: 'Title is required.' };
  const body = (formData.get('body') as string | null)?.trim() ?? '';
  if (!body) return { error: 'Article content is required.' };

  const rawSlug = (formData.get('slug') as string | null)?.trim();
  const slug = rawSlug
    ? rawSlug
    : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const category = (formData.get('category') as string | null)?.trim() || undefined;
  const rawTags = (formData.get('tags') as string | null)?.trim() || '';
  const tags = rawTags ? rawTags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const visibility = (formData.get('visibility') as string | null) || 'internal';
  const status = (formData.get('status') as string | null) || 'draft';

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_kb_articles').updateOne(
      {
        _id: new ObjectId(articleId),
        userId: new ObjectId(session.user._id),
      } as any,
      {
        $set: {
          title,
          slug,
          body,
          ...(category ? { category } : {}),
          tags,
          visibility,
          status,
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 0) return { error: 'Article not found.' };
    revalidatePath(`/dashboard/sabdesk/knowledge-base/${articleId}`);
    revalidatePath('/dashboard/sabdesk/knowledge-base');
    return { message: 'Article updated successfully.' };
  } catch (e: any) {
    return { error: e?.message ?? 'Failed to update article.' };
  }
}
