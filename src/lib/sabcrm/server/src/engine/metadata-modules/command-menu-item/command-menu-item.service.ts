import 'server-only';

// PORT-NOTE: NestJS @Injectable() service -> plain exported functions + service object.
// Dependencies:
//   - workspaceMigrationValidateBuildAndRunService: stub-imported (not yet ported)
//   - workspaceManyOrAllFlatEntityMapsCacheService: stub-imported (not yet ported)
//   - applicationService: stub-imported (not yet ported)
//   - i18nService: stub-imported (not yet ported)
// DataLoader replaced with a direct async function parameter.

import { isDefined } from '@/lib/sabcrm/shared/src/utils';

import {
  CommandMenuItemException,
  CommandMenuItemExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/command-menu-item.exception';
import type { CommandMenuItemDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/command-menu-item.dto';
import type { CreateCommandMenuItemInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/create-command-menu-item.input';
import type { UpdateCommandMenuItemInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/update-command-menu-item.input';

// PORT-NOTE: The following service stubs are forward declarations.
// Replace with real implementations when those modules are ported.
import { workspaceManyOrAllFlatEntityMapsCacheService } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { applicationService } from '@/lib/sabcrm/server/src/engine/core-modules/application/application.service';
import { fromFlatCommandMenuItemToCommandMenuItemDto } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-flat-command-menu-item-to-command-menu-item-dto.util';
import { fromCreateCommandMenuItemInputToFlatCommandMenuItemToCreate } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-create-command-menu-item-input-to-flat-command-menu-item-to-create.util';
import { fromDeleteCommandMenuItemInputToFlatCommandMenuItemOrThrow } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-delete-command-menu-item-input-to-flat-command-menu-item-or-throw.util';
import { fromUpdateCommandMenuItemInputToFlatCommandMenuItemToUpdateOrThrow } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-update-command-menu-item-input-to-flat-command-menu-item-to-update-or-throw.util';
import { findFlatEntityByIdInFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util';
import { workspaceMigrationValidateBuildAndRunService } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';
import { WorkspaceMigrationBuilderException } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';
import type { FlatCommandMenuItem } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';

async function findAll(workspaceId: string): Promise<CommandMenuItemDTO[]> {
  const { flatCommandMenuItemMaps } =
    await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatCommandMenuItemMaps'],
    });

  return Object.values(flatCommandMenuItemMaps.byUniversalIdentifier)
    .filter(isDefined)
    .sort((a, b) => a.position - b.position)
    .map(fromFlatCommandMenuItemToCommandMenuItemDto);
}

async function findById(
  id: string,
  workspaceId: string,
): Promise<CommandMenuItemDTO | null> {
  const { flatCommandMenuItemMaps } =
    await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatCommandMenuItemMaps'],
    });

  const flatCommandMenuItem = findFlatEntityByIdInFlatEntityMaps({
    flatEntityId: id,
    flatEntityMaps: flatCommandMenuItemMaps,
  });

  if (!isDefined(flatCommandMenuItem)) {
    return null;
  }

  return fromFlatCommandMenuItemToCommandMenuItemDto(flatCommandMenuItem);
}

async function findByIdOrThrow(
  id: string,
  workspaceId: string,
): Promise<CommandMenuItemDTO> {
  const commandMenuItem = await findById(id, workspaceId);

  if (!isDefined(commandMenuItem)) {
    throw new CommandMenuItemException(
      'Command menu item not found',
      CommandMenuItemExceptionCode.COMMAND_MENU_ITEM_NOT_FOUND,
    );
  }

  return commandMenuItem;
}

async function create(
  input: CreateCommandMenuItemInput,
  workspaceId: string,
): Promise<CommandMenuItemDTO> {
  const {
    flatObjectMetadataMaps,
    flatFrontComponentMaps,
    flatPageLayoutMaps,
  } = await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
    workspaceId,
    flatMapsKeys: [
      'flatObjectMetadataMaps',
      'flatFrontComponentMaps',
      'flatPageLayoutMaps',
    ],
  });

  const { workspaceCustomFlatApplication } =
    await applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
      { workspaceId },
    );

  const flatCommandMenuItemToCreate =
    fromCreateCommandMenuItemInputToFlatCommandMenuItemToCreate({
      createCommandMenuItemInput: input,
      workspaceId,
      flatApplication: workspaceCustomFlatApplication,
      flatObjectMetadataMaps,
      flatFrontComponentMaps,
      flatPageLayoutMaps,
    });

  const validateAndBuildResult =
    await workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration({
      allFlatEntityOperationByMetadataName: {
        commandMenuItem: {
          flatEntityToCreate: [flatCommandMenuItemToCreate],
          flatEntityToDelete: [],
          flatEntityToUpdate: [],
        },
      },
      workspaceId,
      isSystemBuild: false,
      applicationUniversalIdentifier:
        workspaceCustomFlatApplication.universalIdentifier,
    });

  if (validateAndBuildResult.status === 'fail') {
    throw new WorkspaceMigrationBuilderException(
      validateAndBuildResult,
      'Multiple validation errors occurred while creating command menu item',
    );
  }

  const { flatCommandMenuItemMaps: recomputedFlatCommandMenuItemMaps } =
    await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatCommandMenuItemMaps'],
    });

  return fromFlatCommandMenuItemToCommandMenuItemDto(
    findFlatEntityByIdInFlatEntityMapsOrThrow({
      flatEntityId: flatCommandMenuItemToCreate.id,
      flatEntityMaps: recomputedFlatCommandMenuItemMaps,
    }),
  );
}

