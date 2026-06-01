import "server-only";

import { type ObjectRecord } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { WorkspaceAuthContext } from "@/lib/sabcrm/server/src/engine/core-modules/auth/types/workspace-auth-context.type";
import { CommonBaseQueryRunnerService } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-base-query-runner.service";
import { CommonDeleteManyQueryRunnerService } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-delete-many-query-runner.service";
import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception";
import { CommonBaseQueryRunnerContext } from "@/lib/sabcrm/server/src/engine/api/common/types/common-base-query-runner-context.type";
import { CommonExtendedQueryRunnerContext } from "@/lib/sabcrm/server/src/engine/api/common/types/common-extended-query-runner-context.type";
import {
  CommonExtendedInput,
  CommonInput,
  CommonQueryNames,
  DeleteOneQueryArgs,
} from "@/lib/sabcrm/server/src/engine/api/common/types/common-query-args.type";
import { assertIsValidUuid } from "@/lib/sabcrm/server/src/engine/api/graphql/workspace-query-runner/utils/assert-is-valid-uuid.util";
import { FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";
import { assertMutationNotOnRemoteObject } from "@/lib/sabcrm/server/src/engine/metadata-modules/object-metadata/utils/assert-mutation-not-on-remote-object.util";

// PORT-NOTE: NestJS @Injectable() removed. Pass dependencies explicitly.
export class CommonDeleteOneQueryRunnerService extends CommonBaseQueryRunnerService<
  DeleteOneQueryArgs,
  ObjectRecord
> {
  constructor(
    private readonly commonDeleteManyQueryRunnerService: CommonDeleteManyQueryRunnerService,
  ) {
    super();
  }

  protected readonly operationName = CommonQueryNames.DELETE_ONE;

  async run(
    args: CommonExtendedInput<DeleteOneQueryArgs>,
    queryRunnerContext: CommonExtendedQueryRunnerContext,
  ): Promise<ObjectRecord> {
    const result = await this.commonDeleteManyQueryRunnerService.run(
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
    args: CommonInput<DeleteOneQueryArgs>,
    _queryRunnerContext: CommonBaseQueryRunnerContext,
  ): Promise<CommonInput<DeleteOneQueryArgs>> {
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
    args: CommonInput<DeleteOneQueryArgs>,
    queryRunnerContext: CommonBaseQueryRunnerContext,
  ): Promise<void> {
    const { flatObjectMetadata } = queryRunnerContext;

    assertMutationNotOnRemoteObject(flatObjectMetadata);
    assertIsValidUuid(args.id);
  }
}
