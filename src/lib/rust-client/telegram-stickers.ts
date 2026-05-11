/**
 * Client for the Telegram Stickers router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/stickers` by the
 * `telegram-stickers` Rust crate (uploadStickerFile, createNewStickerSet,
 * addStickerToSet, deleteStickerFromSet, setStickerSetTitle,
 * setStickerSetThumbnail, setStickerEmojiList, setStickerKeywords,
 * setStickerMaskPosition, setStickerPositionInSet, replaceStickerInSet,
 * getStickerSet). Each method is a thin wrapper around {@link rustFetch}.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/stickers';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    setId?: string;
    fileId?: string;
}

export type StickerType = 'regular' | 'mask' | 'custom_emoji';

export interface MaskPositionDto {
    point: 'forehead' | 'eyes' | 'mouth' | 'chin' | (string & {});
    xShift: number;
    yShift: number;
    scale: number;
}

export interface StickerRow {
    fileId: string;
    emoji: string;
    keywords: string[];
    maskPosition?: MaskPositionDto;
    positionInSet: number;
    type?: string;
    sabFileId?: string;
}

export interface SetRow {
    _id: string;
    projectId: string;
    botId: string;
    name: string;
    title: string;
    stickerType: StickerType;
    thumbnailFileId?: string;
    thumbnailUrl?: string;
    stickers: StickerRow[];
    stickerCount: number;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
    lastSyncedAt?: string;
}

export interface ListResp {
    sets: SetRow[];
    error?: string;
}

export interface SetResp {
    set?: SetRow;
    error?: string;
}

export interface StickerInputBody {
    sabFileId?: string;
    sabFileUrl: string;
    sabFileName?: string;
    emoji: string;
    keywords?: string[];
    maskPosition?: MaskPositionDto;
}

export interface CreateBody {
    projectId: string;
    botId: string;
    userId: number;
    name: string;
    title: string;
    stickerType?: StickerType;
    stickers: StickerInputBody[];
}

export interface AddStickerBody {
    projectId: string;
    botId: string;
    userId: number;
    sticker: StickerInputBody;
}

export interface SetTitleBody {
    projectId: string;
    botId: string;
    title: string;
}

export interface SetThumbnailBody {
    projectId: string;
    botId: string;
    userId: number;
    sabFileId?: string | null;
    sabFileUrl?: string | null;
    format?: 'static' | 'animated' | 'video';
}

export interface EmojiListBody {
    projectId: string;
    botId: string;
    emojiList: string[];
}

export interface KeywordsBody {
    projectId: string;
    botId: string;
    keywords: string[];
}

export interface MaskPositionBody {
    projectId: string;
    botId: string;
    maskPosition?: MaskPositionDto | null;
}

export interface PositionBody {
    projectId: string;
    botId: string;
    position: number;
}

export interface ReplaceStickerBody {
    projectId: string;
    botId: string;
    userId: number;
    sabFileId?: string;
    sabFileUrl: string;
    sabFileName?: string;
    emoji: string;
    keywords?: string[];
    maskPosition?: MaskPositionDto;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/**
 * Mirror of the Rust-side check in `validate_set_name`. Returns the
 * canonical pack `name` (with `_by_<botUsername>` suffix when missing)
 * or throws when the name is invalid.
 */
export function validateSetName(name: string, botUsername: string): string {
    if (!name) throw new Error('Pack name is required.');
    if (name.length > 64) throw new Error('Pack name must be 64 characters or fewer.');
    const suffix = `_by_${botUsername}`;
    const full = name.endsWith(suffix) ? name : `${name}${suffix}`;
    if (!/^[A-Za-z0-9_]+$/.test(full)) {
        throw new Error(`Pack name must match [A-Za-z0-9_]+_by_${botUsername}`);
    }
    return full;
}

function qs(params: Record<string, string | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        search.set(k, String(v));
    }
    const out = search.toString();
    return out ? `?${out}` : '';
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const telegramStickersApi = {
    /** `GET /v1/telegram/stickers?projectId=…&botId=…&refresh=…` */
    list: (projectId: string, botId: string, opts?: { refresh?: boolean }) =>
        rustFetch<ListResp>(
            `${BASE}/${qs({
                projectId,
                botId,
                refresh: opts?.refresh ? 'true' : undefined,
            })}`,
        ),

    /** `POST /v1/telegram/stickers/` — createNewStickerSet */
    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/telegram/stickers/{setName}` — refresh + return one set */
    get: (setName: string, projectId: string, botId: string) =>
        rustFetch<SetResp>(`${BASE}/${encodeURIComponent(setName)}${qs({ projectId, botId })}`),

    /** `DELETE /v1/telegram/stickers/{setName}` — soft-archive (Bot API has no delete) */
    archive: (setName: string, projectId: string, botId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setName)}${qs({ projectId, botId })}`,
            { method: 'DELETE' },
        ),

    /** `POST /v1/telegram/stickers/{setName}/add` — addStickerToSet */
    addSticker: (setName: string, body: AddStickerBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(setName)}/add`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `POST /v1/telegram/stickers/{setName}/title` — setStickerSetTitle */
    setTitle: (setName: string, body: SetTitleBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(setName)}/title`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `POST /v1/telegram/stickers/{setName}/thumbnail` — setStickerSetThumbnail */
    setThumbnail: (setName: string, body: SetThumbnailBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(setName)}/thumbnail`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `DELETE /v1/telegram/stickers/{setName}/sticker/{fileId}` — deleteStickerFromSet */
    deleteSticker: (
        setName: string,
        fileId: string,
        projectId: string,
        botId: string,
    ) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setName)}/sticker/${encodeURIComponent(fileId)}${qs({ projectId, botId })}`,
            { method: 'DELETE' },
        ),

    /** `POST /v1/telegram/stickers/{setName}/sticker/{fileId}/emoji` — setStickerEmojiList */
    setEmojiList: (setName: string, fileId: string, body: EmojiListBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setName)}/sticker/${encodeURIComponent(fileId)}/emoji`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `POST /v1/telegram/stickers/{setName}/sticker/{fileId}/keywords` — setStickerKeywords */
    setKeywords: (setName: string, fileId: string, body: KeywordsBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setName)}/sticker/${encodeURIComponent(fileId)}/keywords`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `POST /v1/telegram/stickers/{setName}/sticker/{fileId}/mask` — setStickerMaskPosition */
    setMaskPosition: (setName: string, fileId: string, body: MaskPositionBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setName)}/sticker/${encodeURIComponent(fileId)}/mask`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `POST /v1/telegram/stickers/{setName}/sticker/{fileId}/position` — setStickerPositionInSet */
    setPosition: (setName: string, fileId: string, body: PositionBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setName)}/sticker/${encodeURIComponent(fileId)}/position`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `POST /v1/telegram/stickers/{setName}/sticker/{fileId}/replace` — replaceStickerInSet */
    replaceSticker: (setName: string, fileId: string, body: ReplaceStickerBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(setName)}/sticker/${encodeURIComponent(fileId)}/replace`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
};

export type TelegramStickersApi = typeof telegramStickersApi;
