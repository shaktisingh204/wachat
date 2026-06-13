# SabMail hosted MTA — Stalwart on a dedicated box (runbook)

This directory contains the **box-only** scaffolding to stand up a self-hosted
[Stalwart Mail Server](https://stalw.art) that acts as SabMail's outbound
submission relay (`SABMAIL_SMTP_*`) **and** the inbound MX that forwards mail
into SabMail via the webhook at
`POST /api/webhooks/sabmail-inbound?workspaceId=<projectId>`.

It is **not** part of the Next.js app or PM2. It is a standalone OS service on
its own host (e.g. `mail.example.com`), managed by **systemd** — see
`stalwart-mail.service` for *why systemd and not PM2* (privileged ports
25/465/587/993 need `CAP_NET_BIND_SERVICE`).

Files here:

| File | Purpose |
|---|---|
| `config.toml` | Stalwart server config (listeners, TLS, RocksDB store, auth, DKIM, Sieve). |
| `stalwart-mail.service` | systemd unit (runs as `stalwart` user, binds low ports via ambient cap). |
| `inbound-sieve.sieve` | Delivery-time Sieve that POSTs inbound mail to the SabMail webhook (+ milter/event-webhook fallback). |
| `README.md` | This runbook. |

> Throughout, **`mail.example.com`** is the mail host (`${SABMAIL_MAIL_HOST}`),
> **`example.com`** is the mail domain (`${STALWART_DEFAULT_DOMAIN}`), and
> **`app.example.com`** is the SabNode app host. Substitute your real values.

---

## 0. Prerequisites

- A small Linux box (Debian/Ubuntu recommended) with a **static public IP** and
  ports **25, 465, 587, 993** reachable from the Internet.
- **Outbound port 25 must be open** at your provider. Many clouds (AWS, GCP,
  Azure, DigitalOcean, OVH) block egress :25 by default — open a support ticket
  to unblock it, or you cannot deliver mail. Test:
  `nc -vz alt1.gmail-smtp-in.l.google.com 25`.
- DNS control for `example.com`.
- The SabNode app already deployed at `https://app.example.com` with the SabMail
  module enabled and a `kind:'mail'` project created — note its `_id` (the
  **workspaceId**).

---

## 1. Create the service user + directories

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin stalwart
sudo mkdir -p /etc/stalwart /var/lib/stalwart/data /opt/stalwart
sudo chown -R stalwart:stalwart /var/lib/stalwart
```

## 2. Install Stalwart

Use the official installer (drops the binary at `/opt/stalwart/bin/stalwart`).
Match the `ExecStart` path in the systemd unit to wherever it lands.

```bash
# Official install script (review it first):
curl --proto '=https' --tlsv1.2 -sSf https://get.stalw.art/install.sh | sudo sh
# or download the release tarball for your arch from https://github.com/stalwartlabs/mail-server/releases
# and place the binary at /opt/stalwart/bin/stalwart
```

If the installer runs its own interactive setup and writes its own config,
that's fine — then **overwrite** the generated config with our `config.toml`
(next step) so the box matches this repo.

## 3. DNS — A record + reverse DNS first

Create these **before** requesting a cert (certbot needs the A record) and
before sending (rDNS gatekeeps deliverability).

```text
; Mail host A record (and AAAA if you have IPv6)
mail        IN  A      <BOX_PUBLIC_IPV4>
mail        IN  AAAA   <BOX_PUBLIC_IPV6>        ; only if you actually have v6

; MX for the domain → the mail host
@           IN  MX  10 mail.example.com.
```

**PTR / reverse DNS (mandatory):** ask the host/IP owner (cloud console or
support ticket) to set the PTR record for `<BOX_PUBLIC_IPV4>` to
`mail.example.com`. Gmail/Outlook reject or spam mail from IPs whose PTR doesn't
forward-confirm to the sending host. Verify:

```bash
dig +short mail.example.com           # → your IP
dig +short -x <BOX_PUBLIC_IPV4>       # → mail.example.com.   (must round-trip)
```

## 4. TLS certificate (certbot / Let's Encrypt)

```bash
sudo apt-get install -y certbot
# Standalone uses :80 briefly — open it or use a DNS/webroot plugin instead.
sudo certbot certonly --standalone -d mail.example.com
```

This creates `/etc/letsencrypt/live/mail.example.com/{fullchain.pem,privkey.pem}`
— exactly what `config.toml` points at. certbot installs a renewal timer; the
config uses the `live/` symlinks so renewals need no edits. After a renewal,
reload Stalwart so it picks up the new cert:

```bash
# Optional deploy hook so renewals auto-reload the MTA:
echo 'systemctl reload stalwart-mail' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-stalwart.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-stalwart.sh
```

## 5. Place the config + Sieve

```bash
sudo cp deploy/stalwart/config.toml        /etc/stalwart/config.toml
sudo cp deploy/stalwart/inbound-sieve.sieve /etc/stalwart/inbound-sieve.sieve
sudo chown stalwart:stalwart /etc/stalwart/config.toml /etc/stalwart/inbound-sieve.sieve
sudo chmod 640 /etc/stalwart/config.toml
```

Now edit `/etc/stalwart/config.toml` and replace every **`<SET_ME>`**:

- `[server] hostname` → `mail.example.com`
- `[certificate.default]` cert/private-key paths → your `mail.example.com` cert
- `[authentication.fallback-admin] secret` → `openssl rand -base64 24`
  (save it; it's also `STALWART_ADMIN_TOKEN`)
- `[[directory.internal.domains]] name` → `example.com`

And in `/etc/stalwart/inbound-sieve.sieve` replace:

- `<APP_HOST>` → `app.example.com`
- `<WORKSPACE_ID>` → your `kind:'mail'` project `_id`
- `<WEBHOOK_SECRET>` → `${SABMAIL_INBOUND_WEBHOOK_SECRET}` (see Auth note below)

## 6. Install + start the systemd unit

```bash
sudo cp deploy/stalwart/stalwart-mail.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stalwart-mail
journalctl -u stalwart-mail -f          # watch it come up
```

If it won't bind :25/:587 etc., the unit's `AmbientCapabilities` line is
missing or the binary isn't allowed the cap — re-check `stalwart-mail.service`.

## 7. Create accounts + DKIM (via the management API — loopback only)

The management API is bound to `127.0.0.1:8085` (never public). Reach it from
the box, or tunnel from your workstation:

```bash
ssh -N -L 8085:127.0.0.1:8085 you@mail.example.com   # then use http://127.0.0.1:8085
```

Open `http://127.0.0.1:8085`, log in as `admin` with the fallback-admin secret
from step 5, then:

1. **Generate the DKIM key** for `example.com` with selector `stalwart`
   (matches `[auth.dkim] selector` in config). Copy the generated **public**
   key TXT value for the DNS step.
2. **Create the submission account** SabMail will authenticate as — this becomes
   `SABMAIL_SMTP_USER` / `SABMAIL_SMTP_PASS`:
   - login/email: `sabmail@example.com` (or `no-reply@example.com`)
   - a strong password (this is `SABMAIL_SMTP_PASS`)
   - grant it submission/send rights.
3. **Create user mailboxes** for any addresses that should receive mail (so
   inbound MX has somewhere to deliver and the Sieve fires).

> You can also do all of the above via the CLI / REST API; the web-admin is the
> quickest for a first turnkey bring-up.

## 8. DNS — SPF, DKIM, DMARC

Now publish the deliverability records:

```text
; SPF — authorize this box (a + mx) to send for the domain; reject the rest.
@           IN  TXT  "v=spf1 a mx -all"

; DKIM — the PUBLIC key from step 7.1, selector `stalwart`.
stalwart._domainkey  IN  TXT  "v=DKIM1; k=rsa; p=<PUBLIC_KEY_FROM_STALWART>"

; DMARC — start at quarantine with aggregate reports, tighten to reject later.
_dmarc      IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; adkim=s; aspf=s; pct=100"
```

Notes:
- `v=spf1 a mx -all` works because the box's **A** record and the domain's
  **MX** both point at this host. If you ALSO relay through an ESP, add its
  include (e.g. `include:amazonses.com`) before `-all`.
- DKIM `p=` is the public key Stalwart generated — paste it verbatim (long TXT
  values may need splitting into quoted chunks by your DNS provider).
- Move DMARC to `p=reject` only after a week of clean aggregate reports.

Verify propagation:

```bash
dig +short TXT example.com                       # SPF present
dig +short TXT stalwart._domainkey.example.com   # DKIM present
dig +short TXT _dmarc.example.com                # DMARC present
```

## 9. SabNode env vars

Set these on the **app** side (`.env` / `vercel env` per your deployment) — see
the "SabMail hosted MTA (Stalwart)" block in `.env.example`:

```dotenv
# Submission relay → Stalwart :587 (STARTTLS, auth required)
SABMAIL_SMTP_HOST=mail.example.com
SABMAIL_SMTP_PORT=587
SABMAIL_SMTP_USER=sabmail@example.com          # account from step 7.2
SABMAIL_SMTP_PASS=<the strong password>

# Hosted-MTA identity / admin
SABMAIL_MAIL_HOST=mail.example.com             # == [server] hostname
STALWART_DEFAULT_DOMAIN=example.com            # == directory domain
STALWART_ADMIN_URL=http://127.0.0.1:8085       # loopback / via SSH tunnel
STALWART_ADMIN_TOKEN=<fallback-admin secret>   # == config fallback-admin secret

# Inbound webhook auth (see Auth note)
SABMAIL_INBOUND_WEBHOOK_SECRET=<same value used in the Sieve Bearer>
```

### Auth note (important)

The inbound webhook route (`src/app/api/webhooks/sabmail-inbound/route.ts`)
authorizes against **`SABMAIL_INBOUND_WEBHOOK_SECRET`** (and, for the
cron/provider posters, `CRON_SECRET`) — it accepts the value as
`Authorization: Bearer <secret>`, header `x-cron-secret`, or `?secret=`.

Set **`SABMAIL_INBOUND_WEBHOOK_SECRET` to its OWN dedicated random value**
(`openssl rand -hex 32`) and use that exact string as `<WEBHOOK_SECRET>` in
`inbound-sieve.sieve`. **Do NOT reuse `CRON_SECRET`** — the inbound poster is an
internet-adjacent MTA, so it should carry a secret scoped only to this route, not
your high-privilege cron secret. If neither env is set the route is open (dev
only) — never ship that to production.

## 10. Smoke test — send + receive

**Outbound (submission relay):**
```bash
# From any box with swaks installed:
swaks --server mail.example.com:587 --tls \
      --auth-user sabmail@example.com --auth-password '<SABMAIL_SMTP_PASS>' \
      --from sabmail@example.com --to you@gmail.com \
      --header 'Subject: SabMail Stalwart outbound test' --body 'hello from stalwart'
```
Then in Gmail → "Show original": confirm **SPF=pass, DKIM=pass, DMARC=pass**.
Or use https://www.mail-tester.com (send to the address it gives you; aim 10/10).

**Inbound (MX → mailbox → webhook):**
```bash
swaks --server mail.example.com:25 \
      --from probe@gmail.com --to you@example.com \
      --header 'Subject: SabMail inbound test' --body 'inbound check'
```
Confirm:
- `journalctl -u stalwart-mail` shows the message accepted + delivered;
- the SabMail inbox/conversation for that workspace shows the new inbound;
- if it doesn't appear, check the Sieve POST: the webhook returns `{ok:true}`
  on success — watch the app logs and re-verify `<APP_HOST>`, `<WORKSPACE_ID>`,
  and the Bearer secret. If your build's Sieve can't do HTTP, switch to the
  event-webhook or milter fallback documented in `inbound-sieve.sieve`.

## 11. Ongoing ops

- **Logs:** `journalctl -u stalwart-mail -f`
- **Reload after config edits:** `sudo systemctl reload stalwart-mail`
- **Cert renewal:** automatic via certbot timer; the deploy hook reloads the MTA.
- **Backups:** snapshot `/var/lib/stalwart/data` (RocksDB store = mailboxes +
  accounts + queue). Stop the service or use a consistent FS snapshot.
- **Reputation:** warm up gradually; monitor DMARC aggregate reports
  (`rua=mailto:dmarc@example.com`); keep PTR/SPF/DKIM aligned.
- **Security:** the management API stays on `127.0.0.1` — only ever reach it via
  SSH tunnel. Never open :8085 to the Internet.
