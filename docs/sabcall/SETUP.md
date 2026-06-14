# SabCall — self-hosted setup (Routr SIP + media + engine)

This is the runbook to take SabCall from "coded + flag-gated" to **real calls**.
It uses **[Routr](https://routr.io)** — the open-source SIP stack from the
Fonoster family — as the signaling layer **instead of locking you into a
black-box PBX**. Routr is yours: self-hosted, MIT-licensed, and forkable, so
you can change routing/registrar/processor behavior whenever you need.

> **Honest architecture note.** Routr is a **SIP proxy + location server +
> registrar** — it decides *where a call goes* (number → trunk → agent), handles
> registration, and enforces ACLs. It is **not** a media server, so it does not
> by itself do IVR / record / play / TTS / conference. Those run on a **media
> tier**. The SabCall engine's call-control plane speaks **ARI** (the Asterisk
> REST Interface), so the media tier is an ARI-capable media server sitting
> behind Routr. Net: **Routr is the SIP brain you own and modify; the media
> server is a dumb RTP/ARI worker behind it.** Fully removing the ARI media tier
> (a pure-Routr build) is a roadmap item — see "Going Asterisk-free" at the end.

```
                    PSTN / carriers
                          │  SIP trunks
                          ▼
   ┌─────────────────────────────────────────────┐
   │  Routr  (SIP proxy · registrar · router)      │  ← open source, you fork this
   │  resources provisioned from SabCall           │
   └───────────────┬───────────────────────────────┘
                   │ routes SIP to the media tier / agents
                   ▼
   ┌───────────────────────────┐     ARI (REST + WS)
   │  Media server (ARI)        │◄──────────────────────┐
   │  RTP · record · playback   │                        │
   └───────────────────────────┘                         │
                                            ┌─────────────┴───────────────┐
   WebRTC softphone ─ SIP/WSS ─► Routr      │  services/sabcall-engine     │
                                            │  Stasis loop · verb runtime  │
   Next.js /sabcall ──HTTP──► sabcall-engine│  originate · pjsip/routr gen │
   (server actions, REST API, MCP)          │  TTS/STT/LLM/events adapters │
                                            └─────────────┬───────────────┘
                                                          ▼  Mongo (sabcall_* + projects)
```

---

## 1. Components & ports

| Component | What | Default |
|---|---|---|
| Next.js app | `/sabcall` UI, server actions, REST API, MCP, cron | 3000/3002 |
| `services/sabcall-engine` | Rust ARI control plane + Routr/pjsip generation | **4005** |
| Routr | SIP proxy/registrar/router (Docker) | 5060/udp, 51908 (api) |
| Media server (ARI) | RTP + media (record/play/bridge) | 8088 (ARI http) |
| MongoDB | `sabcall_*` collections + `projects` | 27017 |
| R2 / SabFiles | recording storage | — |

---

## 2. Prerequisites

- Node 24 + the SabNode app running (Mongo connected).
- Rust toolchain (to build `sabcall-engine`).
- Docker (for Routr + the media server).
- A SIP trunk from a carrier (Telnyx/Twilio Elastic SIP/your ITSP) **or** a test
  softphone, plus at least one DID.
- (Optional) provider HTTP endpoints for TTS, STT, and the LLM bridge (below).

---

## 3. Bring up Routr (the SIP layer you own)

```bash
# Routr ships a one-container quickstart + a docker-compose for production.
# Pin a version; fork the repo when you need to change routing/processor logic.
docker run -d --name routr \
  -p 5060:5060/udp -p 5060:5060/tcp -p 51908:51908 \
  -e EXTERNAL_ADDRS=<your.public.ip> \
  -e DATABASE_URL=postgres://routr:routr@routr-db:5432/routr \
  ghcr.io/fonoster/routr:latest
```

Routr keeps its resources (Domains, Trunks, Agents, Credentials, ACLs, Numbers)
in its own store. **SabCall generates them for you** from the SIP resources you
manage in the UI:

```bash
# Per project (tenant = the SabCall project id):
curl -H "Authorization: Bearer $SABCALL_ENGINE_TOKEN" \
  http://localhost:4005/v1/tenants/<projectId>/routr.json
```

That returns Routr v2-style resources (`Domain` / `Trunk` / `Agent` /
`Credentials`(ref) / `Acl` / `Number`). Apply them with the Routr SDK/CLI
(`@routr/ctl`) or the `files` connector. The mapping lives in
`services/sabcall-engine/src/routr.rs` — **edit it freely** to match your Routr
version's schema; it's plain, documented JSON generation. Secret *values* are
never emitted — only references (see the Secrets vault); inject the real
passwords into Routr out-of-band from SabVault.

---

## 4. Bring up the media tier (ARI)

The engine drives media over ARI. Run an ARI-capable media server and point the
engine at it. Generate its SIP/endpoint config from the same model:

```bash
curl -H "Authorization: Bearer $SABCALL_ENGINE_TOKEN" \
  http://localhost:4005/v1/tenants/<projectId>/pjsip.conf
```

`pjsip.rs` renders endpoints/auth/aors for trunks + SIP credentials. Enable the
ARI user + a Stasis app named `sabcall` (matches `ASTERISK_ARI_APP`), and route
inbound DIDs into `Stasis(sabcall)` so the engine's verb runtime takes over.

---

## 5. Build & run `sabcall-engine`

```bash
cd services/sabcall-engine
cargo build --release
# PM2 (matches the SabNode prod pattern):
pm2 start ./target/release/sabcall-engine --name sabcall-engine
```

### Engine env vars

