# Typebot → SabFlow Merge & Port Plan

> **Status:** Plan only. No code in this turn — implementation follows once you sign off.
> **Source:** `typebot.io-main/` checked in at the repo root.
> **Strategy:** Reuse-first. If a typebot block has a behaviorally-equivalent SabFlow port, **merge** (UI dedupes via id alias, no new file). If it's unique, **port** as a new `forge_typebot_*` block in the same n8n-migration style.

---

## 1. Background

Typebot ships **57 distinct flow blocks**, split across:

| Source dir | Count | Description |
| --- | --- | --- |
| `packages/blocks/bubbles/src/` | 5 | text, image, video, audio, embed (UI render-side) |
| `packages/blocks/inputs/src/` | 13 | text, number, email, phone, url, date, time, rating, file, payment, choice, pictureChoice, **cards** |
| `packages/blocks/logic/src/` | 10 | condition, setVariable, redirect, script, typebotLink, wait, jump, abTest, **return**, webhook |
| `packages/blocks/integrations/src/` | 10 | chatwoot, googleAnalytics, googleSheets, httpRequest, makeCom, openai, pabblyConnect, pixel, sendEmail, zapier |
| `packages/forge/blocks/` | 19 | anthropic, **blink**, calCom, **chatNode**, deepseek, **difyAi**, elevenlabs, gmail, groq, mistral, nocodb, openRouter, openai, perplexity, posthog, qrcode, segment, togetherAi, zendesk |

(Bold = candidates flagged as *new* in this plan. See §5 for the merged/new verdict per block.)

Typebot's flow runtime (`packages/bot-engine/`) is a **conversational web-form executor** — it renders questions to a visitor and walks the graph based on their responses. SabFlow already has this surface natively (the canvas + `executeFlow.ts` + the input blocks pre-date the n8n migration). So we are not porting typebot's runtime — only its block catalog.

## 2. Reuse-first principle

SabFlow already has **760 forge ports** + ~80 native blocks. Most typebot blocks have a direct SabFlow equivalent. For those we do **not** create a new file — instead the **block-id aliasing** layer is updated so that a typebot id (e.g. `cal-com`) resolves to the existing SabFlow block (`forge_cal_com`). This:

- Keeps the catalog small and de-duplicated.
- Lets a typebot flow JSON pasted into SabFlow render correctly without rewriting block types.
- Avoids two near-identical "Cal.com" entries in the picker.

The aliasing happens in **two places**:
1. **Engine side** (`engine/executeBlock.ts`) — when a block of type `cal-com` is encountered, dispatch to `forge_cal_com`'s `run`.
2. **UI side** (`blocks/index.ts` + `BlocksSideBar.tsx`) — the picker only shows the canonical SabFlow entry; the typebot id is registered as a hidden synonym.

Concrete: we add a `TYPEBOT_ALIAS_MAP: Record<typebotId, sabflowId>` to `src/lib/sabflow/blocks/typebot-aliases.ts`, consulted by both layers.

## 3. Inventory & verdict

### 3.1 bubbles (5 blocks) — ALL MERGE

| Typebot id | SabFlow target | Notes |
| --- | --- | --- |
| `text` | `text` (native) | Identical UI bubble. Field schema match. |
| `image` | `image` (native) | URL-based image bubble. SabFlow already uses SabFiles picker. |
| `video` | `video` (native) | YouTube/Vimeo/MP4 URL. |
| `audio` | `audio` (native) | URL audio. |
| `embed` | `embed` (native) | Generic iframe embed. |

### 3.2 inputs (13 blocks) — 12 MERGE, 1 NEW

