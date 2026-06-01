import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils';

import {
  NotFoundError,
  UserInputError,
} from '@/lib/sabcrm/server/src/engine/core-modules/graphql/utils/graphql-errors.util';
import {
  CommandMenuItemException,
  CommandMenuItemExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/command-menu-item.exception';

export const commandMenuItemGraphqlApiExceptionHandler = (error: Error): never => {
  if (error instanceof CommandMenuItemException) {
    switch (error.code) {
      case CommandMenuItemExceptionCode.COMMAND_MENU_ITEM_NOT_FOUND:
        throw new NotFoundError(error);
      case CommandMenuItemExceptionCode.INVALID_COMMAND_MENU_ITEM_INPUT:
      case CommandMenuItemExceptionCode.WORKFLOW_OR_FRONT_COMPONENT_REQUIRED:
        throw new UserInputError(error);
      default: {
        return assertUnreachable(error.code);
      }
    }
  }

  throw error;
};