| Var | Purpose | Default |
|---|---|---|
| `SABCALL_ENABLED` | master gate — `true` starts the Stasis loop | `false` |
| `PORT` | engine HTTP port | `4005` |
| `SABCALL_ENGINE_TOKEN` | bearer token the app + cron present | — (no-op if unset) |
| `MONGODB_URI` / `MONGODB_DB` | Mongo | `mongodb://127.0.0.1:27017` / `test` |
| `ASTERISK_ARI_URL` / `ASTERISK_ARI_WS_URL` | media-tier ARI REST + WS | `http://127.0.0.1:8088` / `ws://127.0.0.1:8088` |
| `ASTERISK_ARI_USER` / `ASTERISK_ARI_PASS` | ARI creds | `sabcall` / `sabcall` |
| `ASTERISK_ARI_APP` | Stasis app name | `sabcall` |
| `ASTERISK_SOUNDS_DIR` | where TTS clips are written (media-tier readable) | `/var/lib/asterisk/sounds/sabcall` |
| `SABCALL_DEFAULT_GREETING` | fallback media id | `sound:hello-world` |
| `SABCALL_TTS_URL` | HTTP TTS — POST `{text,format}` → audio bytes | unset |
| `SABCALL_STT_URL` | HTTP STT — POST `{audioUrl}` → `{text}` | unset |
| `SABCALL_LLM_URL` | LLM bridge for autopilot (point at the app, below) | unset |
| `SABCALL_AUTOPILOT_STREAM_URL` | websocket sink for the real-time AI agent | unset |
| `SABCALL_EVENTS_URL` | app callback for recordings/transcripts (below) | unset |

---

## 6. Next.js env vars

```bash
SABCALL_ENABLED=true
SABCALL_ENGINE_URL=http://localhost:4005
SABCALL_ENGINE_TOKEN=<same token as the engine>
SABCALL_STT_URL=<your STT endpoint>        # used by /api/sabcall/events
CRON_SECRET=<for /api/cron/sabcall-touch>
# R2 (recording storage) — see src/lib/r2.ts for the exact keys it reads
R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… R2_PUBLIC_URL=…
```

Wire the engine back to the app:
- `SABCALL_LLM_URL = https://<app>/api/sabcall/llm` — the autopilot's LLM turns
  run through SabNode's `generateSabcrmText` (AI Gateway → Claude). The engine
  holds no model keys.
- `SABCALL_EVENTS_URL = https://<app>/api/sabcall/events` — on `call.completed`
  with a recording, the app stores it in R2 and transcribes via `SABCALL_STT_URL`,
  writing `recordingUrl` + `transcript` onto the CDR.

---

## 7. Provisioning flow (operator)

1. In `/sabcall`, create a `kind:'call'` project → finish the setup gate.
2. **Infrastructure**: add a SIP **Trunk** (carrier), **Numbers** (DIDs),
   **SIP credentials** (agent softphones), **Domains**, **ACLs**.
3. **Secrets vault**: register the trunk/credential password references
   (`vaultRef`) — store the real values in SabVault and inject them into Routr.
4. **Applications**: create a voice app per number — `ivr` / `dial` / `webhook`
   (TwiML-style flow URL) / `autopilot` (AI agent).
5. Push resources to Routr (`/routr.json`) + media config (`/pjsip.conf`).
6. Flip `SABCALL_ENABLED=true`, restart the engine.

---

## 8. Verify (live)

- **Inbound**: call a DID → Routr routes it to the media tier's `Stasis(sabcall)`
  → the engine resolves the routed application and runs its verb flow → CDR
  appears in **Conversations** / **Call log**.
- **Outbound**: use the **Softphone** dialpad (or `POST /api/v1/sabcall/calls`)
  → the engine originates via ARI.
- **Agent console**: live channels show with hold/mute/transfer + monitor/
  whisper/barge.
- **Recording/AI**: after a recorded call, `recordingUrl` + `transcript` land on
  the CDR; "Summarize with AI" works on voicemail transcripts.

---

## 9. Going Asterisk-free (roadmap)

The engine's media/call-control plane currently targets **ARI**, which is
Asterisk-specific. To run **Routr-only** with no Asterisk at all you'd:
1. Replace the ARI client (`ari.rs`) + Stasis loop (`stasis.rs`) with Routr's
   processor/dialog model for call control, and
2. Add an RTP media handler (record/play/IVR/conference) — e.g. a small media
   service, or Routr's media capabilities — that the verb runtime drives instead
   of ARI.
Everything above that (the resource model, the verb model, TTS/STT/LLM/events
adapters, the whole Next.js app, REST/SDK/CLI/MCP) is media-tier-agnostic and
stays as-is. `routr.rs` already provisions Routr; that's the foundation for the
swap.

---

## 10. What's live vs still deferred

- **Live once §3–§8 are done**: inbound/outbound calls, verb runtime (say/play/
  gather/dial/record/conference/stream), agent console controls + coaching,
  recording→R2 + transcript, voice broadcast, power dialer (incl. AMD +
  voicemail-drop variables), analytics, compliance/relationship surfaces, REST
  API, SDK, CLI, MCP.
- **Needs your providers**: TTS (`SABCALL_TTS_URL`), STT (`SABCALL_STT_URL`),
  LLM (point at `/api/sabcall/llm`).
- **Still a scaffold (build to taste)**: the **real-time AI voice-agent turn
  loop** — `autopilot` plays the greeting and forks audio to
  `SABCALL_AUTOPILOT_STREAM_URL`; the websocket service that runs the live
  STT↔LLM↔TTS conversation on that stream is the one piece left to implement
  (the adapters it needs — `stt`/`llm`/`tts` — already exist).
- **Carrier-side**: STIR/SHAKEN signing, CNAM, E911 registration are stored as
  settings; the actual attestation/registration happens at your carrier/SBC.
```
