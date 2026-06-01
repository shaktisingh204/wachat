import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// Depends on ApplicationService + WorkspaceCacheService +
// WorkspaceMigrationValidateBuildAndRunService (all ported separately).
// Scaffolded here with the correct signature and a TODO for wiring the services.

export type DeduplicateEngineCommandsOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

const OLD_UNIVERSAL_IDENTIFIERS_TO_DELETE = new Set([
  "6652773f-b9a9-4fa3-a52c-e2f2e259e430", // deleteSingleRecord
  "cde86f1f-2c13-42b1-812b-f2b2b468cb83", // deleteMultipleRecords
  "8b3a1cae-3e4d-43c1-a71f-48592b2e47ff", // restoreSingleRecord
  "8b740c9d-d99a-45a8-812f-809caaf420ac", // restoreMultipleRecords
  "44a78417-c394-4bc8-961f-98b503030ddb", // destroySingleRecord
  "c630b3fb-7920-40d1-9906-77d0aa797608", // destroyMultipleRecords
  "a934ba8a-ac8f-487d-9cd9-06dfdaec1f49", // exportFromRecordIndex
  "ba339455-f3c2-4ed1-bf77-3e316d7d6a66", // exportFromRecordShow
  "f71f68e5-7b6e-4c03-8161-c48434d7777c", // exportMultipleRecords
]);

/**
 * Workspace command: 1.21.0 / 1775500006000
 * Merge single/multiple record engine command menu items into unified commands
 * (delete, restore, destroy, export).
 *
 * PORT-NOTE: Full implementation requires ported ApplicationService,
 * WorkspaceCacheService, and WorkspaceMigrationValidateBuildAndRunService.
 * The universal identifiers to remove/create are preserved for correctness.
 */
export async function deduplicateEngineCommands(
  options: DeduplicateEngineCommandsOptions,
): Promise<void> {
  const { workspaceId, dryRun = false } = options;

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Starting deduplication of engine commands for workspace ${workspaceId}`,
  );

  // TODO: implement using ported ApplicationService, WorkspaceCacheService,
  // and WorkspaceMigrationValidateBuildAndRunService. The identifiers to
  // delete/create are captured in OLD_UNIVERSAL_IDENTIFIERS_TO_DELETE and
  // the STANDARD_COMMAND_MENU_ITEMS equivalents from the workspace-manager port.
  console.log(
    `Identifiers to remove (if present): ${[...OLD_UNIVERSAL_IDENTIFIERS_TO_DELETE].join(", ")}`,
  );
}
