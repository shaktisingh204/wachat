import { isDefined } from 'src/lib/sabcrm/shared/src/utils/is-defined.util';

import {
  CommandMenuItemException,
  CommandMenuItemExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/command-menu-item.exception';
import { type UpdateCommandMenuItemInput } from 'src/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/update-command-menu-item.input';
import { type AllFlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { resolveEntityRelationUniversalIdentifiers } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/resolve-entity-relation-universal-identifiers.util';
import { FLAT_COMMAND_MENU_ITEM_EDITABLE_PROPERTIES } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/constants/flat-command-menu-item-editable-properties.constant';
import { type FlatCommandMenuItemMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item-maps.type';
import { type FlatCommandMenuItem } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
import { mergeUpdateInExistingRecord } from 'src/lib/sabcrm/server/src/utils/merge-update-in-existing-record.util';

export const fromUpdateCommandMenuItemInputToFlatCommandMenuItemToUpdateOrThrow =
  ({
    flatCommandMenuItemMaps,
    updateCommandMenuItemInput,
    flatObjectMetadataMaps,
    flatPageLayoutMaps,
  }: {
    flatCommandMenuItemMaps: FlatCommandMenuItemMaps;
    updateCommandMenuItemInput: UpdateCommandMenuItemInput;
  } & Pick<
    AllFlatEntityMaps,
    'flatObjectMetadataMaps' | 'flatPageLayoutMaps'
  >): FlatCommandMenuItem => {
    const existingFlatCommandMenuItem = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: updateCommandMenuItemInput.id,
      flatEntityMaps: flatCommandMenuItemMaps,
    });

    if (!isDefined(existingFlatCommandMenuItem)) {
      throw new CommandMenuItemException(
        'Command menu item not found',
        CommandMenuItemExceptionCode.COMMAND_MENU_ITEM_NOT_FOUND,
      );
    }

    const { id: _id, ...updates } = updateCommandMenuItemInput;

    const flatCommandMenuItemToUpdate = {
      ...mergeUpdateInExistingRecord({
        existing: existingFlatCommandMenuItem,
        properties: [...FLAT_COMMAND_MENU_ITEM_EDITABLE_PROPERTIES],
        update: updates,
      }),
      updatedAt: new Date().toISOString(),
    };

    if (updates.availabilityObjectMetadataId !== undefined) {
      const { availabilityObjectMetadataUniversalIdentifier } =
        resolveEntityRelationUniversalIdentifiers({
          metadataName: 'commandMenuItem',
          foreignKeyValues: {
            availabilityObjectMetadataId:
              flatCommandMenuItemToUpdate.availabilityObjectMetadataId,
          },
          flatEntityMaps: { flatObjectMetadataMaps },
        });

      flatCommandMenuItemToUpdate.availabilityObjectMetadataUniversalIdentifier =
        availabilityObjectMetadataUniversalIdentifier;
    }

    if (updates.pageLayoutId !== undefined) {
      const { pageLayoutUniversalIdentifier } =
        resolveEntityRelationUniversalIdentifiers({
          metadataName: 'commandMenuItem',
          foreignKeyValues: {
            pageLayoutId: flatCommandMenuItemToUpdate.pageLayoutId,
          },
          flatEntityMaps: { flatPageLayoutMaps },
        });

      flatCommandMenuItemToUpdate.pageLayoutUniversalIdentifier =
        pageLayoutUniversalIdentifier;
    }

    return flatCommandMenuItemToUpdate;
  };
