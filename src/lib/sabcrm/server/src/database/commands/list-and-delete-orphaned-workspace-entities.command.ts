import 'server-only';

import chalk from 'chalk';
import { type Collection, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  type MigrationCommandOptions,
  MigrationCommandRunner,
} from '@/lib/sabcrm/server/src/database/commands/command-runners/migration.command-runner';

// PORT-NOTE: This command originally used TypeORM DataSource to find orphaned
// records referencing non-existent workspaces across many PostgreSQL tables.
// In SabNode (Mongo) the equivalent is to scan each sabcrm_* collection for
// documents whose workspaceId is not present in sabcrm_workspace.
// The original entity list is preserved as collection-name constants.

const WORKSPACE_RELATED_COLLECTIONS = [
  // Level 4: Deepest children
  'sabcrm_view_field',
  'sabcrm_view_filter',
  'sabcrm_view_group',
  'sabcrm_view_sort',
  'sabcrm_view_filter_group',
  'sabcrm_field_permission',
  'sabcrm_object_permission',
  'sabcrm_role_permission_flag',
  'sabcrm_role_target',
  'sabcrm_search_field_metadata',
  'sabcrm_row_level_permission_predicate',
  'sabcrm_page_layout_widget',
  // Level 3
  'sabcrm_row_level_permission_predicate_group',
  'sabcrm_view',
  'sabcrm_index_metadata',
  'sabcrm_page_layout_tab',
  // Level 2
  'sabcrm_field_metadata',
  'sabcrm_page_layout',
  'sabcrm_permission_flag',
  'sabcrm_skill',
  'sabcrm_logic_function',
  // Level 1
  'sabcrm_object_metadata',
  'sabcrm_role',
  'sabcrm_agent',
  'sabcrm_user_workspace',
  'sabcrm_api_key',
  'sabcrm_logic_function_layer',
  // Level 0: Independent
  'sabcrm_application',
  'sabcrm_approved_access_domain',
  'sabcrm_billing_customer',
  'sabcrm_billing_entitlement',
  'sabcrm_billing_subscription',
  'sabcrm_data_source',
  'sabcrm_emailing_domain',
  'sabcrm_feature_flag',
  'sabcrm_file',
  'sabcrm_public_domain',
  'sabcrm_webhook',
  'sabcrm_workspace_sso_identity_provider',
] as const;

type DeletionResult = {
  collectionName: string;
  success: boolean;
  deletedCount?: number;
  error?: string;
};

type OrphanedRecord = {
  collectionName: string;
  id: string;
  workspaceId: string;
};

export class ListOrphanedWorkspaceEntitiesCommand extends MigrationCommandRunner {
  private db: Db | null = null;

  private async getDb(): Promise<Db> {
    if (!this.db) {
      this.db = await connectToDatabase();
    }
    return this.db;
  }

  override async runMigrationCommand(
    _passedParams: string[],
    options: MigrationCommandOptions,
  ): Promise<void> {
    const db = await this.getDb();

    this.logger.log(
      chalk.blue('Looking for orphaned records in workspace-related collections...'),
    );

    // Build the set of valid workspace IDs.
    const workspaceIds = await db
      .collection('sabcrm_workspace')
      .distinct('_id');
    const workspaceIdSet = new Set(workspaceIds.map(String));

    const allOrphanedRecords: OrphanedRecord[] = [];
    const orphanedIdsByCollection = new Map<string, string[]>();

    for (const collectionName of WORKSPACE_RELATED_COLLECTIONS) {
      try {
        const collection: Collection<{ _id: unknown; workspaceId?: string }> =
          db.collection(collectionName);

        const orphanedDocs = await collection
          .find(
            {},
            { projection: { _id: 1, workspaceId: 1 } },
          )
          .toArray();

        const orphaned = orphanedDocs.filter(
          (doc) => doc.workspaceId && !workspaceIdSet.has(doc.workspaceId),
        );

        if (orphaned.length > 0) {
          const ids = orphaned.map((d) => String(d._id));
          orphanedIdsByCollection.set(collectionName, ids);

          for (const doc of orphaned) {
            allOrphanedRecords.push({
              collectionName,
              id: String(doc._id),
              workspaceId: doc.workspaceId ?? '',
            });
          }

          this.logger.log(
            chalk.yellow(`  ${collectionName}: ${orphaned.length} orphaned record(s)`),
          );
        }
      } catch {
        this.logger.warn(
          chalk.gray(`  ${collectionName}: Skipped (collection not found)`),
        );
      }
    }

    if (allOrphanedRecords.length === 0) {
      this.logger.log(chalk.green('No orphaned records found.'));
      return;
    }

    this.logger.log(
      chalk.yellow(
        `Total: ${allOrphanedRecords.length} orphaned record(s) across ${orphanedIdsByCollection.size} collection(s)`,
      ),
    );

    const deletionResults: DeletionResult[] = [];

    for (const [collectionName, ids] of orphanedIdsByCollection) {
      this.logger.log(
        chalk.gray(`  Processing ${collectionName} (${ids.length} records)...`),
      );

      try {
        let deletedCount = 0;

        if (!options.dryRun) {
          const collection = db.collection(collectionName);
          const result = await collection.deleteMany({ _id: { $in: ids } });
          deletedCount = result.deletedCount;
        }

        deletionResults.push({ collectionName, success: true, deletedCount });
        this.logger.log(
          chalk.green(`  ✓ Deleted ${deletedCount} ${collectionName} record(s)`),
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deletionResults.push({ collectionName, success: false, error: errorMessage });
        this.logger.error(
          chalk.red(`  ✗ Failed to delete ${collectionName} records: ${errorMessage}`),
        );
      }
    }

    const successfulDeletions = deletionResults.filter((r) => r.success);
    const failedDeletions = deletionResults.filter((r) => !r.success);
    const totalDeleted = successfulDeletions.reduce(
      (sum, r) => sum + (r.deletedCount ?? 0),
      0,
    );

    this.logger.log(chalk.blue('\n=== Deletion Summary ==='));
    this.logger.log(
      chalk.green(
        `Successfully deleted: ${totalDeleted} record(s) across ${successfulDeletions.length} collection(s)`,
      ),
    );

    if (failedDeletions.length > 0) {
      this.logger.log(
        chalk.red(`Failed deletions: ${failedDeletions.length} collection(s)`),
      );
      for (const failure of failedDeletions) {
        this.logger.log(
          chalk.red(`  - ${failure.collectionName}: ${failure.error}`),
        );
      }
    }
  }
}
