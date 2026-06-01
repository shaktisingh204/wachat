import "server-only";

import { RecordInputTransformerService } from "@/lib/sabcrm/server/src/engine/core-modules/record-transformer/services/record-input-transformer.service";
import { FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { findFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util";
import { FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";

// PORT-NOTE: NestJS @Injectable() / DI removed. Pass recordInputTransformerService explicitly.
export class QueryRunnerArgsFactory {
  constructor(
    private readonly recordInputTransformerService: RecordInputTransformerService,
  ) {}

  async overrideValueByFieldMetadata(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    fieldIdByName: Record<string, string>,
    flatObjectMetadata: FlatObjectMetadata,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
  ) {
    const fieldMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: fieldIdByName[key],
      flatEntityMaps: flatFieldMetadataMaps,
    });

    if (!fieldMetadata) {
      return value;
    }

    const processed = await this.recordInputTransformerService.process({
      recordInput: { [key]: value },
      flatObjectMetadata,
      flatFieldMetadataMaps,
    });

    return processed[key] ?? value;
  }
}
