'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

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

    revalidatePath('/dashboard/crm/tickets/knowledge-base');

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
    revalidatePath(`/dashboard/crm/tickets/knowledge-base/${articleId}`);
    revalidatePath('/dashboard/crm/tickets/knowledge-base');
    return { message: 'Article updated successfully.' };
  } catch (e: any) {
    return { error: e?.message ?? 'Failed to update article.' };
  }
}
