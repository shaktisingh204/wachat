import "server-only";

import { type ObjectRecord } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { WorkspaceAuthContext } from "@/lib/sabcrm/server/src/engine/core-modules/auth/types/workspace-auth-context.type";
import { CommonBaseQueryRunnerService } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-base-query-runner.service";
import { CommonDestroyManyQueryRunnerService } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-destroy-many-query-runner.service";
import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception";
import { STANDARD_ERROR_MESSAGE } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/standard-error-message.constant";
import { CommonBaseQueryRunnerContext } from "@/lib/sabcrm/server/src/engine/api/common/types/common-base-query-runner-context.type";
import { CommonExtendedQueryRunnerContext } from "@/lib/sabcrm/server/src/engine/api/common/types/common-extended-query-runner-context.type";
import {
  CommonExtendedInput,
  CommonInput,
  CommonQueryNames,
  DestroyOneQueryArgs,
} from "@/lib/sabcrm/server/src/engine/api/common/types/common-query-args.type";
import { FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";

// PORT-NOTE: NestJS @Injectable() removed. Pass dependencies explicitly.
export class CommonDestroyOneQueryRunnerService extends CommonBaseQueryRunnerService<
  DestroyOneQueryArgs,
  ObjectRecord
> {
  constructor(
    private readonly commonDestroyManyQueryRunnerService: CommonDestroyManyQueryRunnerService,
  ) {
    super();
  }

  protected readonly operationName = CommonQueryNames.DESTROY_ONE;

  async run(
    args: CommonExtendedInput<DestroyOneQueryArgs>,
    queryRunnerContext: CommonExtendedQueryRunnerContext,
  ): Promise<ObjectRecord> {
    const result = await this.commonDestroyManyQueryRunnerService.run(
      {
        ...args,
        filter: { id: { eq: args.id } },
      },
      queryRunnerContext,
    );

    if (!isDefined(result) || result.length === 0) {
      throw new CommonQueryRunnerException(
        "Record not found",
        CommonQueryRunnerExceptionCode.RECORD_NOT_FOUND,
        {
          userFriendlyMessage: "This record does not exist or has been deleted.",
        },
      );
    }

    return result[0];
  }

  async computeArgs(
    args: CommonInput<DestroyOneQueryArgs>,
    _queryRunnerContext: CommonBaseQueryRunnerContext,
  ): Promise<CommonInput<DestroyOneQueryArgs>> {
    return args;
  }

  async processQueryResult(
    queryResult: ObjectRecord,
    flatObjectMetadata: FlatObjectMetadata,
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
    authContext: WorkspaceAuthContext,
  ): Promise<ObjectRecord> {
    return this.commonResultGettersService.processRecord(
      queryResult,
      flatObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      authContext.workspace.id,
    );
  }

  async validate(
    args: CommonInput<DestroyOneQueryArgs>,
    _queryRunnerContext: CommonBaseQueryRunnerContext,
  ): Promise<void> {
    if (!isDefined(args.id)) {
      throw new CommonQueryRunnerException(
        "Missing id",
        CommonQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
      );
    }
  }
}
