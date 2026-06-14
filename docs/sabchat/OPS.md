# SabChat — operations & infra runbook

SabChat is a top-level, project-gated live-chat module at `/sabchat`. The
realtime inbox, widget, AI copilot, KB, reports, commerce, community, journeys,
and action-taking engines run over the shared Rust API (`RUST_API_URL`, the
`sabchat-*` crates) + Mongo + Redis. **Most of it needs no extra infra.** This
doc covers the few pieces that do, all flag-gated so they ship dark.

## Scheduled work (cron)

| Job | Route | Schedule | Gate |
|-----|-------|----------|------|
| Outbound journeys tick + chat delivery | `/api/cron/sabchat-journeys` | every minute | `SABCHAT_JOURNEYS_ENABLED=true` |

Registered in both cron registries (`scripts/cron-worker.mjs` for the PM2
node-cron worker, and `vercel.json` `crons`). Auth is `CRON_SECRET` (Bearer /
`x-cron-secret` / `?secret=`); when `CRON_SECRET` is unset the route is open for
local dev. While `SABCHAT_JOURNEYS_ENABLED` is falsy the route no-ops.

The tick advances every due journey run one step across all `kind:'chat'`
projects and delivers the **chat** channel in-app (find-or-create the contact's
conversation, append a `bot` message → publishes on the WS hub → lands live in
the agent inbox + visitor widget). Email/SMS/push outbox rows are left pending —
wiring those to SabMail / SabSMS is the channel-dispatcher follow-up.

## Realtime (WebSocket hub)

`sabchat-ws` (`/v1/sabchat/ws?token=`) fans out `message.created` /
`conversation.updated` / `typing` / `presence` / `viewing` per tenant. It has a
Redis cross-process bridge (`WS_REDIS_CHANNEL`), so multiple API instances stay
in sync — verify Redis connectivity before horizontal scaling.

## Voice / video + co-browse (needs a TURN/STUN relay)

`sabchat-voice` + `sabchat-cobrowse` need a TURN/STUN server (e.g. **coturn**)
to traverse NAT for WebRTC. Provision one (PM2 or compose) and set:

```
SABCHAT_TURN_URL=turn:turn.example.com:3478
SABCHAT_TURN_USER=...
SABCHAT_TURN_CRED=...
```

The call / co-browse UI stays inert until these are set — provisioning coturn is
the ops step that turns the feature on.

## Action-taking AI (connectors)

`sabchat-ai-actions` invokes tenant-defined `http_webhook` connectors (outbound
HTTP to a tenant-hosted endpoint). This is authorized egress (admin configures
their own URL) but you should front it with an **allow-list / egress policy**
before exposing it broadly. No env required; connectors are created in
`/sabchat/actions`.

## SSO / SCIM

`sabchat-sso` stores SAML/OIDC IdP metadata in the tenant config via the
org/project SSO settings UI (no env). SCIM provisioning tokens are minted
in-app. Configure the external IdP there; nothing to provision server-side
beyond reachability of the IdP metadata URL.
