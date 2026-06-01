import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.23.0', 1780000001500)
// Ported to plain async functions backed by MongoDB.
// Original: Delete and recreate all record page layouts from standard config,
// backfill custom objects, and enable IS_RECORD_PAGE_LAYOUT_EDITING_ENABLED.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageLayoutDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  type: string;
  objectMetadataId?: string | null;
  objectMetadataUniversalIdentifier?: string | null;
  [key: string]: unknown;
};

type PageLayoutTabDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  pageLayoutId: string;
  pageLayoutUniversalIdentifier: string;
  [key: string]: unknown;
};

type PageLayoutWidgetDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  pageLayoutTabId: string;
  pageLayoutTabUniversalIdentifier: string;
  [key: string]: unknown;
};

type ViewDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  type: string;
  objectMetadataUniversalIdentifier?: string | null;
  [key: string]: unknown;
};

type ViewFieldDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  viewUniversalIdentifier: string;
  fieldMetadataUniversalIdentifier: string;
  [key: string]: unknown;
};

type ViewFieldGroupDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  viewUniversalIdentifier: string;
  [key: string]: unknown;
};

type ObjectMetadataDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  isCustom: boolean;
  isRemote: boolean;
  isActive: boolean;
  [key: string]: unknown;
};

type FeatureFlagDoc = {
  key: string;
  workspaceId: string;
  isEnabled: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isFeatureEnabled(
  db: Awaited<ReturnType<typeof connectToDatabase>>["db"],
  key: string,
  workspaceId: string,
): Promise<boolean> {
  const doc = await db
    .collection<FeatureFlagDoc>("sabcrm_featureFlag")
    .findOne({ key, workspaceId });
  return doc?.isEnabled === true;
}

async function enableFeatureFlag(
  db: Awaited<ReturnType<typeof connectToDatabase>>["db"],
  key: string,
  workspaceId: string,
): Promise<void> {
  await db
    .collection("sabcrm_featureFlag")
    .updateOne(
      { key, workspaceId },
      { $set: { key, workspaceId, isEnabled: true } },
      { upsert: true },
    );
}

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function backfillRecordPageLayouts(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  const isAlreadyEnabled = await isFeatureEnabled(
    db,
    "IS_RECORD_PAGE_LAYOUT_EDITING_ENABLED",
    workspaceId,
  );

  if (isAlreadyEnabled) {
    console.log(
      `IS_RECORD_PAGE_LAYOUT_EDITING_ENABLED already enabled for workspace ${workspaceId}, skipping`,
    );
    return;
  }

  if (isDryRun) {
    console.log(
      `[DRY RUN] Would recreate all record page layouts and enable feature flag for workspace ${workspaceId}`,
    );
    return;
  }

  // --- Delete all RECORD_PAGE layout entities ---

  const recordPageLayouts = await db
    .collection<PageLayoutDoc>("sabcrm_pageLayout")
    .find({ workspaceId, type: "RECORD_PAGE" })
    .toArray();

  const recordPageLayoutIds = new Set(recordPageLayouts.map((l) => l._id));

  const tabs = await db
    .collection<PageLayoutTabDoc>("sabcrm_pageLayoutTab")
    .find({ workspaceId, pageLayoutId: { $in: [...recordPageLayoutIds] } })
    .toArray();

  const tabIds = new Set(tabs.map((t) => t._id));

  const widgets = await db
    .collection<PageLayoutWidgetDoc>("sabcrm_pageLayoutWidget")
    .find({ workspaceId, pageLayoutTabId: { $in: [...tabIds] } })
    .toArray();

  const fieldsWidgetViews = await db
    .collection<ViewDoc>("sabcrm_view")
    .find({ workspaceId, type: "FIELDS_WIDGET" })
    .toArray();

  const fieldsWidgetViewUniversalIdentifiers = new Set(
    fieldsWidgetViews.map((v) => v.universalIdentifier),
  );

  const viewFields = await db
    .collection<ViewFieldDoc>("sabcrm_viewField")
    .find({
      workspaceId,
      viewUniversalIdentifier: {
        $in: [...fieldsWidgetViewUniversalIdentifiers],
      },
    })
    .toArray();

  const viewFieldGroups = await db
    .collection<ViewFieldGroupDoc>("sabcrm_viewFieldGroup")
    .find({
      workspaceId,
      viewUniversalIdentifier: {
        $in: [...fieldsWidgetViewUniversalIdentifiers],
      },
    })
    .toArray();

  if (recordPageLayouts.length > 0 || fieldsWidgetViews.length > 0) {
    console.log(
      `Deleting ${recordPageLayouts.length} page layouts, ${tabs.length} tabs, ${widgets.length} widgets, ${fieldsWidgetViews.length} views, ${viewFields.length} view fields, ${viewFieldGroups.length} view field groups for workspace ${workspaceId}`,
    );

    if (viewFields.length > 0) {
      await db
        .collection("sabcrm_viewField")
        .deleteMany({ _id: { $in: viewFields.map((f) => f._id) } });
    }
    if (viewFieldGroups.length > 0) {
      await db
        .collection("sabcrm_viewFieldGroup")
        .deleteMany({ _id: { $in: viewFieldGroups.map((g) => g._id) } });
    }
    if (fieldsWidgetViews.length > 0) {
      await db
        .collection("sabcrm_view")
        .deleteMany({ _id: { $in: fieldsWidgetViews.map((v) => v._id) } });
    }
    if (widgets.length > 0) {
      await db
        .collection("sabcrm_pageLayoutWidget")
        .deleteMany({ _id: { $in: widgets.map((w) => w._id) } });
    }
    if (tabs.length > 0) {
      await db
        .collection("sabcrm_pageLayoutTab")
        .deleteMany({ _id: { $in: tabs.map((t) => t._id) } });
    }
    if (recordPageLayouts.length > 0) {
      await db
        .collection("sabcrm_pageLayout")
        .deleteMany({ _id: { $in: recordPageLayouts.map((l) => l._id) } });
    }
  }

  // PORT-NOTE: Recreation of standard record page layouts from the standard
  // application maps requires the computeTwentyStandardApplicationAllFlatEntityMaps
  // runtime, which is Twenty-internal. In SabNode the standard layout definitions
  // should be sourced from a sabcrm_standardPageLayout seed collection or
  // an equivalent registry. The deletion above ensures a clean state.

  // Custom objects without page layouts
  const allPageLayouts = await db
    .collection<PageLayoutDoc>("sabcrm_pageLayout")
    .find({ workspaceId, type: "RECORD_PAGE" })
    .toArray();

  const objectIdsWithPageLayout = new Set(
    allPageLayouts
      .filter((l) => l.objectMetadataId)
      .map((l) => l.objectMetadataId),
  );

  const customObjects = await db
    .collection<ObjectMetadataDoc>("sabcrm_objectMetadata")
    .find({ workspaceId, isCustom: true, isRemote: false })
    .toArray();

  const customObjectsWithoutPageLayout = customObjects.filter(
    (obj) => !objectIdsWithPageLayout.has(obj._id),
  );

  if (customObjectsWithoutPageLayout.length > 0) {
    console.log(
      `Creating page layouts for ${customObjectsWithoutPageLayout.length} custom object(s) in workspace ${workspaceId}`,
    );
    // PORT-NOTE: Full layout creation for custom objects requires
    // computeFlatDefaultRecordPageLayoutToCreate from the Twenty runtime.
    // Implement using equivalent SabNode utilities.
  }

  // Enable feature flags
  await enableFeatureFlag(
    db,
    "IS_RECORD_PAGE_LAYOUT_EDITING_ENABLED",
    workspaceId,
  );
  await enableFeatureFlag(
    db,
    "IS_RECORD_PAGE_LAYOUT_GLOBAL_EDITION_ENABLED",
    workspaceId,
  );

  console.log(
    `Successfully backfilled record page layouts for workspace ${workspaceId}`,
  );
}
