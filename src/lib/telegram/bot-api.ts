import 'server-only';

/**
 * Thin wrapper around the Telegram Bot API — https://core.telegram.org/bots/api
 *
 * All methods go to https://api.telegram.org/bot<TOKEN>/<method>. A successful
 * response is `{ ok: true, result: ... }`; a failure is `{ ok: false, error_code, description }`.
 * On non-ok responses we throw a TelegramApiError so callers can catch, inspect
 * `code` (HTTP code) and `description` (Telegram message), and decide whether
 * to retry (e.g. 429 with `retry_after`).
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export class TelegramApiError extends Error {
    code: number;
    description: string;
    parameters?: Record<string, any>;

    constructor(code: number, description: string, parameters?: Record<string, any>) {
        super(`[Telegram ${code}] ${description}`);
        this.name = 'TelegramApiError';
        this.code = code;
        this.description = description;
        this.parameters = parameters;
    }
}

interface TelegramResponse<T> {
    ok: boolean;
    result?: T;
    error_code?: number;
    description?: string;
    parameters?: Record<string, any>;
}

async function call<T>(token: string, method: string, params?: Record<string, any>): Promise<T> {
    const body = params ? JSON.stringify(params) : undefined;
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
        cache: 'no-store',
    });
    const json = (await res.json()) as TelegramResponse<T>;
    if (!json.ok || json.result === undefined) {
        throw new TelegramApiError(
            json.error_code ?? res.status,
            json.description ?? `HTTP ${res.status}`,
            json.parameters,
        );
    }
    return json.result;
}

/* ── Response types (minimal — only what we consume) ───────────── */

export interface TgUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
}

export interface TgWebhookInfo {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
    allowed_updates?: string[];
}

export interface TgChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    bio?: string;
    description?: string;
    invite_link?: string;
    photo?: { small_file_id: string; big_file_id: string };
    pinned_message?: { message_id: number };
    permissions?: Record<string, boolean>;
    [k: string]: any;
}

export interface TgMessage {
    message_id: number;
    from?: TgUser;
    chat: TgChat;
    date: number;
    text?: string;
    caption?: string;
    reply_to_message?: { message_id: number };
    business_connection_id?: string;
    [k: string]: any;
}

export type TgInlineKeyboardButton =
    | { text: string; url: string }
    | { text: string; callback_data: string }
    | { text: string; web_app: { url: string } };

export interface TgReplyMarkup {
    inline_keyboard?: TgInlineKeyboardButton[][];
}

export interface TgBotCommand {
    command: string;
    description: string;
}

export interface TgChatMember {
    user: TgUser;
    status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
    [k: string]: any;
}

export interface TgFile {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
}

export interface TgLabeledPrice {
    label: string;
    amount: number;
}

export interface TgStickerSet {
    name: string;
    title: string;
    sticker_type: 'regular' | 'mask' | 'custom_emoji';
    stickers: Array<{ file_id: string; file_unique_id: string; emoji?: string }>;
}

type TgMenuButton =
    | { type: 'default' }
    | { type: 'commands' }
    | { type: 'web_app'; text: string; web_app: { url: string } };

/* ── Methods ───────────────────────────────────────────────────── */

