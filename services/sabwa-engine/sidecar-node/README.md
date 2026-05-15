# sabwa-baileys-sidecar

A long-lived Node.js process that runs [Baileys](https://github.com/WhiskeySockets/Baileys) — the pure-TS WhatsApp Multi-Device protocol library — on behalf of the Rust `sabwa-engine` parent. The Rust binary spawns this sidecar, writes JSON-RPC requests to its stdin, and consumes responses and unsolicited events from its stdout.

> **You normally do not run this directly.** The Rust parent manages the lifecycle: spawn, supervise, restart on crash, kill on shutdown. The standalone mode below exists only for debugging the protocol.

---

## Run standalone (debug only)

```bash
pnpm install
node src/index.js
```

Then type a JSON-RPC request followed by `Enter`. Each line must be one complete JSON object:

```jsonc
{"id":"1","method":"pair","params":{"sessionId":"s1","method":"qr"}}
```

Logs are written to **stderr** with `pino`. Protocol traffic is written to **stdout** as newline-delimited JSON. Never `console.log()` from new code — use `pino` via stderr.

Set the log level with `SABWA_SIDECAR_LOG_LEVEL=debug` (default `info`).

---

## Protocol

Newline-delimited JSON over stdin/stdout. One JSON object per line. No length prefix.

### Request (parent → sidecar)

```jsonc
{ "id": "<uuid>", "method": "<name>", "params": { ... } }
```

### Response (sidecar → parent, replying to a request)

```jsonc
{ "id": "<uuid>", "ok": true,  "result": { ... } }
{ "id": "<uuid>", "ok": false, "error":  "<message>" }
```

### Event (sidecar → parent, unsolicited)

```jsonc
{ "event": "<name>", "sessionId": "<id>", "payload": { ... } }
```

Events have **no `id` field** — that is the parent's discriminator for distinguishing them from responses.

---

## JSON-RPC method catalogue

| Method               | Params                                                                                                                                                                              | Result                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pair`               | `{ sessionId, method: 'qr' \| 'code', phoneE164?, authState? }`                                                                                                                     | `{ sessionId, status }`                                                                                 |
| `resume`             | `{ sessionId, authState? }`                                                                                                                                                         | `{ sessionId, status }`                                                                                 |
| `send`               | `{ sessionId, chatJid, payload: { type, body?, data?, url?, caption?, mimetype?, fileName?, latitude?, longitude?, vcard?/vcards?, emoji?, targetKey?, quotedMessage?, gifPlayback? } }` | `{ messageId, serverTs }`                                                                               |
| `markRead`           | `{ sessionId, chatJid }`                                                                                                                                                            | `{ ok: true }`                                                                                          |
| `logout`             | `{ sessionId }`                                                                                                                                                                     | `{ ok: true }`                                                                                          |
| `getStatus`          | `{ sessionId }`                                                                                                                                                                     | `{ status, pairMethod?, lastError? }`                                                                   |
| `createGroup`        | `{ sessionId, subject, participants: string[] }`                                                                                                                                    | `{ groupJid, meta }`                                                                                    |
| `addParticipants`    | `{ sessionId, groupJid, jids }`                                                                                                                                                     | `{ result }`                                                                                            |
| `removeParticipants` | `{ sessionId, groupJid, jids }`                                                                                                                                                     | `{ result }`                                                                                            |
| `promoteAdmin`       | `{ sessionId, groupJid, jids }`                                                                                                                                                     | `{ result }`                                                                                            |
| `demoteAdmin`        | `{ sessionId, groupJid, jids }`                                                                                                                                                     | `{ result }`                                                                                            |
| `updateGroupSubject` | `{ sessionId, groupJid, subject }`                                                                                                                                                  | `{ ok: true }`                                                                                          |
| `getInviteCode`      | `{ sessionId, groupJid }`                                                                                                                                                           | `{ code }`                                                                                              |
| `revokeInviteCode`   | `{ sessionId, groupJid }`                                                                                                                                                           | `{ code }`                                                                                              |
| `setPresence`        | `{ sessionId, jid, kind: 'available' \| 'unavailable' \| 'composing' \| 'recording' \| 'paused' }`                                                                                  | `{ ok: true }`                                                                                          |

Each handler **throws on error**; `src/index.js` converts thrown errors into `{ ok: false, error }` responses.

### Send payload `data` vs `url`

For media types (`image`, `video`, `audio`, `voice`, `document`, `sticker`) pass either:

- `data`: base64-encoded bytes, or
- `url`: an HTTPS URL Baileys can fetch.

In the SabNode UI all media originates from **SabFiles** (R2), so the Rust parent typically sends a signed R2 URL.

---

## Event catalogue

These mirror what `services/sabwa-engine/src/realtime/events.rs::SabwaEvent` expects. All event payloads carry a Unix-ms `ts` where applicable.

| `event`                       | `payload`                                                                                          | Maps to `SabwaEvent` variant          |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `qr`                          | `{ qr, ts }`                                                                                       | `Qr`                                  |
| `pair_code`                   | `{ code, ts }` — `XXXX-XXXX`                                                                       | `PairCode`                            |
| `status`                      | `{ status: 'pending' \| 'connected' \| 'logged_out', detail?, ts }`                                | `Status`                              |
| `connected`                   | `{ authState: base64, phoneE164, pushName, ts }` — emitted **once**, immediately after `status:connected` so the parent can persist creds | (consumed by Rust to update DB; not a SabwaEvent) |
| `messages.upsert`             | `{ type, message }` — raw Baileys WAMessage                                                        | `Message` (after Rust normalises)     |
| `messages.update`             | `{ key, update }` — Baileys diff                                                                   | `MessageStatus`                       |
| `message_receipt.update`      | `{ key, receipt }`                                                                                 | `MessageStatus`                       |
| `chats.upsert` / `chats.update` | raw Baileys chat                                                                                  | `Chat`                                |
| `contacts.upsert` / `contacts.update` | raw Baileys contact                                                                          | (consumed by Rust into `sabwa_contacts`) |
| `groups.upsert` / `groups.update` | raw Baileys group metadata                                                                      | `Chat` + group metadata               |
| `group_participants.update`   | `{ id, participants, action }`                                                                     | group-membership delta                |
| `presence.update`             | `{ chat_jid, participant, presence, ts }`                                                          | `Presence` / `Typing`                 |

The Rust side is responsible for translating these into the strongly-typed `SabwaEvent` variants and re-publishing on the `sabwa:{sessionId}:events` Redis channel.

---

## Auth state

Baileys uses `useMultiFileAuthState`. Each session gets its own subdirectory under `auth-state/<sessionId>/`. That directory is the source of truth while the sidecar is running.

On every `connection: open` event, the sidecar emits a `connected` event whose `authState` field is a base64-encoded JSON map `{ filename: contents }`. The Rust parent persists that blob to `sabwa_sessions.authState` (encrypted with `SABWA_AUTH_KEY`).

When restarting a session, the parent calls `resume` with the same blob; the sidecar rehydrates the files to disk and starts the socket.

The `auth-state/` directory in this repo is committed with a `.gitkeep` so the per-session subdirs have a home. The contents (`auth-state/<sessionId>/*`) are **never** committed.

---

## Reconnect policy

Auto-reconnect uses exponential backoff (1s, 2s, 4s, …, capped at 60s) **unless** the disconnect reason is `DisconnectReason.loggedOut` — in that case the session is destroyed and a final `status: logged_out` event is emitted. The parent is expected to mark the corresponding `sabwa_sessions` row as `logged_out` and surface a "reconnect required" UI.

---

## Concurrency

A single sidecar handles 10+ concurrent sessions comfortably (each Baileys socket uses ~80 MB RAM). For larger deployments, run multiple sidecars and shard sessions across them by `sessionId` hash — the Rust supervisor owns that decision.

---

## Files

```
sidecar-node/
├── package.json
├── README.md (this file)
├── .eslintrc.json
├── auth-state/                  per-session Baileys creds (gitignored except .gitkeep)
└── src/
    ├── index.js                 entry point — RPC dispatcher
    ├── protocol.js              NDJSON read/write helpers
    ├── session-manager.js       Baileys socket pool + event bridge
    └── handlers/                one file per RPC method
        ├── pair.js
        ├── resume.js
        ├── send.js
        ├── markRead.js
        ├── logout.js
        ├── getStatus.js
        ├── createGroup.js
        ├── addParticipants.js
        ├── removeParticipants.js
        ├── promoteAdmin.js
        ├── demoteAdmin.js
        ├── updateGroupSubject.js
        ├── getInviteCode.js
        ├── revokeInviteCode.js
        └── setPresence.js
```
