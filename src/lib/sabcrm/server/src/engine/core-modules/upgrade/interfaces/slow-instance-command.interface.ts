// PORT-NOTE: server-logic — TypeORM DataSource dependency removed.
// SlowInstanceCommand adds a runDataMigration step on top of FastInstanceCommand.
// In the Next.js/Mongo context this runs directly against the MongoDB connection.

import { type FastInstanceCommand } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface";

export interface SlowInstanceCommand extends FastInstanceCommand {
  runDataMigration(): Promise<void>;
}
