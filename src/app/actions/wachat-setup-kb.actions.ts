'use server';

/**
 * Server actions for the Wachat **setup knowledge-base** (`/wachat/setup/docs`).
 *
 * Thin shims over the `wachatSetupKbApi` rust-client namespace (Rust crate
 * `wachat-setup-kb`, mounted at `/v1/wachat/setup-kb`). The crate owns all the
 * Mongo CRUD over the global `wa_setup_kb_articles` collection; this file only:
 *
 *   1. validates input,
 *   2. delegates to the namespace,
 *   3. re-shapes each cleaned Mongo doc (`_id` → `id`) into the `DocArticle`
 *      contract the page's components already render,
 *   4. calls `revalidatePath('/wachat/setup/docs')` after writes.
 *
 * KB articles are GLOBAL content — there is no `projectId` scoping here.
 *
 * The api is imported DIRECTLY (not via the central `rustClient` barrel); the
 * barrel registration is wired centrally later.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatSetupKbApi,
    type ListArticlesQuery,
    type ArticleBody,
    type SetupKbArticle,
} from '@/lib/rust-client/wachat-setup-kb';
import { getErrorMessage } from '@/lib/utils';

const DOCS_PATH = '/wachat/setup/docs';

/**
 * Shape the page consumes — mirrors `DocArticle` in
 * `src/app/wachat/setup/docs/lib/types.ts` (`id` + `updatedAt`).
 */
export interface SetupKbArticleView {
    id: string;
    title: string;
    content: string;
    category: string;
    updatedAt: string;
    createdAt?: string;
}

type ListArticlesResult =
    | { articles: SetupKbArticleView[]; error?: undefined }
    | { error: string; articles?: undefined };

type SaveArticleResult =
    | { article: SetupKbArticleView; error?: undefined }
    | { success: true; error?: undefined }
    | { error: string };

type MutationResult = { success: boolean; error?: string };

/** Normalize a cleaned Mongo doc (`_id` hex string) into the view contract. */
function toView(doc: SetupKbArticle): SetupKbArticleView {
    return {
        id: typeof doc._id === 'string' ? doc._id : String(doc._id),
        title: typeof doc.title === 'string' ? doc.title : '',
        content: typeof doc.content === 'string' ? doc.content : '',
        category: typeof doc.category === 'string' ? doc.category : '',
        updatedAt:
            typeof doc.updatedAt === 'string'
                ? doc.updatedAt
                : typeof doc.createdAt === 'string'
                  ? doc.createdAt
                  : new Date(0).toISOString(),
        createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : undefined,
    };
}

/**
 * List / search KB articles. `q`, `category`, and `sort` are all optional;
 * the Rust handler treats empty/`all` as "no filter".
 */
export async function listSetupKbArticles(
    query?: ListArticlesQuery,
): Promise<ListArticlesResult> {
    try {
        const r = await wachatSetupKbApi.listArticles(query);
        const articles = (r.articles ?? []).map(toView);
        return { articles };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/** Create a new KB article. Returns the created article view on success. */
export async function createSetupKbArticle(
    body: ArticleBody,
): Promise<SaveArticleResult> {
    const title = body?.title?.trim();
    const content = body?.content?.trim();
    const category = body?.category?.trim();
    if (!title) return { error: 'Title is required.' };
    if (!content) return { error: 'Content is required.' };
    if (!category) return { error: 'Category is required.' };
    try {
        const created = await wachatSetupKbApi.createArticle({ title, content, category });
        revalidatePath(DOCS_PATH);
        return { article: toView(created) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/** Update an existing KB article by id. */
export async function updateSetupKbArticle(
    articleId: string,
    body: ArticleBody,
): Promise<SaveArticleResult> {
    if (!articleId) return { error: 'Article id is required.' };
    const title = body?.title?.trim();
    const content = body?.content?.trim();
    const category = body?.category?.trim();
    if (!title) return { error: 'Title is required.' };
    if (!content) return { error: 'Content is required.' };
    if (!category) return { error: 'Category is required.' };
    try {
        const r = await wachatSetupKbApi.updateArticle(articleId, { title, content, category });
        revalidatePath(DOCS_PATH);
        return { success: r.success };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/** Delete a KB article by id. */
export async function deleteSetupKbArticle(articleId: string): Promise<MutationResult> {
    if (!articleId) return { success: false, error: 'Article id is required.' };
    try {
        const r = await wachatSetupKbApi.deleteArticle(articleId);
        revalidatePath(DOCS_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
