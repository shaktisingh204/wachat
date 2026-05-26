# SabWa — Personal WhatsApp Module: Full Implementation Plan

> **Module ID:** `sabwa`
> **Route root:** `/sabwa`
> **Engine:** Node.js + Baileys (in-process) — `services/sabwa-node/` (Express HTTP server on :4001)
> **Goal:** Let each project owner link their personal WhatsApp number (via "Linked Devices") and operate it as a first-class SabNode module — chats, groups, broadcasts, scheduling, automation, AI — fully responsive (mobile / tablet / desktop).

> **Stack migration (2026-05-15):** The original plan called for a Rust `sabwa-engine` with a Node sidecar for Baileys. That has been replaced by a single pure-Node service (`services/sabwa-node/`) that runs Baileys in-process. Same HTTP contract, same Mongo collections, same port (4001). The Rust crate at `services/sabwa-engine/` is deprecated and will be removed. See `CHANGELOG-sabwa-rust-to-node.md` for the cutover details.

---

## Table of contents

1. [Positioning vs WaChat](#1-positioning-vs-wachat)
2. [High-level architecture](#2-high-level-architecture)
3. [Mongo data model](#3-mongo-data-model)
4. [Baileys session lifecycle](#4-baileys-session-lifecycle)
5. [Real-time delivery](#5-real-time-delivery)
6. [Page-by-page UI plan (30 pages)](#6-page-by-page-ui-plan-30-pages)
7. [Responsive strategy](#7-responsive-strategy)
8. [Worker & queue design](#8-worker--queue-design)
9. [Anti-ban / compliance layer](#9-anti-ban--compliance-layer)
10. [RBAC & plan gating](#10-rbac--plan-gating)
11. [Credits / metering](#11-credits--metering)
12. [Webhooks & public API](#12-webhooks--public-api)
13. [Server actions inventory](#13-server-actions-inventory)
14. [File structure](#14-file-structure)
15. [Phased delivery roadmap](#15-phased-delivery-roadmap)
16. [Open risks & decisions](#16-open-risks--decisions)

---

## 1. Positioning vs WaChat

| Dimension          | WaChat (`/wachat`)                       | SabWa (`/sabwa`)                     |
| ------------------ | ---------------------------------------- | ---------------------------------------------- |
| Account type       | WhatsApp **Business Cloud API** (Meta)   | **Personal** number via WhatsApp Web pairing   |
| Approval needed    | Meta business verification, template review | None — QR / pair-code only                     |
| Rate limits        | Meta tier system (250 → 100k/day)        | Self-imposed (anti-ban heuristics)             |
| Templates          | Pre-approved HSM templates only          | Free-form text/media — no template approval    |
| Groups             | Limited (no group send from Cloud API)   | **Full group support**                         |
| Status / Stories   | ❌                                       | ✅                                             |
| Use case           | Bulk marketing, customer support at scale | Personal automation, small-team outreach, scheduled posts to family/friends/community groups |
| Ban risk           | Low (official channel)                   | **High** if misused → mandatory rate limiter   |

**Both modules co-exist.** The rail will show WaChat (WhatsAppIcon, green) and SabWa (a new icon, blue) side by side.

---

## 2. High-level architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Browser                                    │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────────────┐ │
│  │ /sabwa │  │  Sidebar / Rail│  │ SSE / WebSocket client  │ │
│  └────────┬─────────┘  └────────┬───────┘  └──────────┬──────────────┘ │
└───────────┼─────────────────────┼─────────────────────┼────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Next.js 16 (App Router)                        │
│  Server Actions  │  /api/sabwa/stream  │  /api/sabwa/webhook            │
└────────────────┬────────────────────────────────────────────────────────┘
                 │ Redis pub/sub
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SabWa Worker (PM2 cluster)                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │  Baileys session pool — one socket per linked account        │     │
│   │  ├─ Auth state in Mongo (sabwa_sessions)                     │     │
│   │  ├─ Message handler → Mongo + Redis pub                      │     │
│   │  ├─ Outbound queue → rate-limited sender                     │     │
│   │  └─ Scheduler tick (BullMQ delayed jobs)                     │     │
│   └──────────────────────────────────────────────────────────────┘     │
└──────────────────┬──────────────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐      ┌──────────────────┐
│   MongoDB    │      │  Cloudflare R2   │
│ (chats, msgs)│      │  (media via      │
│              │      │   SabFiles)      │
└──────────────┘      └──────────────────┘
```

**Why Baileys:** No Chromium → ~80MB RAM per session vs ~400MB for whatsapp-web.js. Multi-device API. Pure TS — drops directly into the `sabwa-node` Express server (no sidecar, no IPC).

**Why a separate PM2 process:** Baileys sockets are long-lived and stateful. We can't hold them in Next.js serverless functions. `sabwa-node` runs as its own PM2 app (`name: 'sabwa-node'`, `cwd: ./services/sabwa-node`) on port 4001 — the Next.js layer calls it over HTTP using `SABWA_ENGINE_URL` + `SABWA_ENGINE_TOKEN`.

---

## 3. Mongo data model

All collections prefixed `sabwa_`. All documents carry `projectId: ObjectId` for multi-tenancy.

### `sabwa_sessions`
One per linked WhatsApp number per project.
```ts
{
  _id, projectId, userId,                  // owner of this session
  phoneE164,                                // +91xxxxxxxxxx, populated post-pair
  pushName,                                 // display name from WA
  profilePicUrl,                            // cached avatar (R2)
  status: 'pending' | 'connected' | 'logged_out' | 'banned' | 'error',
  pairMethod: 'qr' | 'code',
  authState: Binary,                        // encrypted Baileys creds blob
  deviceMeta: { platform, appVersion, batteryLevel },
  lastConnectedAt, lastSeenAt,
  workerNodeId,                             // which PM2 instance owns this socket
  banSignals: [{ ts, kind, detail }],       // for ban-risk detection
  rateLimitProfile: 'safe' | 'normal' | 'aggressive',
  createdAt, updatedAt,
}
```

### `sabwa_chats`
Cached chat list (mirrored from Baileys store).
```ts
{
  _id, projectId, sessionId,
  jid: string,                              // 91xxxxxxxxxx@s.whatsapp.net | 12030...@g.us
  type: 'individual' | 'group' | 'broadcast' | 'status',
  name, profilePicUrl,
  lastMessage: { id, body, ts, fromMe },
  unreadCount, pinned, archived, muted, muteEndAt,
  labels: [labelId],
  isReadOnly,                               // for community announcement groups
  participants?: number,                    // groups only
  updatedAt,
}
```

### `sabwa_messages`
Append-only message log.
```ts
{
  _id, projectId, sessionId,
  chatJid, messageId,                       // Baileys' key.id
  fromJid, fromMe,
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'location' | 'contact' | 'poll' | 'reaction' | 'system',
  body, mediaUrl, mediaMime, mediaSize, caption,
  quotedMessageId,
  reactions: [{ jid, emoji, ts }],
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
  forwarded, starred,
  ts, editedAt, deletedAt,
}
```
Indexes: `(sessionId, chatJid, ts)`, `(sessionId, messageId)` unique, `(sessionId, starred)`.

### `sabwa_groups`
Group-specific metadata cache.
```ts
{
  _id, projectId, sessionId,
  jid,                                      // ends in @g.us
  subject, description, creator, createdAt,
  participants: [{ jid, isAdmin, isSuperAdmin, joinedAt }],
  inviteCode,
  announcement,                             // admins-only chat
  restrict,                                 // admins-only edit
  ephemeralDuration,                        // disappearing messages
  category: string,                         // user-tagged ("Family", "Work", "Communities")
}
```

### `sabwa_contacts`
```ts
{
  _id, projectId, sessionId,
  jid, phoneE164, name, pushName, profilePicUrl,
  isBusiness, isBlocked, isMyContact,
  tags: [string], customFields, notes,
  lastInteractionAt,
}
```

### `sabwa_scheduled`
```ts
{
  _id, projectId, sessionId,
  kind: 'one_off' | 'recurring',
  scheduledFor: Date, cron?: string, timezone,
  targets: [{ jid, type: 'individual' | 'group' | 'broadcast' }],
  payload: { type, body?, mediaSabFileId?, caption?, mentionAll? },
  status: 'pending' | 'sent' | 'failed' | 'cancelled',
  attemptCount, lastError, sentAt,
  bullJobId,
}
```

### Other collections
- `sabwa_templates` — saved message templates with `{{variables}}`
- `sabwa_quick_replies` — slash-command snippets
- `sabwa_auto_replies` — rule-based (keyword / time-window / contact-list)
- `sabwa_broadcasts` — bulk-sender campaigns with progress + per-recipient status
- `sabwa_labels` — colored labels for chats
- `sabwa_webhooks` — outbound webhook endpoints + events subscription
- `sabwa_audit_log` — every action (message sent, schedule created, session paired, etc.)
- `sabwa_api_keys` — REST API keys for this module

---

## 4. Baileys session lifecycle

```
┌──────────────────┐    user clicks "Connect"
│  Connect Account │ ─────────────────────────┐
└──────────────────┘                          │
                                              ▼
                  ┌──────────────────────────────────────────┐
                  │  Worker spawns Baileys socket            │
                  │  Mode A: emit QR every 30s → /api/sabwa/ │
                  │          stream → browser shows QR       │
                  │  Mode B: request 8-digit pair code via   │
                  │          phone number → display to user  │
                  └────────────────┬─────────────────────────┘
                                   │ user scans QR / enters code
                                   ▼
                  ┌──────────────────────────────────────────┐
                  │  Baileys "connection.update" → open      │
                  │  Persist creds → sabwa_sessions          │
                  │  Push status=connected → SSE             │
                  └──────────────────────────────────────────┘
                                   │
                                   ▼
                  ┌──────────────────────────────────────────┐
                  │  Initial sync                            │
                  │  ├─ history-sync messages → bulk insert  │
                  │  ├─ chats list → upsert sabwa_chats      │
                  │  ├─ contacts → upsert sabwa_contacts     │
                  │  └─ groups metadata → upsert sabwa_groups│
                  └──────────────────────────────────────────┘
                                   │
                                   ▼
                       Steady-state event loop
            messages.upsert / message.update / presence.update /
            groups.update / contacts.upsert / call / connection.update
```

**Reconnect:** Worker auto-reconnects with exponential backoff. After 5 failed attempts → status `error` and notify user.

**Logout:** User clicks "Disconnect" → `sock.logout()` → wipe `authState` → status `logged_out`. Chats/messages retained unless user picks "Also delete data".

**Multi-account per project:** Allowed. UI has session switcher in the top bar (similar to WhatsApp Web's account switcher in the new app).

---

## 5. Real-time delivery

- **Browser ⇄ Server:** SSE on `/api/sabwa/stream?sessionId=...`. Single stream per tab, events fan-out: `message`, `chat`, `presence`, `qr`, `status`, `typing`.
- **Worker → Server:** Redis pub/sub on `sabwa:{sessionId}:events`. Each Next.js route's SSE handler subscribes to the matching channel.
- **Outbound:** Browser → server action → Redis `sabwa:{sessionId}:outbound` queue → worker dequeues and `sock.sendMessage(...)`.
- **Typing indicator:** Local optimistic update + worker presence update.
- **Read receipts:** Worker emits `message.update { status: 'read' }` → browser patches message.

---

## 6. Page-by-page UI plan (30 pages)

Every page is **mobile-first responsive**. Three-pane layouts collapse to a single pane below `md:`, with a back button on detail views.

### Module nav (left sub-rail when on `/sabwa/*`)

```
┌─────────────────────────────────┐
│ ▸ Overview                      │
│ ▸ Inbox                         │
│ ▸ Chats                         │
│ ▸ Groups                        │
│   ├─ All groups                 │
│   ├─ By category                │
│   └─ Group manager              │
│ ▸ Broadcasts                    │
│ ▸ Bulk sender                   │
│ ▸ Scheduler                     │
│   ├─ Calendar                   │
│   └─ Queue                      │
│ ▸ Contacts                      │
│ ▸ Templates                     │
│ ▸ Quick replies                 │
│ ▸ Auto-reply                    │
│ ▸ Chatbot flows                 │
│ ▸ AI assistant                  │
│ ▸ Media library                 │
│ ▸ Status / Stories              │
│ ▸ Calls                         │
│ ▸ Labels                        │
│ ▸ Starred                       │
│ ▸ Analytics                     │
│ ▸ Export / Backup               │
│ ▸ Webhooks                      │
│ ▸ API keys                      │
│ ▸ Audit log                     │
│ ▸ Settings                      │
│   ├─ Profile                    │
│   ├─ Devices                    │
│   ├─ Privacy & security         │
│   ├─ Rate limits                │
│   └─ Notifications              │
└─────────────────────────────────┘
```

### Page 1 — **Overview** (`/sabwa`)
Hero: connected number, presence, profile pic. Cards: today's messages in/out, scheduled queue size, active groups, response-time median, ban-risk gauge (computed from velocity + report signals). Recent activity feed.
**Mobile:** stacked cards, sticky header.

### Page 2 — **Connect Account** (`/sabwa/connect`)
Two-mode flow:
- **QR mode** — 264×264px QR code refreshing every 30s, animated SabNode brand mark in centre. "Open WhatsApp → Settings → Linked Devices → Link a Device".
- **Pair-code mode** — phone-number input (libphonenumber-js validation), produces 8-character code (e.g. `JKLM-NPQR`) with monospace styling.
Live status pill: `Waiting` → `Pairing` → `Syncing` → `Ready`. Animated progress when initial sync runs.
**Mobile:** single column, QR scales to viewport width.

### Page 3 — **Linked Devices** (`/sabwa/devices`)
Table of all sessions for this project. Columns: phone, label, status, last seen, platform, paired on. Row actions: rename, logout, delete. "Connect another number" CTA — same UX as page 2.
**Mobile:** cards instead of table.

### Page 4 — **Inbox** (`/sabwa/inbox`)
The crown jewel. WhatsApp-Web-style 3-pane layout.

```
┌─────────────────────────────────────────────────────────────┐
│  Search  | Filter (All / Unread / Groups / Personal)        │
├──────────────┬────────────────────────┬─────────────────────┤
│ Chat list    │ Conversation           │ Contact / group     │
│ (300px)      │ (flex-1)               │ panel (320px)       │
│              │                        │                     │
│ • Mom        │  ┌─ message bubbles    │  Avatar             │
│ • Family ▣   │  │                     │  Number             │
│ • Office ▣   │  │  ┌─ composer        │  Common groups      │
│ • John       │  │  └─ + emoji 📎 🎙   │  Media / docs       │
└──────────────┴────────────────────────┴─────────────────────┘
```

**Composer features:**
- Text with markdown shortcuts (`*bold*`, `_italic_`, `~strike~`, `` `code` ``)
- Emoji picker (emoji-mart)
- SabFile attachment (`<SabFilePickerButton>`)
- Voice note recorder (MediaRecorder API → opus → R2)
- Reply / quote
- Mention picker for groups (`@`)
- Schedule send (calendar dropdown — defers to page 9)
- Disappearing-message toggle (per-chat)
- Send to multiple chats (forward style)

**Conversation features:**
- Day separators, sticky date header
- Read / delivered / sent ticks
- Reaction bar on long-press (touch) / hover (mouse)
- Star, reply, forward, copy, delete (for me / for everyone), info, edit (within 15min — WA limit)
- Media gallery viewer (swipe through)
- Voice note waveform with playback speed
- Document preview
- Location map preview
- Polls
- Search within chat

**Mobile:** Single pane with router-driven navigation. List → tap → conversation full screen → tap header → contact panel.

### Page 5 — **Chats** (`/sabwa/chats`)
Same inbox but filtered to `type=individual`. Adds bulk actions toolbar (multi-select chats): mark read, archive, mute, label, export.

### Page 6 — **Groups** (`/sabwa/groups`)
Filtered to `type=group`. Adds **group-specific features**:
- Category strip at top (user-defined: Family / Work / Communities / Other) with drag-to-categorize
- "Announcement only" badge for read-only groups
- Member count, admin badge if you're admin
- Group invite-link generator (admin only)
- "Mute all groups" toggle

### Page 7 — **Groups — by category** (`/sabwa/groups/categories`)
Manage categories (CRUD). Bulk-assign chats to categories. Drag-and-drop reorder.

### Page 8 — **Group Manager** (`/sabwa/groups/[jid]/manage`)
Full admin console for a single group:
- Edit subject / description / icon
- Add / remove members (paste numbers or pick from contacts)
- Promote / demote admins
- Settings: who can send, who can edit info, disappearing-message timer
- Pending join requests (community groups)
- Generate / revoke invite link, view scans
- Export member list
- Bulk DM all members (with rate limit warning)

### Page 9 — **Broadcasts** (`/sabwa/broadcasts`)
WhatsApp's native broadcast lists (recipients receive as 1:1, no reply visibility between recipients). CRUD broadcast lists, send composer, history.

### Page 10 — **Bulk Sender** (`/sabwa/bulk`)
Two-step wizard:
1. **Audience** — paste numbers, upload CSV, pick label/category, or pick group members.
2. **Compose** — template picker, variable mapping (`{{name}}`, `{{firstName}}`, `{{custom1}}`), preview with sample row, send rate (msgs/min), randomized humanization delay (±X seconds), media attach, A/B variant.
3. **Review** — shows estimated duration, ban-risk score, confirmation modal with "I understand" checkbox.
4. **Run** — live progress bar, per-recipient status, pause / resume / abort.

**Mandatory limits** (configurable per plan):
- Max 1000 recipients per campaign on Free; 10k on Pro
- Hard cap 30 msgs/min, default 8 msgs/min
- Minimum 4-second jitter
- Auto-pause if WA presence drops or if 3 consecutive sends fail

### Page 11 — **Message Scheduler — Calendar** (`/sabwa/scheduler`)
FullCalendar-style month/week/day view. Each scheduled message is a draggable event. Drag to reschedule, click to edit.

### Page 12 — **Scheduler — Queue** (`/sabwa/scheduler/queue`)
Table view of all pending/sent/failed scheduled messages. Filter by chat, group, broadcast. Bulk edit (reschedule, cancel).

### Page 13 — **Schedule new message** (modal — opens from anywhere)
Pick target(s) → compose → pick date/time + recurrence (none, daily, weekly, monthly, cron) → timezone. Recurring messages get a parent row in the queue and child instances pre-materialised 30 days out.

### Page 14 — **Contacts** (`/sabwa/contacts`)
DataTable: avatar, name, number, last interaction, tags, source (synced / manual / imported). Bulk: tag, label, message, export, block. Single contact drawer shows mutual groups, all messages, scheduled messages, custom fields.

### Page 15 — **Templates** (`/sabwa/templates`)
Saved templates with rich text + media + `{{vars}}`. Category folders. Search. Usage analytics (how often used).

### Page 16 — **Quick Replies** (`/sabwa/quick-replies`)
Slash-command shortcuts (e.g. `/thanks` expands to a saved blurb). Hotkey support in composer.

### Page 17 — **Auto-Reply** (`/sabwa/auto-reply`)
Rule builder: trigger (keyword match / contains / regex / time-of-day / contact-label / outside business hours / first-message-from-new-contact) → action (send template / forward to flow / set away message / add label). Toggle per rule. Test sandbox: paste an inbound message, see which rule fires.

### Page 18 — **Chatbot flows** (`/sabwa/flows`)
Embed SabFlow's flow builder, scoped to SabWa triggers and actions. Triggers: `message_received`, `keyword_match`, `new_contact`, `group_added`. Actions: `send_message`, `send_media`, `add_label`, `call_webhook`, `pause`, `branch_by_input`.

### Page 19 — **AI Assistant** (`/sabwa/ai`)
Per-chat AI inbox:
- "Suggest reply" — 3 candidate replies based on conversation context
- "Summarise chat" — last 24h / 7d / all
- "Translate" — auto-detect → target language
- "Tone" — rewrite reply as casual / formal / friendly
- "Auto-pilot mode" — AI replies autonomously to whitelisted contacts (with audit log + human takeover)

### Page 20 — **Media Library** (`/sabwa/media`)
Unified gallery of all media sent/received across this session. Tabs: photos / videos / audio / docs / voice notes. Filter by chat, date, sender. Bulk download, push to SabFiles, delete.

### Page 21 — **Status / Stories** (`/sabwa/status`)
View friends' statuses (image / video / text). Post new status (text with bg colour, image, video). Per-status views list. Privacy: choose audience.

### Page 22 — **Calls** (`/sabwa/calls`)
Call log (read-only — Baileys doesn't support initiating reliably). Filter by missed / incoming / outgoing / video. Per-call duration & participant.

### Page 23 — **Labels** (`/sabwa/labels`)
CRUD labels (name + colour). Assign to chats. Filter inbox by label.

### Page 24 — **Starred Messages** (`/sabwa/starred`)
Cross-chat bookmark view. Group by chat. Jump-to-message link.

### Page 25 — **Analytics** (`/sabwa/analytics`)
Recharts dashboards:
- Messages in/out by day (line)
- Response time histogram
- Top 10 contacts by volume
- Group activity heatmap (hour × day)
- Hourly send pattern (helps anti-ban tuning)
- Scheduled message hit rate (sent vs failed)
- AI usage (credits consumed)

### Page 26 — **Export / Backup** (`/sabwa/export`)
Pick chats → format (JSON / CSV / WhatsApp `.txt` / PDF) → include-media toggle → "Run export". Background job emits R2 link + email. History of past exports.

### Page 27 — **Webhooks** (`/sabwa/webhooks`)
Outbound webhook endpoints. Event subscriptions (`message.received`, `message.status`, `group.joined`, `session.disconnected`, `scheduled.sent`). HMAC signing secret. Delivery log with retry.

### Page 28 — **API Keys** (`/sabwa/api-keys`)
Generate REST tokens scoped to this module. Reuses pattern from `/dashboard/api`. Docs link to `/dashboard/api/docs#sabwa`.

### Page 29 — **Audit Log** (`/sabwa/audit`)
Append-only log: actor, action, target, ts, ip. Filter, search, export. Mandatory for compliance.

### Page 30 — **Settings** (`/sabwa/settings`)
Tabbed sub-pages:
- **Profile** — push name, about, profile pic (sync from / push to WA)
- **Devices** — link → page 3
- **Privacy & security** — 2FA, blocked contacts, read-receipt visibility, last-seen visibility, who-can-add-to-groups, session encryption key rotation
- **Rate limits** — pick profile (safe / normal / aggressive), per-rule overrides, warmup mode (new sessions ramp from 5 to 30 msgs/min over 7 days)
- **Notifications** — desktop, email, push, sound, mute schedules
- **Danger zone** — disconnect, wipe all data, delete account

---

## 7. Responsive strategy

| Breakpoint     | Layout                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| `< sm` (mobile)| Single pane. Bottom tab bar replaces sub-rail. Drawer for chat details. |
| `sm` – `md`    | Two pane: list + detail. Hide right panel.                              |
| `md` – `xl`    | Two pane with right panel toggleable.                                   |
| `> xl`         | Full three-pane.                                                        |

- Touch targets ≥ 44×44.
- Long-press on touch = right-click on desktop (use `react-aria` `usePress`).
- Virtualised chat list and message list (`@tanstack/react-virtual`) — must handle 50k-message chats.
- Pull-to-refresh on mobile inbox.
- Swipe-to-archive / swipe-to-reply on mobile chat rows.
- All modals upgrade to bottom-sheets below `md:` (existing `<ResponsiveDialog>` pattern in repo).

---

## 8. Worker & queue design

**PM2 process:** `sabwa-node` (Node.js + Express + Baileys, in `services/sabwa-node/`). Listens on :4001 and also owns the Baileys socket pool and BullMQ consumers — no separate worker process.

Responsibilities:
1. Maintain Baileys socket pool (one per `sabwa_sessions` doc with `status=connected`).
2. Subscribe to Redis queues:
   - `sabwa:{sessionId}:outbound` (LPUSH from server actions, BRPOP in worker)
   - `sabwa:scheduled` (BullMQ delayed queue)
   - `sabwa:bulk:{campaignId}` (per-campaign queue with paced consumption)
3. Persist events to Mongo, publish to Redis pub channel `sabwa:{sessionId}:events`.
4. Tick every 30s: prune disconnected sessions, refresh QRs for pending pairs, refresh presence.
5. Graceful shutdown: `sock.end()` on SIGTERM, mark `status=error` if not clean.

**Horizontal scaling:** Worker reads `WORKER_NODE_ID` env var. Each session is sticky to the node that paired it (avoid races). A coordinator (Redis Redlock) can migrate orphan sessions if a node dies.

**BullMQ jobs:**
- `sabwa:send` — one outbound message
- `sabwa:scheduled-tick` — repeatable, every 30s, finds due scheduled messages and pushes to send queue
- `sabwa:bulk-send` — bulk campaign chunks
- `sabwa:export` — chat export jobs

---

## 9. Anti-ban / compliance layer

Personal-WA bulk sending is the #1 cause of bans. We harden by default:

1. **Rate limit profiles** (per-session)
   - `safe`: 8/min, ±4s jitter, max 500/day
   - `normal`: 15/min, ±3s jitter, max 2000/day
   - `aggressive`: 30/min, ±2s jitter, max 10000/day (warning shown)
2. **Warmup mode** — new sessions start at 5/min and ramp linearly over 7 days.
3. **Velocity guard** — drop send if last 60s exceeds profile.
4. **Diversity guard** — refuse identical body to >50 recipients/hour (force template variation or `{{firstName}}`).
5. **Presence guard** — if WA reports session "expecting reconnect" or "stream:error", auto-pause campaigns.
6. **Ban-signal collector** — count delivery failures, blocked-by-recipient signals, missing acks. Display ban-risk gauge on Overview.
7. **First-contact policy** — never bulk-message contacts who have never messaged you (toggle).
8. **Disclaimer + ToS gate** — first-run modal makes user acknowledge WhatsApp ToS and ban risk before enabling bulk features.

---

## 10. RBAC & plan gating

New permission keys (added to `lib/rbac.ts`):

```
sabwa_overview, sabwa_connect, sabwa_inbox, sabwa_chats, sabwa_groups,
sabwa_group_manage, sabwa_broadcasts, sabwa_bulk_send, sabwa_scheduler,
sabwa_contacts, sabwa_templates, sabwa_auto_reply, sabwa_flows, sabwa_ai,
sabwa_media, sabwa_status, sabwa_calls, sabwa_labels, sabwa_starred,
sabwa_analytics, sabwa_export, sabwa_webhooks, sabwa_api_keys,
sabwa_audit, sabwa_settings
```

Plan gating (added to `lib/plans.ts`):

| Plan        | Sessions | Daily send cap | Scheduler | Bulk | AI replies |
| ----------- | -------- | -------------- | --------- | ---- | ---------- |
| Free        | 1        | 100            | ✓ (10)    | ✗    | ✗          |
| Pro         | 3        | 2,000          | ✓ (∞)     | ✓    | ✓ (100/mo) |
| Business    | 10       | 10,000         | ✓         | ✓    | ✓ (1k/mo)  |
| Enterprise  | ∞        | custom         | ✓         | ✓    | ✓ (∞)      |

---

## 11. Credits / metering

- Inbound messages: free
- Outbound messages: 0 credits (personal, no Meta cost), but counted toward plan daily cap
- AI suggestions: 1 credit per call, 2 credits per autopilot reply
- Scheduled messages: 0 credits at create time, count as a normal send at fire time
- Storage: media counts toward SabFiles quota

Hook into existing `lib/credits.ts` `chargeCredits()` API.

---

## 12. Webhooks & public API

REST endpoints under `/api/sabwa/v1/`:

```
POST   /sessions/:id/messages           Send a message
GET    /sessions/:id/chats              List chats
GET    /sessions/:id/chats/:jid/messages
POST   /sessions/:id/groups             Create group
POST   /sessions/:id/groups/:jid/members
POST   /sessions/:id/scheduled          Schedule message
GET    /sessions/:id/contacts
POST   /sessions/:id/broadcasts
```

All auth via `Authorization: Bearer <sabwa_api_key>`. Rate limited per key.

Outbound webhooks (signed with HMAC-SHA256):
- `message.received`, `message.status`, `chat.updated`, `group.joined`, `group.left`, `session.connected`, `session.disconnected`, `scheduled.fired`

---

## 13. Server actions inventory

Group under `src/app/actions/sabwa.actions.ts`:

```ts
// Sessions
pairSession(projectId, method, phone?)         // returns { sessionId, qr? | pairCode? }
logoutSession(sessionId)
renameSession(sessionId, label)
listSessions(projectId)

// Chats
listChats(sessionId, filter)
getChatMessages(sessionId, jid, cursor)
sendMessage(sessionId, jid, payload)
markRead(sessionId, jid)
pinChat / muteChat / archiveChat / deleteChat

// Groups
createGroup(sessionId, subject, participants)
addParticipants / removeParticipants / promoteAdmin / demoteAdmin
updateGroupSubject / updateGroupDescription / updateGroupIcon
getInviteCode / revokeInviteCode
setGroupCategory(jid, categoryId)

// Broadcasts & bulk
createBroadcastList / updateBroadcastList / deleteBroadcastList
sendBroadcast(sessionId, broadcastId, payload)
startBulkCampaign(sessionId, campaignDraft)
pauseBulkCampaign / resumeBulkCampaign / abortBulkCampaign

// Scheduler
scheduleMessage(sessionId, draft)
updateScheduledMessage / cancelScheduledMessage
listScheduledMessages(sessionId, filter)

// Contacts
listContacts / upsertContactTags / blockContact / unblockContact

// Templates / quick replies / auto-reply / flows
crud* … (standard)

// AI
suggestReply(sessionId, chatJid, n=3)
summariseChat(sessionId, chatJid, window)
translateMessage(messageId, targetLang)

// Analytics / export / webhooks / api keys / audit
… (standard)

// Settings
updateProfile / updatePresenceSettings / setRateLimitProfile / setWarmupEnabled
```

All actions: `'use server'`, validate `projectId` ownership, check RBAC, charge credits where applicable, write audit log entry.

---

## 14. File structure

```
src/
├── app/
│   ├── actions/
│   │   └── sabwa.actions.ts
│   ├── api/
│   │   └── sabwa/
│   │       ├── stream/route.ts            # SSE
│   │       ├── webhook/route.ts            # outbound webhook receiver (for engine-side events)
│   │       └── v1/
│   │           └── [...]/route.ts          # REST API
│   └── sabwa/
│           ├── layout.tsx                  # sub-rail + session switcher
│           ├── page.tsx                    # 1. Overview
│           ├── connect/page.tsx            # 2. Connect
│           ├── devices/page.tsx            # 3. Devices
│           ├── inbox/page.tsx              # 4. Inbox
│           ├── chats/page.tsx              # 5. Chats
│           ├── groups/
│           │   ├── page.tsx                # 6. Groups
│           │   ├── categories/page.tsx     # 7. Categories
│           │   └── [jid]/manage/page.tsx   # 8. Group manager
│           ├── broadcasts/page.tsx         # 9
│           ├── bulk/page.tsx               # 10
│           ├── scheduler/
│           │   ├── page.tsx                # 11. Calendar
│           │   └── queue/page.tsx          # 12
│           ├── contacts/page.tsx           # 14
│           ├── templates/page.tsx          # 15
│           ├── quick-replies/page.tsx      # 16
│           ├── auto-reply/page.tsx         # 17
│           ├── flows/page.tsx              # 18
│           ├── ai/page.tsx                 # 19
│           ├── media/page.tsx              # 20
│           ├── status/page.tsx             # 21
│           ├── calls/page.tsx              # 22
│           ├── labels/page.tsx             # 23
│           ├── starred/page.tsx            # 24
│           ├── analytics/page.tsx          # 25
│           ├── export/page.tsx             # 26
│           ├── webhooks/page.tsx           # 27
│           ├── api-keys/page.tsx           # 28
│           ├── audit/page.tsx              # 29
│           ├── settings/
│           │   ├── page.tsx                # 30 (Profile default)
│           │   ├── devices/page.tsx
│           │   ├── privacy/page.tsx
│           │   ├── rate-limits/page.tsx
│           │   └── notifications/page.tsx
│           └── _components/
│               ├── sabwa-sub-rail.tsx
│               ├── session-switcher.tsx
│               ├── chat-list.tsx
│               ├── chat-list-row.tsx
│               ├── conversation-pane.tsx
│               ├── message-bubble.tsx
│               ├── composer.tsx
│               ├── composer-emoji.tsx
│               ├── composer-attachment.tsx
│               ├── voice-recorder.tsx
│               ├── contact-panel.tsx
│               ├── group-info-panel.tsx
│               ├── schedule-dropdown.tsx
│               ├── ban-risk-gauge.tsx
│               └── connect-qr.tsx
├── components/wabasimplify/
│   └── custom-sidebar-components.tsx       # extend with SabWaIcon
├── config/
│   └── dashboard-config.ts                 # add sabwaMenuGroups + appIcons entry
├── lib/
│   ├── sabwa/
│   │   ├── baileys-engine.ts               # session pool, event bridge
│   │   ├── outbound.ts                     # rate-limited send
│   │   ├── scheduler.ts                    # BullMQ wiring
│   │   ├── bulk.ts                         # campaign runner
│   │   ├── anti-ban.ts                     # heuristics
│   │   ├── ai.ts                           # suggest/summarise/translate
│   │   ├── webhooks.ts                     # outbound webhook dispatcher
│   │   ├── export.ts                       # chat export formats
│   │   ├── rbac-keys.ts                    # permission key constants
│   │   └── types.ts                        # shared types
│   ├── rbac.ts                             # add sabwa_* keys
│   └── plans.ts                            # add sabwa plan limits
└── workers/
    └── sabwa/
        ├── index.ts                        # PM2 entrypoint
        ├── session-pool.ts
        ├── event-bridge.ts
        └── scheduler-tick.ts

ecosystem.config.js → add sabwa-worker process
```

---

## 15. Phased delivery roadmap

| Phase | Scope                                                                                                | Files (est) | Days |
| ----- | ---------------------------------------------------------------------------------------------------- | ----------- | ---- |
| **0** | Add module to rail / `appIcons` / `dashboard-config`; scaffold empty pages 1–30 with `<ComingSoon>`  | ~35         | 1    |
| **1** | Baileys worker skeleton + pairing flow (pages 2, 3); SSE plumbing; `sabwa_sessions` collection       | ~15         | 3    |
| **2** | Inbox (page 4) read-only: chat list + conversation view + initial sync; `sabwa_chats`, `sabwa_messages` | ~25       | 5    |
| **3** | Composer: send text + media + reactions + reply + edit + delete; read receipts; typing                | ~15         | 4    |
| **4** | Groups split (pages 5, 6, 7, 8) + Group Manager full CRUD                                            | ~18         | 4    |
| **5** | Scheduler (pages 11, 12, 13) + BullMQ wiring; recurring messages                                     | ~12         | 3    |
| **6** | Broadcasts + Bulk Sender (pages 9, 10) with rate limits + anti-ban + warmup                          | ~14         | 4    |
| **7** | Contacts, Labels, Templates, Quick Replies, Starred (pages 14, 15, 16, 23, 24)                       | ~12         | 3    |
| **8** | Auto-Reply + Chatbot flows + AI Assistant (pages 17, 18, 19)                                         | ~15         | 4    |
| **9** | Media library, Status, Calls (pages 20, 21, 22)                                                      | ~10         | 2    |
| **10**| Analytics, Export, Audit log (pages 25, 26, 29)                                                      | ~8          | 2    |
| **11**| Webhooks + REST API (pages 27, 28)                                                                   | ~12         | 3    |
| **12**| Settings sub-pages (page 30) + Devices / Privacy / Rate limits / Notifications                       | ~8          | 2    |
| **13**| Hardening: virtualisation, dark-mode passes, a11y audit, e2e tests, perf                             | —           | 3    |

**Total ≈ 199 files / ≈ 43 working days for a single dev.** Parallelisable across 2–3 devs to ~20 days. Phase 0 ships in day 1 to make the module visible immediately.

---

## 16. Open risks & decisions

1. **Meta ToS** — Personal-WA automation violates WA ToS for "unauthorized use of automated/bulk messaging". We must surface this in onboarding, audit log, and plan T&Cs. **Decision needed:** are we OK shipping it with disclaimers, or restrict to "self-help" only (no bulk / no auto-reply)?
2. **Ban liability** — Users will be banned despite rate limits. Need clear support policy: not refundable, not our fault.
3. **Storage growth** — A user with 50 groups × 1k messages/day = 50k inserts/day per session. Need TTL or cold-storage strategy (default: retain 90 days hot, archive to R2 JSONL beyond).
4. **PM2 → Vercel** — Baileys is long-lived, can't run on Fluid Compute serverless. `sabwa-node` must remain on a PM2 self-hosted node. UI runs fine on Vercel.
5. **Encryption of `authState`** — Stored in Mongo. Encrypted with `AUTH_STATE_KEY` (base64 32-byte) using AES-256-GCM before persisting. `SABWA_JWT_SECRET` signs the realtime/SSE tokens minted by Next.js.
6. **Multi-region** — Initially single region. WA presence-anchor concept means session must connect from a stable IP — frequent IP changes trigger re-verification.
7. **Mobile push** — Phase 12 or later. Requires SabNode mobile app (separate roadmap).
8. **Voice / video calls** — Baileys can detect calls but cannot bridge audio. Out of scope for V1; revisit when Baileys gains call support.
9. **Status posting** — Baileys supports text/image status but the API is brittle. Mark as "beta" in V1.
10. **Polls / community sub-groups** — WA features that Baileys partially supports. Ship read-only first, write in a later phase.

---

## Appendix A — Icon

A new `SabWaIcon` will be added to `custom-sidebar-components.tsx` — a stylised WhatsApp speech bubble in **SabNode blue** (`#2563eb`) instead of WhatsApp green, to visually separate it from WaChat (which keeps the official green). The bubble contains a tiny "S" mark or a link/chain glyph to denote "linked device".

## Appendix B — Naming inside the UI

- The user-facing label is **SabWa**.
- Help text always clarifies: "Connect your personal WhatsApp via Linked Devices".
- Never use Meta / WhatsApp trademarks as primary brand — say "personal WhatsApp" not "WhatsApp™".

## Appendix C — Out of scope (V1)

- WhatsApp Business app (different protocol — WaChat covers Business API)
- Cross-account chat forwarding (Phase 14+)
- E2E group encryption key export
- WhatsApp Pay (Personal) — regulated, separate compliance project
- Cross-channel inbox (will be a separate "Unified Inbox" module)
