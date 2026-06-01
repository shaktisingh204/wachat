// PORT-NOTE: NestJS @Module — no direct Next.js equivalent.
// This registry re-exports the UpgradeCommand and documents its original dependencies.
// In SabNode, import UpgradeCommand directly and provide the required services.

export { UpgradeCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/upgrade.command";

/**
 * Original NestJS UpgradeVersionCommandModule imported:
 *   - UpgradeModule        (provides UpgradeSequenceReaderService + UpgradeSequenceRunnerService)
 *   - WorkspaceIteratorModule
 *
 * Providers: [UpgradeCommand]
 *
 * PORT-NOTE: Provide UpgradeSequenceReaderService and UpgradeSequenceRunnerService
 * when instantiating UpgradeCommand.
 */