export const TelegramBotApi = {
    /* Identity & webhook ----------------------------------------- */
    getMe: (token: string) => call<TgUser>(token, 'getMe'),

    getWebhookInfo: (token: string) => call<TgWebhookInfo>(token, 'getWebhookInfo'),

    setWebhook: (
        token: string,
        params: {
            url: string;
            secret_token?: string;
            allowed_updates?: string[];
            max_connections?: number;
            drop_pending_updates?: boolean;
        },
    ) => call<true>(token, 'setWebhook', params),

    deleteWebhook: (token: string, drop_pending_updates = false) =>
        call<true>(token, 'deleteWebhook', { drop_pending_updates }),

    /* Messaging -------------------------------------------------- */
    sendMessage: (
        token: string,
        params: {
            chat_id: string | number;
            text: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            disable_notification?: boolean;
            reply_markup?: TgReplyMarkup;
            reply_to_message_id?: number;
            business_connection_id?: string;
            link_preview_options?: { is_disabled?: boolean };
            protect_content?: boolean;
        },
    ) => call<TgMessage>(token, 'sendMessage', params),

    sendPhoto: (
        token: string,
        params: {
            chat_id: string | number;
            photo: string;
            caption?: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            reply_markup?: TgReplyMarkup;
            business_connection_id?: string;
            disable_notification?: boolean;
        },
    ) => call<TgMessage>(token, 'sendPhoto', params),

    sendVideo: (
        token: string,
        params: {
            chat_id: string | number;
            video: string;
            caption?: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            reply_markup?: TgReplyMarkup;
            business_connection_id?: string;
            disable_notification?: boolean;
        },
    ) => call<TgMessage>(token, 'sendVideo', params),

    sendDocument: (
        token: string,
        params: {
            chat_id: string | number;
            document: string;
            caption?: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            reply_markup?: TgReplyMarkup;
            business_connection_id?: string;
            disable_notification?: boolean;
        },
    ) => call<TgMessage>(token, 'sendDocument', params),

    sendAudio: (
        token: string,
        params: {
            chat_id: string | number;
            audio: string;
            caption?: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            duration?: number;
            performer?: string;
            title?: string;
            reply_markup?: TgReplyMarkup;
        },
    ) => call<TgMessage>(token, 'sendAudio', params),

    sendVoice: (
        token: string,
        params: {
            chat_id: string | number;
            voice: string;
            caption?: string;
            duration?: number;
            parse_mode?: 'HTML' | 'MarkdownV2';
        },
    ) => call<TgMessage>(token, 'sendVoice', params),

    sendAnimation: (
        token: string,
        params: {
            chat_id: string | number;
            animation: string;
            caption?: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            reply_markup?: TgReplyMarkup;
        },
    ) => call<TgMessage>(token, 'sendAnimation', params),

    sendSticker: (
        token: string,
        params: {
            chat_id: string | number;
            sticker: string;
            emoji?: string;
            reply_markup?: TgReplyMarkup;
        },
    ) => call<TgMessage>(token, 'sendSticker', params),

    sendLocation: (
        token: string,
        params: {
            chat_id: string | number;
            latitude: number;
            longitude: number;
            horizontal_accuracy?: number;
        },
    ) => call<TgMessage>(token, 'sendLocation', params),

    sendContact: (
        token: string,
        params: {
            chat_id: string | number;
            phone_number: string;
            first_name: string;
            last_name?: string;
            vcard?: string;
        },
    ) => call<TgMessage>(token, 'sendContact', params),

    sendMediaGroup: (
        token: string,
        params: {
            chat_id: string | number;
            media: Array<{
                type: 'photo' | 'video' | 'audio' | 'document';
                media: string;
                caption?: string;
                parse_mode?: 'HTML' | 'MarkdownV2';
            }>;
            disable_notification?: boolean;
        },
    ) => call<TgMessage[]>(token, 'sendMediaGroup', params),

    sendChatAction: (
        token: string,
        params: {
            chat_id: string | number;
            action:
                | 'typing'
                | 'upload_photo'
                | 'record_video'
                | 'upload_video'
                | 'record_voice'
                | 'upload_voice'
                | 'upload_document'
                | 'choose_sticker'
                | 'find_location';
            business_connection_id?: string;
        },
    ) => call<true>(token, 'sendChatAction', params),

    forwardMessage: (
        token: string,
        params: {
            chat_id: string | number;
            from_chat_id: string | number;
            message_id: number;
            disable_notification?: boolean;
        },
    ) => call<TgMessage>(token, 'forwardMessage', params),

    copyMessage: (
        token: string,
        params: {
            chat_id: string | number;
            from_chat_id: string | number;
            message_id: number;
            caption?: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
        },
    ) => call<{ message_id: number }>(token, 'copyMessage', params),

    editMessageText: (
        token: string,
        params: {
            chat_id: string | number;
            message_id: number;
            text: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            reply_markup?: TgReplyMarkup;
        },
    ) => call<TgMessage | true>(token, 'editMessageText', params),

    editMessageCaption: (
        token: string,
        params: {
            chat_id: string | number;
            message_id: number;
            caption: string;
            parse_mode?: 'HTML' | 'MarkdownV2';
            reply_markup?: TgReplyMarkup;
        },
    ) => call<TgMessage | true>(token, 'editMessageCaption', params),

    deleteMessage: (token: string, chat_id: string | number, message_id: number) =>
        call<true>(token, 'deleteMessage', { chat_id, message_id }),

    deleteMessages: (token: string, chat_id: string | number, message_ids: number[]) =>
        call<true>(token, 'deleteMessages', { chat_id, message_ids }),

    setMessageReaction: (
        token: string,
        params: {
            chat_id: string | number;
            message_id: number;
            reaction?: Array<{ type: 'emoji'; emoji: string }>;
            is_big?: boolean;
        },
    ) => call<true>(token, 'setMessageReaction', params),

    answerCallbackQuery: (
        token: string,
        params: {
            callback_query_id: string;
            text?: string;
            show_alert?: boolean;
            url?: string;
        },
    ) => call<true>(token, 'answerCallbackQuery', params),

    /* Chat administration --------------------------------------- */
    getChat: (token: string, chat_id: string | number) =>
        call<TgChat>(token, 'getChat', { chat_id }),

    getChatMemberCount: (token: string, chat_id: string | number) =>
        call<number>(token, 'getChatMemberCount', { chat_id }),

    getChatMember: (token: string, chat_id: string | number, user_id: number) =>
        call<TgChatMember>(token, 'getChatMember', { chat_id, user_id }),

    banChatMember: (
        token: string,
        params: {
            chat_id: string | number;
            user_id: number;
            until_date?: number;
            revoke_messages?: boolean;
        },
    ) => call<true>(token, 'banChatMember', params),

    unbanChatMember: (
        token: string,
        params: { chat_id: string | number; user_id: number; only_if_banned?: boolean },
    ) => call<true>(token, 'unbanChatMember', params),

    leaveChat: (token: string, chat_id: string | number) =>
        call<true>(token, 'leaveChat', { chat_id }),

    pinChatMessage: (
        token: string,
        params: {
            chat_id: string | number;
            message_id: number;
            disable_notification?: boolean;
        },
    ) => call<true>(token, 'pinChatMessage', params),

    unpinChatMessage: (
        token: string,
        params: { chat_id: string | number; message_id?: number },
    ) => call<true>(token, 'unpinChatMessage', params),

    exportChatInviteLink: (token: string, chat_id: string | number) =>
        call<string>(token, 'exportChatInviteLink', { chat_id }),

    /* Bot profile ----------------------------------------------- */
    setMyCommands: (
        token: string,
        params: {
            commands: TgBotCommand[];
            scope?: { type: string };
            language_code?: string;
        },
    ) => call<true>(token, 'setMyCommands', params),

    getMyCommands: (token: string, params?: { scope?: { type: string }; language_code?: string }) =>
        call<TgBotCommand[]>(token, 'getMyCommands', params),

    deleteMyCommands: (token: string, params?: { scope?: { type: string }; language_code?: string }) =>
        call<true>(token, 'deleteMyCommands', params),

    setMyName: (token: string, params: { name: string; language_code?: string }) =>
        call<true>(token, 'setMyName', params),

    setMyDescription: (
        token: string,
        params: { description?: string; language_code?: string },
    ) => call<true>(token, 'setMyDescription', params),

    getMyDescription: (token: string, params?: { language_code?: string }) =>
        call<{ description: string }>(token, 'getMyDescription', params),

    setMyShortDescription: (
        token: string,
        params: { short_description?: string; language_code?: string },
    ) => call<true>(token, 'setMyShortDescription', params),

    getMyShortDescription: (token: string, params?: { language_code?: string }) =>
        call<{ short_description: string }>(token, 'getMyShortDescription', params),

    setChatMenuButton: (
        token: string,
        params: { chat_id?: number; menu_button: TgMenuButton },
    ) => call<true>(token, 'setChatMenuButton', params),

    getChatMenuButton: (token: string, params?: { chat_id?: number }) =>
        call<TgMenuButton>(token, 'getChatMenuButton', params),

    /* Files ----------------------------------------------------- */
    getFile: (token: string, file_id: string) => call<TgFile>(token, 'getFile', { file_id }),

    /** Returns a public URL (valid ~1h) that proxies the Telegram file. */
    buildFileUrl: (token: string, file_path: string) =>
        `${TELEGRAM_API_BASE}/file/bot${token}/${file_path}`,

    /* Payments -------------------------------------------------- */
    sendInvoice: (
        token: string,
        params: {
            chat_id: string | number;
            title: string;
            description: string;
            payload: string;
            provider_token?: string;
            currency: string;
            prices: TgLabeledPrice[];
            max_tip_amount?: number;
            suggested_tip_amounts?: number[];
            start_parameter?: string;
            provider_data?: string;
            photo_url?: string;
            need_name?: boolean;
            need_phone_number?: boolean;
            need_email?: boolean;
            need_shipping_address?: boolean;
            is_flexible?: boolean;
            reply_markup?: TgReplyMarkup;
        },
    ) => call<TgMessage>(token, 'sendInvoice', params),

    createInvoiceLink: (
        token: string,
        params: {
            title: string;
            description: string;
            payload: string;
            provider_token?: string;
            currency: string;
            prices: TgLabeledPrice[];
        },
    ) => call<string>(token, 'createInvoiceLink', params),

    answerPreCheckoutQuery: (
        token: string,
        params: { pre_checkout_query_id: string; ok: boolean; error_message?: string },
    ) => call<true>(token, 'answerPreCheckoutQuery', params),

    answerShippingQuery: (
        token: string,
        params: {
            shipping_query_id: string;
            ok: boolean;
            shipping_options?: Array<{ id: string; title: string; prices: TgLabeledPrice[] }>;
            error_message?: string;
        },
    ) => call<true>(token, 'answerShippingQuery', params),

    refundStarPayment: (
        token: string,
        params: { user_id: number; telegram_payment_charge_id: string },
    ) => call<true>(token, 'refundStarPayment', params),

    /* Stickers -------------------------------------------------- */
    getStickerSet: (token: string, name: string) =>
        call<TgStickerSet>(token, 'getStickerSet', { name }),

    uploadStickerFile: (
        token: string,
        params: { user_id: number; sticker: string; sticker_format: 'static' | 'animated' | 'video' },
    ) => call<TgFile>(token, 'uploadStickerFile', params),

    createNewStickerSet: (
        token: string,
        params: {
            user_id: number;
            name: string;
            title: string;
            stickers: Array<{ sticker: string; emoji_list: string[]; format?: string }>;
            sticker_type?: 'regular' | 'mask' | 'custom_emoji';
        },
    ) => call<true>(token, 'createNewStickerSet', params),

    addStickerToSet: (
        token: string,
        params: {
            user_id: number;
            name: string;
            sticker: { sticker: string; emoji_list: string[]; format?: string };
        },
    ) => call<true>(token, 'addStickerToSet', params),

    deleteStickerFromSet: (token: string, sticker: string) =>
        call<true>(token, 'deleteStickerFromSet', { sticker }),

    deleteStickerSet: (token: string, name: string) =>
        call<true>(token, 'deleteStickerSet', { name }),
};
