import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: Workspace command (version 2.3.0, timestamp 1798000000000).
// Deletes all GAUGE_CHART page layout widgets — gauge support has been removed.

export const DELETE_GAUGE_WIDGETS_COMMAND_NAME =
  "upgrade:2-3:delete-gauge-widgets";

export interface DeleteGaugeWidgetsOptions {
  dryRun?: boolean;
}

export interface DeleteGaugeWidgetsResult {
  workspaceId: string;
  deletedCount: number;
  skipped: boolean;
}

/**
 * Finds all pageLayoutWidget documents in the given workspace whose
 * universalConfiguration.configurationType is "GAUGE_CHART" and deletes them.
 *
 * Widgets without a recognised universalConfiguration are skipped (logged).
 */
export async function deleteGaugeWidgets(
  workspaceId: string,
  options: DeleteGaugeWidgetsOptions = {},
): Promise<DeleteGaugeWidgetsResult> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_pageLayoutWidget");

  const allWidgets = await collection.find({ workspaceId }).toArray();

  const widgetsWithMissingConfig = allWidgets.filter(
    (w) => w.universalConfiguration === null || w.universalConfiguration === undefined,
  );

  if (widgetsWithMissingConfig.length > 0) {
    // Log but do not throw — same behaviour as the original.
    console.warn(
      `[deleteGaugeWidgets] workspace ${workspaceId}: ${widgetsWithMissingConfig.length} widget(s) with missing universalConfiguration skipped: ${widgetsWithMissingConfig.map((w) => String(w._id)).join(", ")}`,
    );
  }

  const gaugeWidgets = allWidgets.filter(
    (w) =>
      (w.universalConfiguration?.configurationType as string | undefined) ===
      "GAUGE_CHART",
  );

  if (gaugeWidgets.length === 0) {
    return { workspaceId, deletedCount: 0, skipped: true };
  }

  if (isDryRun) {
    return { workspaceId, deletedCount: gaugeWidgets.length, skipped: false };
  }

  const ids = gaugeWidgets.map((w) => w._id);
  const result = await collection.deleteMany({ _id: { $in: ids } });

  return { workspaceId, deletedCount: result.deletedCount, skipped: false };
}