| Typebot id | SabFlow target | Verdict |
| --- | --- | --- |
| `text` | `text_input` | merge |
| `number` | `number_input` | merge |
| `email` | `email_input` | merge |
| `phone` | `phone_input` | merge |
| `url` | `url_input` | merge |
| `date` | `date_input` | merge |
| `time` | `time_input` | merge |
| `rating` | `rating_input` | merge |
| `file` | `file_input` | merge (uses SabFiles) |
| `payment` | `payment_input` | merge (Stripe / Razorpay wiring already in SabFlow) |
| `choice` | `choice_input` | merge |
| `pictureChoice` | `picture_choice_input` | merge |
| **`cards`** | — | **NEW** → `forge_typebot_cards` (image-card carousel; typebot's signature input — SabFlow has no equivalent) |

### 3.3 logic (10 blocks) — 9 MERGE, 1 NEW

| Typebot id | SabFlow target | Verdict |
| --- | --- | --- |
| `condition` | `condition` | merge |
| `setVariable` | `set_variable` | merge |
| `redirect` | `redirect` | merge |
| `script` | `script` | merge |
| `typebotLink` | `typebot_link` | merge |
| `wait` | `wait` | merge |
| `jump` | `jump` | merge |
| `abTest` | `ab_test` | merge |
| `webhook` | `webhook` (native) | merge |
| **`return`** | — | **NEW** → `forge_typebot_return` (early-exit from flow with a structured response payload; SabFlow does not have an explicit return block — flows just end naturally) |

### 3.4 integrations (10 blocks) — ALL MERGE

| Typebot id | SabFlow target | Notes |
| --- | --- | --- |
| `chatwoot` | `chatwoot` (native) | merge |
| `googleAnalytics` | `google_analytics` (native) | merge |
| `googleSheets` | `google_sheets` (native) | merge |
| `httpRequest` | `forge_http_request` | merge |
| `makeCom` | `make_com` (native) | merge |
| `openai` | `forge_openai_ext` | merge (extended OpenAI ops cover typebot's chat completion) |
| `pabblyConnect` | `pabbly_connect` (native) | merge |
| `pixel` | `pixel` (native) | merge |
| `sendEmail` | `send_email` (native) | merge |
| `zapier` | `zapier` (native) | merge |

### 3.5 forge integrations (19 blocks) — 16 MERGE, 3 NEW

| Typebot id | SabFlow target | Verdict |
| --- | --- | --- |
| `anthropic` | `forge_lm_chat_anthropic`, `forge_anthropic_messages` | merge |
| **`blink`** | — | **NEW** → `forge_typebot_blink` (Blink workplace-comms / HR — feed events, user lookup, redirect) |
| `cal-com` | `forge_cal_com` (legacy native) | merge — alias the dashed id |
| **`chat-node`** | — | **NEW** → `forge_typebot_chatnode` (ChatNode.ai chat-knowledge product) |
| `deepseek` | `forge_lm_chat_deepseek` | merge |
| **`dify-ai`** | — | **NEW** → `forge_typebot_dify_ai` (Dify.AI app — `createChatMessage`, `queryKnowledgeBase`) |
| `elevenlabs` | `forge_audio_elevenlabs_tts`, `elevenlabs` (native) | merge |
| `gmail` | `forge_gmail` | merge |
| `groq` | `forge_lm_chat_groq` | merge |
| `mistral` | `forge_lm_chat_mistral`, `forge_mistral_ext` | merge |
| `nocodb` | `forge_nocodb_ext`, `nocodb` (native) | merge |
| `open-router` | `forge_lm_chat_openrouter` | merge |
| `openai` | `forge_openai_ext` | merge |
| `perplexity` | `forge_perplexity_ext` | merge |
| `posthog` | `forge_posthog` | merge |
| `qr-code` | `forge_qr_code` | merge |
| `segment` | `forge_segment` | merge |
| `together-ai` | `forge_together_ai_ext` | merge |
| `zendesk` | `forge_zendesk` | merge |

### 3.6 Summary

| Bucket | Total | Merged (no new file) | New ports |
| --- | --- | --- | --- |
| bubbles | 5 | 5 | 0 |
| inputs | 13 | 12 | 1 (`cards`) |
| logic | 10 | 9 | 1 (`return`) |
| integrations | 10 | 10 | 0 |
| forge | 19 | 16 | 3 (`blink`, `chat-node`, `dify-ai`) |
| **Total** | **57** | **52** | **5** |

**Net new files: 5.** Everything else routes to existing SabFlow blocks via an alias map.

## 4. Architecture

### 4.1 Files to add

```
src/lib/sabflow/blocks/typebot-aliases.ts            ← NEW: { typebotId → sabflowId } map (≈55 entries)
src/lib/sabflow/forge/blocks/typebot/cards.ts        ← NEW: forge_typebot_cards (image-card carousel input)
src/lib/sabflow/forge/blocks/typebot/return_block.ts ← NEW: forge_typebot_return (early-exit with response)
src/lib/sabflow/forge/blocks/typebot/blink.ts        ← NEW: forge_typebot_blink (3 actions)
src/lib/sabflow/forge/blocks/typebot/chatnode.ts     ← NEW: forge_typebot_chatnode (sendMessage)
src/lib/sabflow/forge/blocks/typebot/dify_ai.ts      ← NEW: forge_typebot_dify_ai (createChatMessage, queryKnowledgeBase)
docs/TYPEBOT_FLOW_IMPORTER.md                        ← NEW: documents the JSON-paste flow (optional, after the catalog lands)
```

### 4.2 Files to modify

```
src/lib/sabflow/engine/executeBlock.ts        — consult TYPEBOT_ALIAS_MAP before the switch
src/lib/sabflow/blocks/index.ts               — register the 5 new ids; alias map referenced in getBlockLabel/getBlockIcon for nicer rendering of imported typebot flows
src/lib/sabflow/forge/index.ts                — import the 5 new forge files (server-only)
src/components/sabflow/editor/BlocksSideBar.tsx — add a "Imported (Typebot)" filter chip so users can see only the merged-from-typebot blocks if they want
```

### 4.3 Alias map shape

```ts
// src/lib/sabflow/blocks/typebot-aliases.ts
import 'server-only'; // consumed only on server + during static analysis

/**
 * Maps a typebot block id to its SabFlow equivalent.
 *
 * Used at flow-import time to rewrite the typebot JSON's `type` field, and at
 * runtime as a safety net if a stale `type` slips through. The picker UI does
 * NOT show these — they're invisible synonyms.
 */
export const TYPEBOT_ALIAS_MAP: Record<string, string> = {
  // bubbles
  'text': 'text', 'image': 'image', 'video': 'video', 'audio': 'audio', 'embed': 'embed',
  // inputs
  'text-input': 'text_input', 'number-input': 'number_input', 'email-input': 'email_input',
  'phone-input': 'phone_input', 'url-input': 'url_input', 'date-input': 'date_input',
  'time-input': 'time_input', 'rating-input': 'rating_input', 'file-input': 'file_input',
  'payment-input': 'payment_input', 'choice-input': 'choice_input',
  'picture-choice-input': 'picture_choice_input',
  // logic
  'condition': 'condition', 'set-variable': 'set_variable', 'redirect': 'redirect',
  'script': 'script', 'typebot-link': 'typebot_link', 'wait': 'wait', 'jump': 'jump',
  'ab-test': 'ab_test', 'webhook': 'webhook',
  // integrations
  'chatwoot': 'chatwoot', 'google-analytics': 'google_analytics',
  'google-sheets': 'google_sheets', 'http-request': 'forge_http_request',
  'make-com': 'make_com', 'openai': 'forge_openai_ext', 'pabbly-connect': 'pabbly_connect',
  'pixel': 'pixel', 'send-email': 'send_email', 'zapier': 'zapier',
  // forge
  'anthropic': 'forge_lm_chat_anthropic', 'cal-com': 'forge_cal_com',
  'deepseek': 'forge_lm_chat_deepseek', 'elevenlabs': 'forge_audio_elevenlabs_tts',
  'gmail': 'forge_gmail', 'groq': 'forge_lm_chat_groq', 'mistral': 'forge_lm_chat_mistral',
  'nocodb': 'forge_nocodb_ext', 'open-router': 'forge_lm_chat_openrouter',
  'perplexity': 'forge_perplexity_ext', 'posthog': 'forge_posthog', 'qr-code': 'forge_qr_code',
  'segment': 'forge_segment', 'together-ai': 'forge_together_ai_ext', 'zendesk': 'forge_zendesk',
  // Unique typebot blocks — these map to themselves (the NEW ports)
  'cards': 'forge_typebot_cards', 'return': 'forge_typebot_return', 'blink': 'forge_typebot_blink',
  'chat-node': 'forge_typebot_chatnode', 'dify-ai': 'forge_typebot_dify_ai',
};

export function resolveTypebotAlias(id: string): string {
  return TYPEBOT_ALIAS_MAP[id] ?? id;
}
```

### 4.4 Engine dispatch hook

`executeBlock.ts` — at the top of the function, before the switch:

```ts
import { resolveTypebotAlias } from '@/lib/sabflow/blocks/typebot-aliases';

export async function executeBlock(block: Block, ...) {
  // Rewrite typebot ids → SabFlow ids so a pasted typebot flow runs as-is.
  if (block.type in TYPEBOT_ALIAS_MAP) {
    block = { ...block, type: resolveTypebotAlias(block.type) as Block['type'] };
  }
  // ...existing switch...
}
```

### 4.5 New port specs (one paragraph each)

**`forge_typebot_cards`** — image-card carousel input. Fields: `prompt` (text), `cards` (json array of `{ imageUrl, title, description, value }`), `multiselect` (toggle). Output: the selected card's `value` (or array of values when multiselect). Action: `pick`. Pure-UI block under the hood; the `run` function just shapes input/output (the actual rendering is in the canvas + bot-engine, identical to SabFlow's existing `picture_choice_input`).

**`forge_typebot_return`** — early-exit logic block. Field: `responsePayload` (json — what to return to the caller). Action: `exit`. The engine treats this like an `errorSignal: 'halt'` but with a normal success status. Header note: SabFlow flows can also just "end naturally" by hitting a node with no outgoing edge — this block is for the typebot mental model.

**`forge_typebot_blink`** — Blink workplace platform (HR + comms). Credential: `apiKey` + `accountUrl`. Actions: `get_users(filter)`, `send_feed_event(eventName, userId, payload)`, `redirect(url)`. n8n source: `typebot.io-main/packages/forge/blocks/blink/src/actions/*`.

**`forge_typebot_chatnode`** — ChatNode.ai (knowledge-base chat product). Credential: `apiKey`. Action: `send_message(botId, message, sessionId?)` → returns `{ reply, source_documents }`. n8n source: `typebot.io-main/packages/forge/blocks/chatNode/src/actions/sendMessage.ts`.

**`forge_typebot_dify_ai`** — Dify.AI integration. Credential: `apiKey` + `endpoint`. Actions: `create_chat_message(query, user, conversationId?, files?)`, `query_knowledge_base(query, datasetId, topK?)`. n8n source: `typebot.io-main/packages/forge/blocks/difyAi/src/actions/*`.

## 5. Implementation waves

| Wave | Scope | Effort |
| --- | --- | --- |
| **T1** | `typebot-aliases.ts` + engine hook | ~30 min — 1 file new, 1 file edited |
| **T2** | 5 new forge ports (cards, return, blink, chatNode, dify-ai) | ~2-3 hours — 1 agent OR 5 small agents |
| **T3** | UI: add "Imported (Typebot)" filter chip to BlocksSideBar | ~20 min — 1 file edited |
| **T4** | Flow importer: `POST /api/sabflow/import/typebot` route that takes a typebot JSON export, rewrites block `type`s via `resolveTypebotAlias`, and inserts a new SabFlow flow | ~1 hour — 1 file new |
| **T5** | (optional) Visual round-trip test: import a real typebot flow, run it once, assert results match typebot's expected output | ~1 hour |

Total: **~6 hours of focused work**, or **~30 minutes** if T1+T2+T3 land in parallel via 3 agents (T4/T5 are optional polish).

## 6. Acceptance criteria

- [ ] `TYPEBOT_ALIAS_MAP` has all 57 typebot blocks mapped (52 to existing SabFlow ids, 5 to new typebot ports).
- [ ] All 5 new forge files register via `registerForgeBlock` and appear in the picker under the "forge" category.
- [ ] Engine `executeBlock` correctly dispatches a `type: 'cal-com'` to `forge_cal_com`'s `run` without modification of the in-memory block.
- [ ] Combined typecheck across forge catalog + alias map + engine: exit 0.
- [ ] Flow-builder picker shows zero duplicate blocks (e.g. only ONE "Cal.com" entry, ONE "Anthropic", etc.).
- [ ] (Optional T4) Importing a typebot JSON export results in a runnable SabFlow flow.

## 7. Risks & decisions

- **Block-id format mismatch.** Typebot uses kebab-case (`cal-com`), SabFlow uses snake_case (`cal_com`). The alias map handles both. **No data migration needed** on existing SabFlow flows.
- **Native vs forge.** Some SabFlow native blocks (e.g. `text_input`, `chatwoot`, `wait`) handle the typebot mapping perfectly. Other typebot blocks land on forge ports (`forge_openai_ext`, `forge_http_request`). Both work — the alias map abstracts the difference.
- **5 new ports = small footprint.** Adding 5 files to a 760-block catalog is sub-1% growth. No risk of catalog explosion.
- **Typebot `return`'s response payload semantics.** Typebot's runtime calls a parent flow with a response; SabFlow doesn't currently have "parent flow" semantics (every flow is top-level). For T2 we implement `return` as a structured `outputs.response` block that the caller can read from the engine's final state. If a true parent-flow integration is needed later, we revisit then.
- **`elevenlabs` mapping.** Typebot's elevenlabs block is text-to-speech only. SabFlow has both `forge_audio_elevenlabs_tts` (TTS) and the legacy native `elevenlabs` block (also TTS). We alias to `forge_audio_elevenlabs_tts` since it's the maintained one.
- **`anthropic` mapping.** SabFlow has 2 options (`forge_lm_chat_anthropic` modern chat, `forge_anthropic_messages` extended). We alias typebot's `anthropic` to the **modern chat** since that matches typebot's UX (single chat-completion action).

## 8. Plan vs implementation

This document is **plan-only**. After you sign off:

- T1+T2+T3 can run as **3 parallel agents**, mirroring the pattern used for the n8n migration.
- T4+T5 are optional — they add round-trip flow-import support but aren't required for the catalog merge itself.

When implementation lands, the **n8n migration plan** (`N8N_MIGRATION_PLAN.md`) gets a new "Typebot merge" wave appended to its Progress table.