async function update(
  input: UpdateCommandMenuItemInput,
  workspaceId: string,
): Promise<CommandMenuItemDTO> {
  const { workspaceCustomFlatApplication } =
    await applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
      { workspaceId },
    );

  const {
    flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps,
    flatObjectMetadataMaps: existingFlatObjectMetadataMaps,
    flatPageLayoutMaps: existingFlatPageLayoutMaps,
  } = await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
    workspaceId,
    flatMapsKeys: [
      'flatCommandMenuItemMaps',
      'flatObjectMetadataMaps',
      'flatPageLayoutMaps',
    ],
  });

  const flatCommandMenuItemToUpdate =
    fromUpdateCommandMenuItemInputToFlatCommandMenuItemToUpdateOrThrow({
      flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps,
      updateCommandMenuItemInput: input,
      flatObjectMetadataMaps: existingFlatObjectMetadataMaps,
      flatPageLayoutMaps: existingFlatPageLayoutMaps,
    });

  const validateAndBuildResult =
    await workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration({
      allFlatEntityOperationByMetadataName: {
        commandMenuItem: {
          flatEntityToCreate: [],
          flatEntityToDelete: [],
          flatEntityToUpdate: [flatCommandMenuItemToUpdate],
        },
      },
      workspaceId,
      isSystemBuild: false,
      applicationUniversalIdentifier:
        workspaceCustomFlatApplication.universalIdentifier,
    });

  if (validateAndBuildResult.status === 'fail') {
    throw new WorkspaceMigrationBuilderException(
      validateAndBuildResult,
      'Multiple validation errors occurred while updating command menu item',
    );
  }

  const { flatCommandMenuItemMaps: recomputedFlatCommandMenuItemMaps } =
    await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatCommandMenuItemMaps'],
    });

  return fromFlatCommandMenuItemToCommandMenuItemDto(
    findFlatEntityByIdInFlatEntityMapsOrThrow({
      flatEntityId: input.id,
      flatEntityMaps: recomputedFlatCommandMenuItemMaps,
    }),
  );
}

async function deleteItem(
  id: string,
  workspaceId: string,
): Promise<CommandMenuItemDTO> {
  const { workspaceCustomFlatApplication } =
    await applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
      { workspaceId },
    );

  const { flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps } =
    await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatCommandMenuItemMaps'],
    });

  const flatCommandMenuItemToDelete =
    fromDeleteCommandMenuItemInputToFlatCommandMenuItemOrThrow({
      flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps,
      commandMenuItemId: id,
    });

  const validateAndBuildResult =
    await workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration({
      allFlatEntityOperationByMetadataName: {
        commandMenuItem: {
          flatEntityToCreate: [],
          flatEntityToDelete: [flatCommandMenuItemToDelete],
          flatEntityToUpdate: [],
        },
      },
      workspaceId,
      isSystemBuild: false,
      applicationUniversalIdentifier:
        workspaceCustomFlatApplication.universalIdentifier,
    });

  if (validateAndBuildResult.status === 'fail') {
    throw new WorkspaceMigrationBuilderException(
      validateAndBuildResult,
      'Multiple validation errors occurred while deleting command menu item',
    );
  }

  return fromFlatCommandMenuItemToCommandMenuItemDto(flatCommandMenuItemToDelete);
}

async function findAllFlatCommandMenuItems(
  workspaceId: string,
): Promise<FlatCommandMenuItem[]> {
  const { flatCommandMenuItemMaps } =
    await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatCommandMenuItemMaps'],
    });

  return Object.values(flatCommandMenuItemMaps.byUniversalIdentifier)
    .filter(isDefined)
    .sort((a, b) => a.position - b.position);
}

async function findByWorkflowVersionId(
  workflowVersionId: string,
  workspaceId: string,
): Promise<CommandMenuItemDTO | null> {
  const { flatCommandMenuItemMaps } =
    await workspaceManyOrAllFlatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatCommandMenuItemMaps'],
    });

  const flatCommandMenuItem = Object.values(
    flatCommandMenuItemMaps.byUniversalIdentifier,
  ).find(
    (item) => isDefined(item) && item.workflowVersionId === workflowVersionId,
  );

  if (!isDefined(flatCommandMenuItem)) {
    return null;
  }

  return fromFlatCommandMenuItemToCommandMenuItemDto(flatCommandMenuItem);
}

export const commandMenuItemService = {
  findAll,
  findById,
  findByIdOrThrow,
  create,
  update,
  delete: deleteItem,
  findAllFlatCommandMenuItems,
  findByWorkflowVersionId,
};
