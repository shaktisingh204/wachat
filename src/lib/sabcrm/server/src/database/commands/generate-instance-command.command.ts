import 'server-only';

import * as fs from 'fs';
import * as path from 'path';

import { InstanceCommandGenerationService } from '@/lib/sabcrm/server/src/database/commands/instance-command-generation.service';
import {
  TWENTY_ALL_VERSIONS,
  type TwentyAllVersion,
} from '@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-all-versions.constant';
import { TWENTY_CURRENT_VERSION } from '@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant';
import { type InstanceCommandType } from '@/lib/sabcrm/server/src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';

const UPGRADE_VERSION_COMMAND_DIR = path.resolve(
  process.cwd(),
  'src/lib/sabcrm/server/src/database/commands/upgrade-version-command',
);

export type GenerateInstanceCommandOptions = {
  name: string;
  type: InstanceCommandType;
  version?: TwentyAllVersion;
};

/**
 * Generates an instance command file for the given version and type.
 * PORT-NOTE: nest-commander removed; this is a plain async function.
 */
export async function generateInstanceCommand(
  service: InstanceCommandGenerationService,
  options: GenerateInstanceCommandOptions,
): Promise<void> {
  const migrationName = options.name;
  const version = options.version ?? TWENTY_CURRENT_VERSION;
  const commandType = options.type;

  console.log(
    `Generating ${commandType} instance command for version ${version}...`,
  );

  const versionSlug = version.split('.').slice(0, 2).join('-');
  const versionDir = path.join(UPGRADE_VERSION_COMMAND_DIR, versionSlug);
  const timestamp = Date.now();

  const result = await service.generateInstanceCommand({
    migrationName,
    version,
    timestamp,
    type: commandType,
  });

  if (!result) {
    console.warn(
      'No changes in database schema were found - cannot generate a migration.',
    );
    return;
  }

  const filePath = path.join(versionDir, result.fileName);
  fs.writeFileSync(filePath, result.fileTemplate);

  console.log(
    `${commandType} instance command generated successfully: ${filePath}`,
  );
  console.log(`  Class: ${result.className}`);
  console.log(`  Version: ${version}`);

  appendToInstanceCommandsConstant(result.className, versionSlug, result.fileName);
}

function appendToInstanceCommandsConstant(
  className: string,
  versionSlug: string,
  fileName: string,
): void {
  const constantFilePath = path.join(
    UPGRADE_VERSION_COMMAND_DIR,
    'instance-commands.constant.ts',
  );

  const content = fs.readFileSync(constantFilePath, 'utf-8');

  if (content.includes(className)) {
    throw new Error(
      `${className} is already registered in instance-commands.constant.ts`,
    );
  }

  const importPath = `src/lib/sabcrm/server/src/database/commands/upgrade-version-command/${versionSlug}/${fileName.replace('.ts', '')}`;
  const newImportLine = `import { ${className} } from '${importPath}';\n`;

  const updatedContent = content
    .replace(/\nexport const/, `${newImportLine}\nexport const`)
    .replace(/\];/, `  ${className},\n];`);

  fs.writeFileSync(constantFilePath, updatedContent);
  console.log(`Added ${className} to instance-commands.constant.ts`);
}

// Re-export validation helpers for callers.
export { TWENTY_ALL_VERSIONS, TWENTY_CURRENT_VERSION };
