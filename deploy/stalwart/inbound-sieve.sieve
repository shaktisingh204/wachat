# =============================================================================
# inbound-sieve.sieve — forward delivered mail to the SabMail inbound webhook
# =============================================================================
#
# Loaded by config.toml as the trusted delivery-time script
# ([sieve.trusted] from-file = "/etc/stalwart/inbound-sieve.sieve").
# It runs once per delivered message and POSTs the RAW RFC822 message to the
# SabNode inbound webhook so SabMail can store it as an `inbound` event.
#
# Webhook contract (see src/app/api/webhooks/sabmail-inbound/route.ts):
#   POST https://<APP_HOST>/api/webhooks/sabmail-inbound?workspaceId=<projectId>
#   Authorization: Bearer <secret>
#   Body: the message (the route also tolerates a parsed {from,to,subject,...}
#         JSON, but here we hand it the raw mail).
#
# IMPORTANT placeholders — replace these (or template them at deploy time):
#   <APP_HOST>      → your SabNode app host, e.g. app.example.com (NOT the mail
#                     host). Matches ${SABMAIL_APP_URL} / ${NEXT_PUBLIC_APP_URL}.
#   <WORKSPACE_ID>  → the kind:'mail' SabMail project _id that owns these
#                     mailboxes (the same value the app passes as ?workspaceId=).
#   <WEBHOOK_SECRET>→ ${SABMAIL_INBOUND_WEBHOOK_SECRET} — a DEDICATED random
#                     secret (openssl rand -hex 32). The route authorizes against
#                     SABMAIL_INBOUND_WEBHOOK_SECRET directly (Bearer /
#                     x-cron-secret / ?secret). Do NOT reuse CRON_SECRET here.
#                     (See README "Auth note".)
#
# ── Mapping multiple workspaces ────────────────────────────────────────────
# If one box serves several SabMail workspaces, branch on the recipient domain
# and POST a different ?workspaceId= per domain (see the commented block at the
# bottom). For a single-tenant box, the single eval below is enough.
# -----------------------------------------------------------------------------

require ["vnd.stalwart.expressions", "envelope", "variables"];

# Stalwart's Sieve exposes an `eval` extension that can run a config-style
# expression — including an outbound HTTP call via the http_*/webhook helpers —
# at delivery time. We POST the raw message and the Bearer header. The message
# body is available to the expression engine as the delivery context; we pass
# the standard fields the webhook can also parse.
#
# `keep;` AFTER the post ensures the message is STILL delivered to the local
# mailbox (the webhook is an additive notification, not a replacement for IMAP
# storage). Remove `keep;` only if you want SabMail's store to be authoritative
# and do NOT want a local IMAP copy.

eval "http_post(
        'https://<APP_HOST>/api/webhooks/sabmail-inbound?workspaceId=<WORKSPACE_ID>',
        message_raw(),
        [ 'Authorization: Bearer <WEBHOOK_SECRET>',
          'Content-Type: message/rfc822' ]
      )";

keep;

# ── Multi-tenant variant (uncomment + adapt) ───────────────────────────────
# if envelope :domain "to" "alpha.example.com" {
#     eval "http_post(
#             'https://<APP_HOST>/api/webhooks/sabmail-inbound?workspaceId=<WORKSPACE_ID_ALPHA>',
#             message_raw(),
#             [ 'Authorization: Bearer <WEBHOOK_SECRET>', 'Content-Type: message/rfc822' ])";
# } elsif envelope :domain "to" "beta.example.com" {
#     eval "http_post(
#             'https://<APP_HOST>/api/webhooks/sabmail-inbound?workspaceId=<WORKSPACE_ID_BETA>',
#             message_raw(),
#             [ 'Authorization: Bearer <WEBHOOK_SECRET>', 'Content-Type: message/rfc822' ])";
# }
# keep;

# =============================================================================
# ALTERNATIVE: if your Stalwart build's Sieve cannot make outbound HTTP calls
# =============================================================================
# Some builds restrict the `eval`/`http_post` expression for security, or you
# may prefer not to run network I/O inside the delivery path. Two supported
# fallbacks, in order of preference:
#
# 1) Stalwart EVENT WEBHOOK (recommended fallback) — Stalwart can emit JSON
#    webhooks on internal events. Subscribe to the message-delivery /
#    message-ingest event and point it at the SabMail webhook. In config.toml
#    (or via the web-admin → Settings → Webhooks):
#
#      [webhook.sabmail-inbound]
#      url    = "https://<APP_HOST>/api/webhooks/sabmail-inbound?workspaceId=<WORKSPACE_ID>"
#      events = ["delivery.success", "message.ingest"]
#      headers.Authorization = "Bearer <WEBHOOK_SECRET>"
#      signature-key = "<optional HMAC key>"
#
#    The event payload is JSON, not raw RFC822 — the webhook route already
#    tolerates a parsed shape, but you may need a thin adapter to map the
#    event fields onto {from,to,subject,text,html}. This keeps network I/O out
#    of the Sieve sandbox while still notifying SabMail on every inbound mail.
#
# 2) MILTER — run a tiny milter the MTA calls during DATA; the milter does the
#    HTTP POST to the webhook. Wire it in config.toml under the SMTP session
#    milters (`[session.data.milter.<name>]` with `host`/`port`). Heavier to
#    operate (an extra long-running process) but fully decouples ingestion from
#    delivery and works regardless of Sieve's HTTP capabilities.
#
# Whichever path you use, the destination URL, ?workspaceId= and the
# Authorization: Bearer header are IDENTICAL — only the message encoding (raw
# vs parsed JSON) differs.
