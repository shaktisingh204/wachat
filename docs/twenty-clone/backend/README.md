# Twenty backend (`twenty-server`) — function reference

A systematic catalog of every function/service/resolver/command in the vendored
`services/sabcrm/packages/twenty-server` backend, so the SabCRM clone can be
completed feature-by-feature against it. One file per backend area; each entry is
`### name` + `file:line` + signature + how it works.

- **Source:** `services/sabcrm/packages/twenty-server/src` (5,352 `.ts` files)
- **Documented so far:** **2,371 functions** across 25 area files
- **Pass 1 status:** the biggest areas (graphql query-runner, schema-builder,
  metadata sub-modules, twenty-orm) were too large for one pass — those carry a
  `## NOT YET COVERED` section and need a Wave-2 deep pass (see table).

## Area files

| Area | File | Functions | Coverage |
|------|------|----------:|----------|
| GraphQL API | [api-graphql.md](./api-graphql.md) | 57 | ⚠ gaps |
| REST / common / MCP | [api-rest-common-mcp.md](./api-rest-common-mcp.md) | 261 | ✅ full |
| Admin panel / audit | [core-admin-audit.md](./core-admin-audit.md) | 117 | ⚠ gaps |
| Application (custom apps) | [core-application.md](./core-application.md) | 27 | ⚠ gaps |
| Auth / JWT / 2FA / API keys | [core-auth.md](./core-auth.md) | 105 | ⚠ gaps |
| Billing / usage | [core-billing.md](./core-billing.md) | 109 | ✅ full |
| Config / i18n / queue | [core-config-i18n-queue.md](./core-config-i18n-queue.md) | 17 | ⚠ gaps |
| File / storage / domain / search | [core-file-domain.md](./core-file-domain.md) | 59 | ⚠ gaps |
| Core-modules (remaining ~47) | [core-modules-remaining.md](./core-modules-remaining.md) | 63 | ⚠ gaps |
| Record-CRUD / tools / workflow | [core-records-tools-workflow.md](./core-records-tools-workflow.md) | 24 | ✅ full |
| Metadata: AI + fields + objects | [metadata-ai-fields.md](./metadata-ai-fields.md) | 512 | ✅ full |
| Metadata: views + layouts | [metadata-views-layouts.md](./metadata-views-layouts.md) | 53 | ✅ full |
| Metadata: perms + channels | [metadata-perms-channels.md](./metadata-perms-channels.md) | 23 | ⚠ gaps |
| Workspace migration engine | [workspace-migration.md](./workspace-migration.md) | 27 | ⚠ gaps |
| Standard application + prefill | [workspace-standard-app.md](./workspace-standard-app.md) | 133 | ✅ full |
| Dev-seeder / cleaner | [workspace-seeder-rest.md](./workspace-seeder-rest.md) | 60 | ⚠ gaps |
| TwentyORM | [twenty-orm.md](./twenty-orm.md) | 126 | ⚠ gaps |
| Engine misc (caches/guards/…) | [engine-misc.md](./engine-misc.md) | 154 | ✅ full |
| Modules: messaging | [modules-messaging.md](./modules-messaging.md) | 66 | ✅ full |
| Modules: workflow | [modules-workflow.md](./modules-workflow.md) | 32 | ⚠ gaps |
| Modules: calendar / dashboard | [modules-calendar-dashboard.md](./modules-calendar-dashboard.md) | 44 | ⚠ gaps |
| Modules: business objects | [modules-objects.md](./modules-objects.md) | 194 | ✅ full |
| Database: TypeORM entities | [database-typeorm.md](./database-typeorm.md) | 19 | ⚠ gaps |
| Database: commands | [database-commands.md](./database-commands.md) | 47 | ✅ full |
| Top-level (command/queue/utils) | [toplevel-misc.md](./toplevel-misc.md) | 42 | ✅ full |

## Wave 2 — deep-pass needed (the `NOT YET COVERED` areas)

These 14 areas were partially covered in pass 1; a second wave should finish them:

- **api-graphql** — `graphql-query-runner/` (100+ files), `workspace-schema-builder/` generators (40+), utils (50+)
- **core-auth** — OAuth controllers, Passport strategies, SSO filters, provider integrations, DTOs
- **core-application**, **core-admin-audit**, **core-config-i18n-queue**, **core-file-domain**, **core-modules-remaining** — remaining service methods / resolvers / DTOs / config classes
- **metadata-perms-channels**, **twenty-orm**, **workspace-migration**, **workspace-seeder-rest**, **modules-workflow**, **modules-calendar-dashboard**, **database-typeorm** — see each file's `## NOT YET COVERED`

Run a follow-up wave per gapped file to reach true 100% function coverage.
