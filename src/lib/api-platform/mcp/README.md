# SabNode MCP — Meta Ad Manager

An in-app [Model Context Protocol](https://modelcontextprotocol.io) server that
exposes the workspace's **Meta (Facebook/Instagram) Ad Manager** to AI agents.

- **Endpoint:** `POST /api/mcp/ad-manager`
- **Transport:** stateless Streamable HTTP (one JSON-RPC 2.0 request/batch per
  POST, `application/json` response — no SSE session).
- **Auth:** SabNode developer-platform API key, `Authorization: Bearer <key>`
  (or `X-Api-Key`). The key must hold an `ads:read` and/or `ads:write` scope —
  this is the plan gate, since ad scopes are only granted to keys on plans that
  include Ad Manager.
- **Tenancy:** every tool acts as the key's owning user; Graph calls land on the
  Rust Ad-Manager BFF (`/v1/ad-manager/*`), which resolves the stored
  `adManagerAccessToken` server-side. Behaviour mirrors the dashboard server
  actions in `src/app/actions/ad-manager.actions.ts`.

## Layout

| File | Responsibility |
| --- | --- |
| `protocol.ts` | Dependency-free JSON-RPC 2.0 + MCP wire types, version negotiation, result/error helpers. |
| `ad-manager-tools.ts` | The tool registry — zod-schema'd tools that proxy to the Ad-Manager BFF, each tagged with its required scope. |
| `server.ts` | Method dispatcher (`initialize` / `tools/list` / `tools/call` / `ping`), scope-filters tools per key. |
| `../../../app/api/mcp/ad-manager/route.ts` | Route Handler: API-key auth + rate-limit + dispatch. |

Per-tool scope is enforced twice: `tools/list` only advertises tools the key is
scoped for, and `tools/call` re-checks before running.

## Tools

Read (`ads:read`): `list_ad_accounts`, `list_campaigns`, `get_campaign`,
`list_ad_sets`, `get_ad_set`, `list_ads`, `get_ad`, `get_ad_preview`,
`list_custom_audiences`, `get_insights`.

Write (`ads:write`): `create_campaign`, `update_campaign`, `delete_campaign`,
`create_ad_set`, `create_custom_audience`, `update_entity_status`.

> New campaigns/ad sets/ads default to **PAUSED**. Use `update_entity_status`
> with `status: "ACTIVE"` to start delivery.

## Connecting a client

Point any MCP host at the URL with a bearer token, e.g. Claude Desktop /
`claude mcp add`:

```jsonc
{
  "mcpServers": {
    "sabnode-ads": {
      "type": "http",
      "url": "https://<your-sabnode-host>/api/mcp/ad-manager",
      "headers": { "Authorization": "Bearer sk_live_…" }
    }
  }
}
```

Quick smoke test with curl:

```bash
curl -s https://<host>/api/mcp/ad-manager \
  -H 'Authorization: Bearer sk_live_…' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq
```

## Tests

```bash
npx tsx --test src/lib/api-platform/mcp/__tests__/protocol.test.ts
```
