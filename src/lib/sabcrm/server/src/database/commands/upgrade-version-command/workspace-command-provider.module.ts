// PORT-NOTE: NestJS @Module — no direct Next.js equivalent.
// This registry re-exports all versioned workspace command modules for the upgrade sequence.
// Import these in any orchestration layer that runs workspace-level upgrade commands.

// ── v1.x workspace command modules ───────────────────────────────────────────
// PORT-NOTE: v1-21 through v1-23 and v2-0 through v2-6 workspace commands are ported
// in earlier batches. Re-export them here once they are available.
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-22/1-22-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-23/1-23-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-0/2-0-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-1/2-1-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-2/2-2-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-3/2-3-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-4/2-4-upgrade-version-command.module";
// export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-5/2-5-upgrade-version-command.module";

// ── v2.7 workspace command module ────────────────────────────────────────────
export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-7/2-7-upgrade-version-command.module";

// ── v2.8 workspace command module ────────────────────────────────────────────
export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-8/2-8-upgrade-version-command.module";

// ── v2.9 workspace command module ────────────────────────────────────────────
export * from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-9/2-9-upgrade-version-command.module";

/**
 * Original NestJS WorkspaceCommandProviderModule imported all versioned modules
 * in ascending order. The SabNode equivalent is this re-export barrel.
 */
