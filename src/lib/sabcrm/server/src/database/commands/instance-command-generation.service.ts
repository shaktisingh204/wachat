import 'server-only';

// PORT-NOTE: InstanceCommandGenerationService — originally depended on TypeORM's
// DataSource to introspect schema diffs. In SabNode (Mongo) there is no
// equivalent auto-diff mechanism. The file-generation helpers are ported faithfully;
// `generateInstanceCommand` will return null until a Mongo schema-diff adapter is
// wired. The template builders remain fully functional.

// pascalCase helper inlined from twenty-shared/utils to avoid circular deps.
function pascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export type TwentyAllVersion = string;
export type InstanceCommandType = 'fast' | 'slow';

type GenerateInstanceCommandArgs = {
  migrationName: string;
  version: TwentyAllVersion;
  timestamp: number;
  type?: InstanceCommandType;
};

export type GeneratedMigrationResult = {
  fileName: string;
  fileTemplate: string;
  className: string;
};

type UpQuery = { query: string; parameters?: unknown[] };

export class InstanceCommandGenerationService {
  /**
   * PORT-NOTE: In Twenty, this method called dataSource.driver.createSchemaBuilder().log()
   * to compute TypeORM SQL diffs. In SabNode (Mongo) there is no equivalent.
   * This stub always returns null. Implement a Mongo-based schema comparator and
   * call buildMigrationResult() directly when available.
   */
  async generateInstanceCommand({
    migrationName,
    version,
    timestamp,
    type = 'fast',
  }: GenerateInstanceCommandArgs): Promise<GeneratedMigrationResult | null> {
    // No schema-diff source available in Mongo context.
    return null;
  }

  /**
   * Builds a migration result from explicit up/down queries.
   * Use this when you have the SQL statements from an external source.
   */
  buildMigrationResult({
    migrationName,
    version,
    timestamp,
    type = 'fast',
    upQueries,
    downQueries,
  }: GenerateInstanceCommandArgs & {
    upQueries: UpQuery[];
    downQueries: UpQuery[];
  }): GeneratedMigrationResult {
    const className = this.buildClassName({ name: migrationName, type });

    const upStatements = upQueries.map(
      ({ query, parameters }) =>
        `    await queryRunner.query('${this.escapeForSingleQuotedString(query)}'${this.formatQueryParams(parameters)});`,
    );

    const downStatements = downQueries
      .slice()
      .reverse()
      .map(
        ({ query, parameters }) =>
          `    await queryRunner.query('${this.escapeForSingleQuotedString(query)}'${this.formatQueryParams(parameters)});`,
      );

    const fileTemplate =
      type === 'slow'
        ? this.buildSlowMigrationFileContent({
            className,
            version,
            timestamp,
            upStatements,
            downStatements,
          })
        : this.buildFastMigrationFileContent({
            className,
            version,
            timestamp,
            upStatements,
            downStatements,
          });

    const versionSlug = version.split('.').slice(0, 2).join('-');
    const fileName = `${versionSlug}-instance-command-${type}-${timestamp}-${migrationName}.ts`;

    return { fileName, fileTemplate, className };
  }

  private buildClassName({
    name,
    type,
  }: {
    name: string;
    type: InstanceCommandType;
  }): string {
    return `${pascalCase(name)}${pascalCase(type)}InstanceCommand`;
  }

  private formatQueryParams(parameters: unknown[] | undefined): string {
    if (!parameters || !parameters.length) return '';
    return `, ${JSON.stringify(parameters)}`;
  }

  private escapeForSingleQuotedString(query: string): string {
    return query.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private buildFastMigrationFileContent({
    className,
    version,
    timestamp,
    upStatements,
    downStatements,
  }: {
    className: string;
    version: string;
    timestamp: number;
    upStatements: string[];
    downStatements: string[];
  }): string {
    return `import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/lib/sabcrm/server/src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/lib/sabcrm/server/src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('${version}', ${timestamp})
export class ${className} implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
${upStatements.join('\n')}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
${downStatements.join('\n')}
  }
}
`;
  }

  private buildSlowMigrationFileContent({
    className,
    version,
    timestamp,
    upStatements,
    downStatements,
  }: {
    className: string;
    version: string;
    timestamp: number;
    upStatements: string[];
    downStatements: string[];
  }): string {
    return `import { DataSource, QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/lib/sabcrm/server/src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { SlowInstanceCommand } from 'src/lib/sabcrm/server/src/engine/core-modules/upgrade/interfaces/slow-instance-command.interface';

@RegisteredInstanceCommand('${version}', ${timestamp}, { type: 'slow' })
export class ${className} implements SlowInstanceCommand {
  async runDataMigration(dataSource: DataSource): Promise<void> {
    // TODO: implement data backfill before the DDL migration
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
${upStatements.join('\n')}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
${downStatements.join('\n')}
  }
}
`;
  }
}

export const instanceCommandGenerationService = new InstanceCommandGenerationService();
