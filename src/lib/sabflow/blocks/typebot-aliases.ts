/**
 * Typebot → SabFlow block-id alias map.
 *
 * Maps a typebot block id (kebab-case, e.g. `cal-com`) to its SabFlow
 * equivalent (snake_case, e.g. `forge_cal_com`). Most entries point at an
 * existing SabFlow native or forge block (the *merged* case); the five
 * unique-to-typebot blocks point at the new `forge_typebot_*` ports.
 *
 * Used in two places:
 *   1. Flow-import time — the typebot JSON exporter route rewrites `type`
 *      fields via `resolveTypebotAlias` so the resulting flow runs natively
 *      on SabFlow's executor.
 *   2. Engine runtime — `executeBlock` consults the map as a safety net so
 *      a stale typebot id (e.g. carried in older flow documents) still
 *      dispatches to the right SabFlow handler.
 *
 * The map is *invisible to the picker*: only the canonical SabFlow id is
 * surfaced in the BlocksSideBar to keep the catalog de-duplicated.
 *
 * NOTE: This module is imported by both the server-side engine and the
 *       (server-side) flow-import route handler. Do **not** add
 *       `import 'server-only'` — both consumers are server contexts but the
 *       map itself contains zero secrets, and forcing the marker would
 *       block tooling like the typecheck script in CI from touching it.
 */

export const TYPEBOT_ALIAS_MAP: Record<string, string> = {
  // ── bubbles (5) ─────────────────────────────────────────
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  embed: 'embed',

  // ── inputs (12 merged, `cards` is new) ──────────────────
  'text-input': 'text_input',
  'number-input': 'number_input',
  'email-input': 'email_input',
  'phone-input': 'phone_input',
  'url-input': 'url_input',
  'date-input': 'date_input',
  'time-input': 'time_input',
  'rating-input': 'rating_input',
  'file-input': 'file_input',
  'payment-input': 'payment_input',
  'choice-input': 'choice_input',
  'picture-choice-input': 'picture_choice_input',

  // ── logic (9 merged, `return` is new) ───────────────────
  condition: 'condition',
  'set-variable': 'set_variable',
  redirect: 'redirect',
  script: 'script',
  'typebot-link': 'typebot_link',
  wait: 'wait',
  jump: 'jump',
  'ab-test': 'ab_test',
  webhook: 'webhook',

  // ── integrations (10) ───────────────────────────────────
  chatwoot: 'chatwoot',
  'google-analytics': 'google_analytics',
  'google-sheets': 'google_sheets',
  'http-request': 'forge_http_request',
  'make-com': 'make_com',
  openai: 'forge_openai_ext',
  'pabbly-connect': 'pabbly_connect',
  pixel: 'pixel',
  'send-email': 'send_email',
  zapier: 'zapier',

  // ── forge (16 merged, 3 new) ────────────────────────────
  anthropic: 'forge_lm_chat_anthropic',
  'cal-com': 'forge_cal_com',
  deepseek: 'forge_lm_chat_deepseek',
  elevenlabs: 'forge_audio_elevenlabs_tts',
  gmail: 'forge_gmail',
  groq: 'forge_lm_chat_groq',
  mistral: 'forge_lm_chat_mistral',
  nocodb: 'forge_nocodb_ext',
  'open-router': 'forge_lm_chat_openrouter',
  perplexity: 'forge_perplexity_ext',
  posthog: 'forge_posthog',
  'qr-code': 'forge_qr_code',
  segment: 'forge_segment',
  'together-ai': 'forge_together_ai_ext',
  zendesk: 'forge_zendesk',

  // ── Unique typebot blocks → new ports (5) ───────────────
  cards: 'forge_typebot_cards',
  return: 'forge_typebot_return',
  blink: 'forge_typebot_blink',
  'chat-node': 'forge_typebot_chatnode',
  'dify-ai': 'forge_typebot_dify_ai',
};

/**
 * Resolve a typebot block id to its SabFlow equivalent. Returns the input
 * unchanged when no alias is registered, so callers can use this as an
 * idempotent passthrough on already-canonical ids.
 */
export function resolveTypebotAlias(id: string): string {
  return TYPEBOT_ALIAS_MAP[id] ?? id;
}
