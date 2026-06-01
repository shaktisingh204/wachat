// PORT-NOTE: Ported from twenty-server database/commands/workspace-export/workspace-export.command.ts
// NestJS CommandRunner is replaced by a plain exported async function.
// CLI parsing is handled externally (e.g. via a script or Next.js route).

import { exportWorkspace } from '@/lib/sabcrm/server/src/database/commands/workspace-export/workspace-export.service';

export type WorkspaceExportCommandOptions = {
  workspaceId: string;
  outputPath?: string;
  tables?: string;
};

/**
 * Runs the workspace export command.
 * In SabNode this is called from a script or API route instead of nest-commander.
 */
export const runWorkspaceExportCommand = async (
  options: WorkspaceExportCommandOptions,
): Promise<void> => {
  const outputPath = options.outputPath ?? '/tmp/exports';
  const tableFilter = options.tables?.split(',').map((table) => table.trim());

  const filePath = await exportWorkspace({
    workspaceId: options.workspaceId,
    outputPath,
    tableFilter,
  });

  console.log(`Export complete: ${filePath}`);
};
