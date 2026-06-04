# Twenty backend (`twenty-server`) — function reference

A systematic, near-complete catalog of every function/service/resolver/command in the
vendored `services/sabcrm/packages/twenty-server` backend (5,352 `.ts` files), so the
SabCRM clone can be completed feature-by-feature against it. One file per backend area;
each entry is `### name` + `file:line` + signature + how it works.

- **Documented:** **2,965 functions** across 25 area files (pass 1 = 2,371; completion pass = +594).
- **Coverage:** every exported **function / service method / resolver / command / notable util**
  is documented. Files still carrying a `## NOT YET COVERED` (or "Residual") note now list only
  **non-function leftovers** — TypeScript types, enums, DTOs, constants, NestJS module wiring, and
  Jest mock fixtures — not missing business logic.

## Area files

| Area | File | Functions |
|------|------|----------:|
| GraphQL API | [api-graphql.md](./api-graphql.md) | 177 |
| REST / common / MCP | [api-rest-common-mcp.md](./api-rest-common-mcp.md) | 261 |
| Admin panel / audit | [core-admin-audit.md](./core-admin-audit.md) | 136 |
| Application (custom apps / OAuth / marketplace) | [core-application.md](./core-application.md) | 53 |
| Auth / JWT / 2FA / API keys / SSO | [core-auth.md](./core-auth.md) | 178 |
| Billing / usage | [core-billing.md](./core-billing.md) | 109 |
| Config / i18n / queue | [core-config-i18n-queue.md](./core-config-i18n-queue.md) | 50 |
| File / storage / domain / search | [core-file-domain.md](./core-file-domain.md) | 81 |
| Core-modules (remaining ~47) | [core-modules-remaining.md](./core-modules-remaining.md) | 122 |
| Record-CRUD / tools / workflow | [core-records-tools-workflow.md](./core-records-tools-workflow.md) | 24 |
| Metadata: AI + fields + objects | [metadata-ai-fields.md](./metadata-ai-fields.md) | 512 |
| Metadata: views + layouts | [metadata-views-layouts.md](./metadata-views-layouts.md) | 53 |
| Metadata: perms + channels | [metadata-perms-channels.md](./metadata-perms-channels.md) | 65 |
| Workspace migration engine | [workspace-migration.md](./workspace-migration.md) | 72 |
| Standard application + prefill | [workspace-standard-app.md](./workspace-standard-app.md) | 133 |
| Dev-seeder / cleaner | [workspace-seeder-rest.md](./workspace-seeder-rest.md) | 76 |
| TwentyORM | [twenty-orm.md](./twenty-orm.md) | 168 |
| Engine misc (caches/guards/dataloaders/…) | [engine-misc.md](./engine-misc.md) | 154 |
| Modules: messaging | [modules-messaging.md](./modules-messaging.md) | 66 |
| Modules: workflow | [modules-workflow.md](./modules-workflow.md) | 84 |
| Modules: calendar / dashboard / timeline | [modules-calendar-dashboard.md](./modules-calendar-dashboard.md) | 78 |
| Modules: business objects | [modules-objects.md](./modules-objects.md) | 194 |
| Database: TypeORM entities | [database-typeorm.md](./database-typeorm.md) | 30 |
| Database: commands | [database-commands.md](./database-commands.md) | 47 |
| Top-level (command/queue/utils) | [toplevel-misc.md](./toplevel-misc.md) | 42 |

## How to use this for the clone

Each entry maps a backend capability to a frontend feature to build. The SabCRM frontend
(`src/app/sabcrm/**`, `.sabcrm-twenty`) is wired feature-by-feature against these — and the
live data path is the gated `CRM_DATA_LAYER=twenty` route (`src/lib/data-layer/*`) once
`twenty-server` is booted. Items with no backend yet (email/calendar sync, invite-accept,
server-side export) are tracked as honest "coming soon" states in the UI.
