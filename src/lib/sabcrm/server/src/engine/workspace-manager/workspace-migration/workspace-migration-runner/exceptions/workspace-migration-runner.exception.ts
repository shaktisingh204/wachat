// PORT-NOTE: Ported from NestJS/Lingui exception. Replaced msg`` template literals
// with plain strings. CustomError replaced with plain Error subclass.
// AllUniversalWorkspaceMigrationAction imported from ported target path.

import { type AllUniversalWorkspaceMigrationAction } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/types/workspace-migration-action-common';

export const WorkspaceMigrationRunnerExceptionCode = {
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  APPLICATION_NOT_FOUND: 'APPLICATION_NOT_FOUND',
  DDL_LOCKED: 'DDL_LOCKED',
} as const;

const getWorkspaceMigrationRunnerExceptionUserFriendlyMessage = (
  code: keyof typeof WorkspaceMigrationRunnerExceptionCode,
): string => {
  switch (code) {
    case WorkspaceMigrationRunnerExceptionCode.INTERNAL_SERVER_ERROR:
      return 'An unexpected error occurred.';
    case WorkspaceMigrationRunnerExceptionCode.EXECUTION_FAILED:
      return 'Migration execution failed.';
    case WorkspaceMigrationRunnerExceptionCode.APPLICATION_NOT_FOUND:
      return 'Application not found.';
    case WorkspaceMigrationRunnerExceptionCode.DDL_LOCKED:
      return 'Workspace schema changes are temporarily locked.';
    default: {
      const _exhaustive: never = code;
      return 'An unexpected error occurred.';
    }
  }
};

export type WorkspaceMigrationRunnerExecutionErrors = {
  metadata?: Error;
  workspaceSchema?: Error;
  actionTranspilation?: Error;
};

const {
  EXECUTION_FAILED: WorkspaceMigrationRunnerExceptionExecutionFailedCode,
  ...WorkspaceMigrationRunnerExceptionCodeOtherCode
} = WorkspaceMigrationRunnerExceptionCode;

type WorkspaceMigrationRunnerExceptionConstructorArgs =
  | {
      message: string;
      code: (typeof WorkspaceMigrationRunnerExceptionCodeOtherCode)[keyof typeof WorkspaceMigrationRunnerExceptionCodeOtherCode];
      userFriendlyMessage?: string;
    }
  | {
      action: AllUniversalWorkspaceMigrationAction;
      errors: WorkspaceMigrationRunnerExecutionErrors;
      code: typeof WorkspaceMigrationRunnerExceptionExecutionFailedCode;
      userFriendlyMessage?: string;
    };

export class WorkspaceMigrationRunnerException extends Error {
  code: keyof typeof WorkspaceMigrationRunnerExceptionCode;
  userFriendlyMessage: string;
  action?: AllUniversalWorkspaceMigrationAction;
  errors?: WorkspaceMigrationRunnerExecutionErrors;

  constructor(args: WorkspaceMigrationRunnerExceptionConstructorArgs) {
    if (args.code === WorkspaceMigrationRunnerExceptionCode.EXECUTION_FAILED) {
      super(
        `Migration action '${args.action.type}' for '${args.action.metadataName}' failed`,
      );
      this.name = 'WorkspaceMigrationRunnerException';
      this.code = args.code;
      this.action = args.action;
      this.errors = args.errors;
    } else {
      super(args.message);
      this.name = 'WorkspaceMigrationRunnerException';
      this.code = args.code;
    }

    this.userFriendlyMessage =
      args.userFriendlyMessage ??
      getWorkspaceMigrationRunnerExceptionUserFriendlyMessage(args.code);
  }
}
