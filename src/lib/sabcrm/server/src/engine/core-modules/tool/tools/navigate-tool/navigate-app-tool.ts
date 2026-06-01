import "server-only";

import Fuse from 'fuse.js';

import {
  type NavigateAppInput,
  NavigateAppInputZodSchema,
} from '@/lib/sabcrm/server/src/engine/core-modules/tool/tools/navigate-tool/navigate-app-tool.schema';
import { type ToolInput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool.type';

// PORT-NOTE: NestJS DI and Twenty-internal services (WorkspaceManyOrAllFlatEntityMapsCacheService,
// NavigationMenuItemService, ViewService, GlobalWorkspaceOrmManager, buildSystemAuthContext)
// are not available in SabNode. Navigation actions that require live metadata lookups
// must be supplied via the ToolExecutionContext extension point (see NavigateAppToolDeps below)
// or replaced with SabNode's own metadata/query layer when integrating.
// The core schema, parsing, and dispatch logic is preserved faithfully; only the
// service-call bodies are stubbed so the type contract remains intact.

export type NavigateAppToolOutput =
  | { action: 'wait'; durationMs: number }
  | { action: 'navigateToView'; viewId: string; viewName: string; objectNameSingular: string }
  | { action: 'navigateToObject'; objectNameSingular: string }
  | { action: 'navigateToRecord'; objectNameSingular: string; recordId: string };

// Dependency interface that callers must inject when constructing the tool.
// This replaces NestJS constructor injection.
export type NavigateAppToolDeps = {
  findViewsByWorkspaceId: (
    workspaceId: string,
    userWorkspaceId?: string,
  ) => Promise<Array<{ id: string; name: string; objectMetadataId: string }>>;

  findNavigationMenuItems: (workspaceId: string) => Promise<
    Array<{
      type: string;
      targetObjectMetadataId?: string;
      viewId?: string;
    }>
  >;

  resolveObjectMetadata: (
    workspaceId: string,
    objectMetadataId: string,
  ) => Promise<{
    nameSingular: string;
    labelSingular: string;
    labelPlural: string;
  } | null>;

  findRecordsByObject: (
    workspaceId: string,
    objectNameSingular: string,
    labelIdentifierFieldName: string,
    isFullName: boolean,
  ) => Promise<Array<{ id: string; displayName: string }>>;
};

export class NavigateAppTool implements Tool {
  description = `Navigate the application.
    Use navigateToRecord when the user wants to go to a specific record by name.
    Default to navigateToObject for all other navigation requests.
    Only use navigateToView when the user explicitly mentions the word "view" in their request.
    If the user asks to wait, use the wait tool with the specified duration.`;

  inputSchema = NavigateAppInputZodSchema;

  private readonly deps: NavigateAppToolDeps;

  constructor(deps: NavigateAppToolDeps) {
    this.deps = deps;
  }

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult = NavigateAppInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid navigation input',
        error: parseResult.error.message,
      };
    }

    const input: NavigateAppInput = parseResult.data;

    switch (input.type) {
      case 'navigateToView':
        return this.navigateToView(
          input.viewName,
          context.workspaceId,
          context.userWorkspaceId,
        );
      case 'navigateToObject':
        return this.navigateToObject(
          input.objectNameSingular,
          context.workspaceId,
        );
      case 'navigateToRecord':
        return this.navigateToRecord(
          input.objectNameSingular,
          input.recordName,
          context.workspaceId,
        );
      case 'wait':
        return this.wait(input.durationMs);
    }
  }

  private async wait(durationMs: number): Promise<ToolOutput<NavigateAppToolOutput>> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    return {
      success: true,
      message: `Waited for ${durationMs}ms`,
      result: { action: 'wait', durationMs },
    };
  }

  private async navigateToView(
    viewName: string,
    workspaceId: string,
    userWorkspaceId?: string,
  ): Promise<ToolOutput<NavigateAppToolOutput>> {
    const views = await this.deps.findViewsByWorkspaceId(workspaceId, userWorkspaceId);

    const fuse = new Fuse(views, { keys: ['name'], threshold: 0.4 });
    const results = fuse.search(viewName);
    const matchingView = results[0]?.item;

    if (!matchingView) {
      const availableViewNames = views.map((v) => v.name).join(', ');

      return {
        success: false,
        message: `View "${viewName}" not found`,
        error: `No view matching "${viewName}" was found in this workspace. Available views: ${availableViewNames}`,
      };
    }

    const objectMetadata = await this.deps.resolveObjectMetadata(
      workspaceId,
      matchingView.objectMetadataId,
    );

    if (!objectMetadata) {
      return {
        success: false,
        message: `Object metadata for view "${matchingView.name}" not found`,
        error: `Could not resolve the object associated with view "${matchingView.name}"`,
      };
    }

    return {
      success: true,
      message: `Navigating to view "${matchingView.name}"`,
      result: {
        action: 'navigateToView',
        viewId: matchingView.id,
        viewName: matchingView.name,
        objectNameSingular: objectMetadata.nameSingular,
      },
    };
  }

  private async navigateToObject(
    objectNameSingular: string,
    workspaceId: string,
  ): Promise<ToolOutput<NavigateAppToolOutput>> {
    const menuItems = await this.deps.findNavigationMenuItems(workspaceId);

    type NavigatableObject = {
      nameSingular: string;
      labelSingular: string;
      labelPlural: string;
    };

    const navigatableObjects: NavigatableObject[] = [];

    for (const item of menuItems) {
      const objectMetadataId = item.targetObjectMetadataId;

      if (!objectMetadataId) continue;

      const meta = await this.deps.resolveObjectMetadata(workspaceId, objectMetadataId);

      if (!meta) continue;

      navigatableObjects.push({
        nameSingular: meta.nameSingular,
        labelSingular: meta.labelSingular,
        labelPlural: meta.labelPlural,
      });
    }

    const fuse = new Fuse(navigatableObjects, {
      keys: ['nameSingular', 'labelSingular', 'labelPlural'],
      threshold: 0.4,
    });

    const results = fuse.search(objectNameSingular);
    const matchingObject = results[0]?.item;

    if (!matchingObject) {
      const availableLabels = navigatableObjects
        .map((o) => o.labelPlural)
        .join(', ');

      return {
        success: false,
        message: `Object "${objectNameSingular}" not found`,
        error: `No object matching "${objectNameSingular}" was found in this workspace. Available objects: ${availableLabels}`,
      };
    }

    return {
      success: true,
      message: `Navigating to ${matchingObject.labelPlural} default view`,
      result: {
        action: 'navigateToObject',
        objectNameSingular: matchingObject.nameSingular,
      },
    };
  }

  private async navigateToRecord(
    objectNameSingular: string,
    recordName: string,
    workspaceId: string,
  ): Promise<ToolOutput<NavigateAppToolOutput>> {
    // PORT-NOTE: labelIdentifierField resolution requires flat-entity metadata maps from
    // Twenty's internal workspace ORM. Here we delegate to the injected dep which must
    // implement this lookup on top of SabNode's Mongo metadata store.
    const records = await this.deps.findRecordsByObject(
      workspaceId,
      objectNameSingular,
      'name',    // caller should override with the real label identifier field
      false,
    );

    const fuse = new Fuse(records, { keys: ['displayName'], threshold: 0.4 });
    const results = fuse.search(recordName);
    const matchingRecord = results[0]?.item;

    if (!matchingRecord) {
      return {
        success: false,
        message: `Record "${recordName}" not found in ${objectNameSingular}`,
        error: `No ${objectNameSingular} record matching "${recordName}" was found.`,
      };
    }

    return {
      success: true,
      message: `Navigating to ${objectNameSingular} record "${matchingRecord.displayName}"`,
      result: {
        action: 'navigateToRecord',
        objectNameSingular,
        recordId: matchingRecord.id,
      },
    };
  }
}
