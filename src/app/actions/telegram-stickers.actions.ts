'use server';

/**
 * Server actions for the Telegram Stickers dashboard page.
 *
 * Thin wrappers around the typed Rust client.  The client itself is
 * `server-only`; the page (Client Component) calls these helpers from
 * the browser.
 */

import { revalidatePath } from 'next/cache';

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    AddStickerBody,
    CreateBody,
    EmojiListBody,
    KeywordsBody,
    ListResp,
    MaskPositionBody,
    PositionBody,
    ReplaceStickerBody,
    SetResp,
    SetThumbnailBody,
    SetTitleBody,
} from '@/lib/rust-client/telegram-stickers';

const PAGE = '/dashboard/telegram/stickers';

function errMsg(err: unknown): string {
    if (err instanceof RustApiError) return err.message;
    if (err instanceof Error) return err.message;
    return String(err);
}

function fail(msg: string): AckResult {
    return { success: false, error: msg };
}

// ---------------------------------------------------------------------------
//  Reads
// ---------------------------------------------------------------------------

export async function listStickerSetsAction(
    projectId: string,
    botId: string,
    opts?: { refresh?: boolean },
): Promise<ListResp> {
    try {
        return await rustClient.telegramStickers.list(projectId, botId, opts);
    } catch (err) {
        return { sets: [], error: errMsg(err) };
    }
}

export async function getStickerSetAction(
    setName: string,
    projectId: string,
    botId: string,
): Promise<SetResp> {
    try {
        return await rustClient.telegramStickers.get(setName, projectId, botId);
    } catch (err) {
        return { error: errMsg(err) };
    }
}

// ---------------------------------------------------------------------------
//  Writes
// ---------------------------------------------------------------------------

export async function createStickerSetAction(body: CreateBody): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.create(body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function archiveStickerSetAction(
    setName: string,
    projectId: string,
    botId: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.archive(setName, projectId, botId);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function addStickerAction(
    setName: string,
    body: AddStickerBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.addSticker(setName, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function deleteStickerAction(
    setName: string,
    fileId: string,
    projectId: string,
    botId: string,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.deleteSticker(setName, fileId, projectId, botId);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function setStickerSetTitleAction(
    setName: string,
    body: SetTitleBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.setTitle(setName, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function setStickerSetThumbnailAction(
    setName: string,
    body: SetThumbnailBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.setThumbnail(setName, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function setStickerEmojiListAction(
    setName: string,
    fileId: string,
    body: EmojiListBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.setEmojiList(setName, fileId, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function setStickerKeywordsAction(
    setName: string,
    fileId: string,
    body: KeywordsBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.setKeywords(setName, fileId, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function setStickerMaskPositionAction(
    setName: string,
    fileId: string,
    body: MaskPositionBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.setMaskPosition(setName, fileId, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function setStickerPositionAction(
    setName: string,
    fileId: string,
    body: PositionBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.setPosition(setName, fileId, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

export async function replaceStickerAction(
    setName: string,
    fileId: string,
    body: ReplaceStickerBody,
): Promise<AckResult> {
    try {
        const res = await rustClient.telegramStickers.replaceSticker(setName, fileId, body);
        if (res.success) revalidatePath(PAGE);
        return res;
    } catch (err) {
        return fail(errMsg(err));
    }
}

// ---------------------------------------------------------------------------
//  Bots (for the picker on top of the page).
//
// The page needs a list of the user's bots within the active project so
// they can choose which bot owns the pack. We proxy the existing
// `rustClient.telegramBots.list(projectId)` here so the page can stay a
// pure Client Component.
// ---------------------------------------------------------------------------

export async function listProjectBotsForStickersAction(
    projectId: string,
): Promise<{
    bots: Array<{ _id: string; username: string; name: string; botId: number }>;
    error?: string;
}> {
    try {
        const res = await rustClient.telegramBots.list(projectId);
        const bots = (res.bots ?? []).map((b) => ({
            _id: b._id,
            username: b.username,
            name: b.name,
            botId: b.botId,
        }));
        return { bots, error: res.error };
    } catch (err) {
        return { bots: [], error: errMsg(err) };
    }
}
