# SabChat TURN relay (coturn)

The TURN/STUN relay that makes SabChat **voice/video calls** and **co-browse**
traverse NAT. For 1:1 agent↔visitor sessions this is the *only* media infra you
need — calls are peer-to-peer, relayed through TURN only when a direct path is
blocked. No SFU/media server is required at 1:1 scale.

## How auth works (no per-user accounts)

The web app issues each call a short-lived credential and coturn verifies it
with a **shared secret** (the TURN REST API scheme):

- username = `<expiry-unix-seconds>:sabchat`
- credential = `base64(HMAC-SHA1(SABCHAT_TURN_SECRET, username))`

This is exactly what `getIceServers()` in
`src/app/actions/sabchat-voice.actions.ts` computes. Set the **same**
`SABCHAT_TURN_SECRET` on the relay and in the web app.

## Provision

```bash
# 1. Make a secret (shared with the web app's SABCHAT_TURN_SECRET).
export SABCHAT_TURN_SECRET=$(openssl rand -hex 32)
export SABCHAT_TURN_EXTERNAL_IP=$(curl -s ifconfig.me)   # this host's public IP

# 2a. Docker (recommended):
docker compose -f services/sabchat-turn/docker-compose.yml up -d

# 2b. …or a host install:
sudo apt-get install -y coturn
sudo sed "s/__SABCHAT_TURN_SECRET__/$SABCHAT_TURN_SECRET/" \
  services/sabchat-turn/turnserver.conf | sudo tee /etc/coturn/turnserver.conf
sudo turnserver -c /etc/coturn/turnserver.conf --external-ip=$SABCHAT_TURN_EXTERNAL_IP

# 2c. …or under PM2 (the ecosystem.config.js `sabchat-turn` app — starts only
#     when SABCHAT_TURN_ENABLED=true and turnserver is on PATH):
SABCHAT_TURN_ENABLED=true pm2 start ecosystem.config.js --only sabchat-turn
```

## Firewall

Open **3478/tcp+udp** (TURN/STUN), **5349/tcp** (TURN over TLS), and the relay
range **49152–65535/udp**.

## Web app env

```
SABCHAT_TURN_URL=turn:turn.yourdomain.com:3478
SABCHAT_TURN_SECRET=<same secret as the relay>
```

Without these the call UI runs STUN-only (works on the same LAN / with public
IPs); with them it relays through coturn for full NAT traversal.

## Scaling past 1:1

Group calls / many viewers need an SFU (e.g. mediasoup, LiveKit). The
`sabchat-voice` crate's `token` endpoint already re-issues a per-call access
token for such a media server — wire the SFU there when you outgrow 1:1.
