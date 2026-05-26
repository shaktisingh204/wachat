'use server';

/**
 * SabKnow (sabchat-knowledge) Server Actions — thin wrappers around the
 * Rust BFF routes under `/v1/sabchat/kb`. Used by
 * `/dashboard/sabchat/knowledge` and any embedded portal-management UI.
 */

import { revalidatePath } from 'next/cache';
import { rustClient } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';
import type {
    KbArticleStatus,
    ListArticlesQuery,
} from '@/lib/rust-client/sabchat-knowledge';

const KB_PATH = '/dashboard/sabchat/knowledge';

function bust() {
    revalidatePath(KB_PATH);
}

function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Portals
// ---------------------------------------------------------------------------

export async function listPortals() {
    try {
        return await rustClient.sabchatKb.portals.list();
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function createPortal(formData: FormData) {
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return { error: 'Portal name is required' };
    const slug =
        String(formData.get('slug') ?? '').trim() || slugify(name);
    const defaultLanguage =
        String(formData.get('defaultLanguage') ?? '').trim() || 'en';
    const customDomain = String(formData.get('customDomain') ?? '').trim();
    const color = String(formData.get('color') ?? '').trim();

    try {
        const portal = await rustClient.sabchatKb.portals.create({
            name,
            slug,
            defaultLanguage,
            customDomain: customDomain || undefined,
            theme: color ? { color } : undefined,
        });
        bust();
        return { message: 'Portal created', data: portal };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deletePortal(id: string) {
    try {
        await rustClient.sabchatKb.portals.delete(id);
        bust();
        return { message: 'Portal deleted' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(portalId: string) {
    if (!portalId) return { items: [] as const };
    try {
        return await rustClient.sabchatKb.categories.list({ portalId });
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function createCategory(formData: FormData) {
    const portalId = String(formData.get('portalId') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    if (!portalId) return { error: 'portalId required' };
    if (!name) return { error: 'Category name required' };
    const slug =
        String(formData.get('slug') ?? '').trim() || slugify(name);
    const parentId = String(formData.get('parentId') ?? '').trim() || undefined;
    const sortRaw = String(formData.get('sortOrder') ?? '').trim();
    const sortOrder = sortRaw ? Number(sortRaw) : undefined;

    try {
        const cat = await rustClient.sabchatKb.categories.create({
            portalId,
            name,
            slug,
            parentId,
            sortOrder,
        });
        bust();
        return { message: 'Category created', data: cat };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCategory(id: string) {
    try {
        await rustClient.sabchatKb.categories.delete(id);
        bust();
        return { message: 'Category deleted' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function listArticles(params: ListArticlesQuery) {
    if (!params.portalId) return { items: [] as const };
    try {
        return await rustClient.sabchatKb.articles.list(params);
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

function parseTags(raw: string): string[] {
    return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
}

export async function createArticle(formData: FormData) {
    const portalId = String(formData.get('portalId') ?? '').trim();
    const title = String(formData.get('title') ?? '').trim();
    if (!portalId) return { error: 'portalId required' };
    if (!title) return { error: 'Title required' };

    const slug = String(formData.get('slug') ?? '').trim() || slugify(title);
    const body = String(formData.get('body') ?? '');
    const language = String(formData.get('language') ?? '').trim() || 'en';
    const tags = parseTags(String(formData.get('tags') ?? ''));
    const categoryId = String(formData.get('categoryId') ?? '').trim() || undefined;
    const status = (String(formData.get('status') ?? 'draft') as KbArticleStatus) || 'draft';

    try {
        const article = await rustClient.sabchatKb.articles.create({
            portalId,
            title,
            slug,
            body,
            language,
            tags,
            categoryId,
            status,
        });
        bust();
        return { message: 'Article created', data: article };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateArticle(id: string, formData: FormData) {
    if (!id) return { error: 'id required' };

    const title = String(formData.get('title') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();
    const body = formData.get('body');
    const language = String(formData.get('language') ?? '').trim();
    const tagsRaw = formData.get('tags');
    const categoryIdRaw = formData.get('categoryId');
    const statusRaw = formData.get('status');

    const patch: Record<string, unknown> = {};
    if (title) patch.title = title;
    if (slug) patch.slug = slug;
    if (body !== null && body !== undefined) patch.body = String(body);
    if (language) patch.language = language;
    if (tagsRaw !== null && tagsRaw !== undefined) patch.tags = parseTags(String(tagsRaw));
    if (categoryIdRaw !== null && categoryIdRaw !== undefined) {
        const c = String(categoryIdRaw).trim();
        patch.categoryId = c || undefined;
    }
    if (statusRaw) patch.status = String(statusRaw) as KbArticleStatus;

    try {
        const article = await rustClient.sabchatKb.articles.update(id, patch);
        bust();
        return { message: 'Article updated', data: article };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function publishArticle(id: string) {
    try {
        const article = await rustClient.sabchatKb.articles.publish(id);
        bust();
        return { message: 'Article published', data: article };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function archiveArticle(id: string) {
    try {
        const article = await rustClient.sabchatKb.articles.archive(id);
        bust();
        return { message: 'Article archived', data: article };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteArticle(id: string) {
    try {
        await rustClient.sabchatKb.articles.delete(id);
        bust();
        return { message: 'Article deleted' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
