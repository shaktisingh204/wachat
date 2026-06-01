import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: Workspace command (version 2.2.0, timestamp 1786000000000).
// Sets displayedMaxRows = 99 on the calendarEvent.description field metadata
// for each workspace where it is not yet set.

export const SET_CALENDAR_EVENT_DESCRIPTION_MAX_ROWS_COMMAND_NAME =
  "upgrade:2-2:set-calendar-event-description-displayed-max-rows";

const DISPLAYED_MAX_ROWS = 99;

// Universal identifier for the calendarEvent.description field
// (from STANDARD_OBJECTS.calendarEvent.fields.description.universalIdentifier)
const CALENDAR_EVENT_DESCRIPTION_UNIVERSAL_IDENTIFIER =
  "20202020-0402-4118-8e2a-05b9bdae6dab";

export interface SetCalendarEventDescriptionMaxRowsOptions {
  dryRun?: boolean;
}

export interface SetCalendarEventDescriptionMaxRowsResult {
  workspaceId: string;
  updated: boolean;
  skipped: boolean;
}

/**
 * Finds the calendarEvent.description field-metadata document for the given
 * workspace and sets `settings.displayedMaxRows` to 99 if not already set.
 */
export async function setCalendarEventDescriptionDisplayedMaxRows(
  workspaceId: string,
  options: SetCalendarEventDescriptionMaxRowsOptions = {},
): Promise<SetCalendarEventDescriptionMaxRowsResult> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_fieldMetadata");

  const descriptionField = await collection.findOne({
    workspaceId,
    universalIdentifier: CALENDAR_EVENT_DESCRIPTION_UNIVERSAL_IDENTIFIER,
  });

  if (!descriptionField) {
    return { workspaceId, updated: false, skipped: true };
  }

  const currentSettings = (descriptionField.settings ?? {}) as Record<string, unknown>;

  if (currentSettings.displayedMaxRows === DISPLAYED_MAX_ROWS) {
    return { workspaceId, updated: false, skipped: true };
  }

  if (isDryRun) {
    return { workspaceId, updated: false, skipped: false };
  }

  await collection.updateOne(
    { _id: descriptionField._id },
    {
      $set: {
        "settings.displayedMaxRows": DISPLAYED_MAX_ROWS,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return { workspaceId, updated: true, skipped: false };
}
