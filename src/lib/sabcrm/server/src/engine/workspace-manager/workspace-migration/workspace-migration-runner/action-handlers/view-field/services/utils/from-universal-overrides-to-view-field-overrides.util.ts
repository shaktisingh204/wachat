// PORT-NOTE: This file is kind=pg-migration->mongo-index/seed.
// The util is pure TypeScript logic (no DDL), ported faithfully.
// No Mongo index or seed is needed — this transforms in-memory types.

import type { FormatRecordSerializedRelationProperties } from "@/lib/sabcrm/shared/types/format-record-serialized-relation-properties.type";
import { isDefined } from "@/lib/sabcrm/shared/utils/is-defined.util";

import { findFlatEntityByUniversalIdentifier } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util";
import type { FlatViewFieldGroupMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-view-field-group/types/flat-view-field-group-maps.type";
import type { FlatViewFieldGroup } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-view-field-group/types/flat-view-field-group.type";
import type { ViewFieldOverrides } from "@/lib/sabcrm/server/src/engine/metadata-modules/view-field/entities/view-field.entity";

type UniversalViewFieldOverrides =
  FormatRecordSerializedRelationProperties<ViewFieldOverrides>;

export const fromUniversalOverridesToViewFieldOverrides = ({
  universalOverrides,
  flatViewFieldGroupMaps,
}: {
  universalOverrides: UniversalViewFieldOverrides;
  flatViewFieldGroupMaps: FlatViewFieldGroupMaps;
}): ViewFieldOverrides => {
  const { viewFieldGroupUniversalIdentifier, ...scalarOverrides } =
    universalOverrides;

  if (!isDefined(viewFieldGroupUniversalIdentifier)) {
    return {
      ...scalarOverrides,
      ...(viewFieldGroupUniversalIdentifier === null
        ? { viewFieldGroupId: null }
        : {}),
    };
  }

  const flatViewFieldGroup =
    findFlatEntityByUniversalIdentifier<FlatViewFieldGroup>({
      flatEntityMaps: flatViewFieldGroupMaps,
      universalIdentifier: viewFieldGroupUniversalIdentifier,
    });

  return {
    ...scalarOverrides,
    viewFieldGroupId: flatViewFieldGroup?.id ?? null,
  };
};
