import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils';

import { CustomException } from '@/lib/sabcrm/server/src/utils/custom-exception';

export enum CommandMenuItemExceptionCode {
  COMMAND_MENU_ITEM_NOT_FOUND = 'COMMAND_MENU_ITEM_NOT_FOUND',
  INVALID_COMMAND_MENU_ITEM_INPUT = 'INVALID_COMMAND_MENU_ITEM_INPUT',
  WORKFLOW_OR_FRONT_COMPONENT_REQUIRED = 'WORKFLOW_OR_FRONT_COMPONENT_REQUIRED',
}

// PORT-NOTE: @lingui/core msg` ` template tags replaced with plain strings.
// The userFriendlyMessage is kept as a plain string for Next.js compatibility.
const getCommandMenuItemExceptionUserFriendlyMessage = (
  code: CommandMenuItemExceptionCode,
): string => {
  switch (code) {
    case CommandMenuItemExceptionCode.COMMAND_MENU_ITEM_NOT_FOUND:
      return 'Command menu item not found.';
    case CommandMenuItemExceptionCode.INVALID_COMMAND_MENU_ITEM_INPUT:
      return 'Invalid command menu item input.';
    case CommandMenuItemExceptionCode.WORKFLOW_OR_FRONT_COMPONENT_REQUIRED:
      return 'Either workflow version or front component is required.';
    default:
      assertUnreachable(code);
  }
};

export class CommandMenuItemException extends CustomException<CommandMenuItemExceptionCode> {
  constructor(
    message: string,
    code: CommandMenuItemExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message, code, {
      userFriendlyMessage:
        userFriendlyMessage ??
        getCommandMenuItemExceptionUserFriendlyMessage(code),
    });
  }
}
