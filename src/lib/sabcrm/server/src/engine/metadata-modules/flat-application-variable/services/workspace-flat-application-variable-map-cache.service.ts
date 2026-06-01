import "server-only";

import { connectToDatabase } from '@/lib/mongodb';

import { type FlatApplicationVariableMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/types/flat-application-variable-maps.type';
import { fromApplicationVariableEntityToFlatApplicationVariable } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/utils/from-application-variable-entity-to-flat-application-variable.util';
import { createEmptyFlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { createIdToUniversalIdentifierMap } from 'src/lib/sabcrm/server/src/engine/workspace-cache/utils/create-id-to-universal-identifier-map.util';
import { addFlatEntityToFlatEntityMapsThroughMutationOrThrow } from 'src/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/utils/add-flat-entity-to-flat-entity-maps-through-mutation-or-throw.util';

/**
 * Computes the flat application-variable maps for a given workspace.
 * Replaces WorkspaceFlatApplicationVariableMapCacheService.computeForCache()
 * (NestJS @Injectable dropped — plain exported async function).
 */
export const computeFlatApplicationVariableMapsForWorkspace = async (
  workspaceId: string,
): Promise<FlatApplicationVariableMaps> => {
  const { db } = await connectToDatabase();

  const [applicationVariables, applications] = await Promise.all([
    db
      .collection('sabcrm_application_variable')
      .find({ workspaceId })
      .toArray(),
    db
      .collection('sabcrm_application')
      .find({ workspaceId }, { projection: { id: 1, universalIdentifier: 1 } })
      .toArray(),
  ]);

  const applicationIdToUniversalIdentifierMap =
    createIdToUniversalIdentifierMap(
      applications as Array<{ id: string; universalIdentifier: string }>,
    );

  const flatApplicationVariableMaps = createEmptyFlatEntityMaps();

  for (const applicationVariableEntity of applicationVariables) {
    const flatApplicationVariable =
      fromApplicationVariableEntityToFlatApplicationVariable({
        entity: applicationVariableEntity as Parameters<
          typeof fromApplicationVariableEntityToFlatApplicationVariable
        >[0]['entity'],
        applicationIdToUniversalIdentifierMap,
      });

    addFlatEntityToFlatEntityMapsThroughMutationOrThrow({
      flatEntity: flatApplicationVariable,
      flatEntityMapsToMutate: flatApplicationVariableMaps,
    });
  }

  return flatApplicationVariableMaps;
};
