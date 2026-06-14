# SabCall local voice stack — Routr + Asterisk

The local/self-hosted voice stack for **SabCall**: open-source [Routr](https://routr.io)
(the SIP proxy / "brain") in front of **Asterisk** (the media tier, RTP + ARI).
The Rust **`sabcall-engine`** runs natively on the host and drives each call over
Asterisk's ARI; it never touches RTP itself.

```
softphone / carrier ─▶ Routr edgeport (host :5060) ─▶ Asterisk ─▶ Stasis(sabcall)
                          (SIP routing)                (media)        │
                                                                      ▼
                                                  sabcall-engine (host, ARI :8088)
                                                  runs the app's verb flow + CDRs
```

Everything in this directory is a **working local starting point**. The Asterisk
config (`asterisk/`) is tuned for same-host Docker; you will likely need to adjust
addressing for a LAN / public / NAT'd deployment (see Troubleshooting).

---

## 1. Bring up the Docker stack

```bash
cd services/routr
docker compose up        # pulls the Routr images + andrius/asterisk:18-current
```

### Services and ports

| Service       | Image                          | Role                                              | Ports (host)                          |
|---------------|--------------------------------|---------------------------------------------------|---------------------------------------|
| `edgeport01`  | `fonoster/routr-edgeport`      | SIP listener / edge (the proxy front door)        | `5060` udp+tcp, `5061` tls, `5062` ws, `5063` wss |
| `dispatcher`  | `fonoster/routr-dispatcher`    | Routes SIP messages to the connect processor      | internal `51901`                      |
| `connect`     | `fonoster/routr-connect`       | Connect processor (call routing logic)            | internal `51904`                      |
| `location`    | `fonoster/routr-location`      | Location service (registrations)                  | internal `51902`                      |
| `apiserver`   | `fonoster/routr-simpledata`    | Serves the YAML resources in `config/resources/`  | internal `51907`                      |
| `requester`   | `fonoster/routr-requester`     | Sends SIP requests (e.g. REGISTER to trunks)      | internal `51909`                      |
| `registry`    | `fonoster/routr-registry`      | Registers Routr to upstream edge/trunks           | internal `51910`                      |
| `asterisk`    | `andrius/asterisk:18-current`  | **Media tier**: RTP + ARI, runs `Stasis(sabcall)` | `8088` ARI, `10000-10100/udp` RTP     |

Routr reads its config from `config/*.yaml`; its SIP resources (peers, agents,
numbers, domains, credentials, acl, trunks) come from `config/resources/*.yaml`.
Asterisk reads `asterisk/` mounted at `/etc/asterisk`.

**How the two tiers connect:** Asterisk REGISTERs to `edgeport01:5060` as the
`asterisk` peer (creds in `config/resources/credentials.yaml`), backing AOR
`sip:sabcall@sip.local`. Routr routes inbound calls for that AOR to Asterisk,
which answers them into `Stasis(sabcall)`.

---

## 2. Run the host engine

The engine runs **natively** (not in Docker) so it can reach Asterisk ARI on
`localhost:8088` and Mongo on the host.

```bash
cd ../sabcall-engine
cp ../routr/.env.example .env        # then edit (at minimum SABCALL_ENGINE_TOKEN)
set -a && . .env && set +a
cargo run                            # or: cargo build --release && pm2 start ...
```

The env (`../routr/.env.example`) is wired to this stack's defaults:
`ASTERISK_ARI_URL=http://localhost:8088`, ARI user/pass/app all `sabcall`,
engine HTTP on `PORT=4005`. Health check: `curl http://localhost:4005/health`
should return `{"status":"ok","enabled":true,"app":"sabcall"}`.

> PM2: `pm2 start "cargo run --release" --name sabcall-engine` (or point it at the
> built binary in `target/release/`). The engine is gated by `SABCALL_ENABLED`.

---

## 3. Register a test softphone

The seed resources include agent **`1001`** (`config/resources/agents.yaml`) with
credentials in `config/resources/credentials.yaml`. Point any softphone
(Zoiper, Linphone, …) at Routr:

| Field      | Value                         |
|------------|-------------------------------|
| Username   | `1001`                        |
| Password   | `changeme`                    |
| Domain     | `sip.local`                   |
| SIP server / proxy | `127.0.0.1:5060` (UDP) |

For a WebRTC softphone use the `ws`/`wss` ports (`5062` / `5063`) instead.

---

## 4. (Optional) Provision live resources from the app

The seed resources already give a working local test. To pull a real tenant's SIP
config (numbers, trunks, domains) from SabCall, ask the engine to render it:

```bash
curl -H "Authorization: Bearer $SABCALL_ENGINE_TOKEN" \
  http://localhost:4005/v1/tenants/<projectId>/routr.json
```

Convert/merge the output into `config/resources/*.yaml` and restart the
`apiserver` (or the stack) so Routr picks it up. The engine can likewise render
the Asterisk side: `…/v1/tenants/<projectId>/pjsip.conf` (for carrier trunks).

> Production note: the generators emit **credential references**, never plaintext
> secrets — those resolve from your vault, not these local `*.yaml` seeds.

---

## 5. Test a call

**Inbound:** dial `sip:sabcall@sip.local` (or the seeded DID `+10000000000`) from
the `1001` softphone. The path is: softphone → Routr edgeport → routed to the
Asterisk peer AOR → `Stasis(sabcall)` → the engine runs the app's verb flow
(greeting / menu / record / etc.).

**Outbound:** trigger it from the app — the SabCall UI, or directly:

```bash
# via the Next.js API (auth as usual through the app)
POST /api/v1/sabcall/calls

# or straight to the engine:
curl -X POST http://localhost:4005/v1/originate \
  -H "Authorization: Bearer $SABCALL_ENGINE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"tenant":"<projectId>","to":"1001","callerId":"+10000000000"}'
```

---

## 6. Troubleshooting

- **ARI not reachable** — `curl http://localhost:8088/ari/asterisk/info -u sabcall:sabcall`
  must return JSON. If not: is the `asterisk` container up? Is `8088` published
  (`docker compose ps`)? Is `http.conf` enabled and `ari.conf` user `sabcall`
  present? The engine logs `ari connect` failures on boot.
- **Asterisk not registered to Routr** — exec into the container and run
  `asterisk -rx "pjsip show registrations"`; `routr-reg` should be `Registered`.
  If not, check `pjsip.conf` `server_uri = sip:edgeport01:5060` resolves on the
  compose network and the creds match `credentials.yaml` (`asterisk`/`changeme`).
  Confirm on Routr's side that the peer/AOR shows a binding.
- **Inbound call rings but never hits Stasis** — Asterisk isn't matching the
  INVITE from Routr to `routr-endpoint`. Turn on `asterisk -rx "pjsip set logger on"`,
  watch the INVITE's source IP, and add it to `[routr-identify] match` in
  `pjsip.conf` (the default `match = edgeport01` only works when Routr's INVITEs
  arrive from that resolvable name).
- **One-way / no audio (RTP)** — almost always NAT. Set
  `external_media_address` / `external_signaling_address` + `local_net` on
  `[transport-udp]` in `pjsip.conf`, set Routr's edgeport `externalAddrs` /
  `localnets` in `config/edgeport.yaml` to your reachable IP, and make sure the
  RTP range `10000-10100/udp` is published and not firewalled. Keep `rtp.conf`'s
  range in sync with the compose `ports:` mapping.
- **No greeting / TTS silent** — `ASTERISK_SOUNDS_DIR` must be a path Asterisk can
  read (mount it into the container under `/var/lib/asterisk/sounds/...`), or set
  `SABCALL_TTS_URL`. Without either, verbs fall back to the default greeting.

The Asterisk config here is a working starting point — tune the transport,
identify match, and NAT settings for your own network.
