import { CustomException } from '@/lib/sabcrm/server/src/utils/custom-exception';

export enum AiExceptionCode {
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_ALREADY_EXISTS = 'AGENT_ALREADY_EXISTS',
  AGENT_IS_STANDARD = 'AGENT_IS_STANDARD',
  AGENT_EXECUTION_FAILED = 'AGENT_EXECUTION_FAILED',
  INVALID_AGENT_INPUT = 'INVALID_AGENT_INPUT',
  THREAD_NOT_FOUND = 'THREAD_NOT_FOUND',
  INVALID_CHAT_THREAD_TITLE = 'INVALID_CHAT_THREAD_TITLE',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  API_KEY_NOT_CONFIGURED = 'API_KEY_NOT_CONFIGURED',
  USER_WORKSPACE_ID_NOT_FOUND = 'USER_WORKSPACE_ID_NOT_FOUND',
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  ROLE_CANNOT_BE_ASSIGNED_TO_AGENTS = 'ROLE_CANNOT_BE_ASSIGNED_TO_AGENTS',
}

const getAiExceptionUserFriendlyMessage = (code: AiExceptionCode): string => {
  switch (code) {
    case AiExceptionCode.AGENT_NOT_FOUND:
      return 'Agent not found.';
    case AiExceptionCode.AGENT_ALREADY_EXISTS:
      return 'An agent with this name already exists.';
    case AiExceptionCode.AGENT_IS_STANDARD:
      return 'Standard agents cannot be modified.';
    case AiExceptionCode.AGENT_EXECUTION_FAILED:
      return 'Agent execution failed.';
    case AiExceptionCode.INVALID_AGENT_INPUT:
      return 'Invalid agent input.';
    case AiExceptionCode.THREAD_NOT_FOUND:
      return 'Chat thread not found.';
    case AiExceptionCode.INVALID_CHAT_THREAD_TITLE:
      return 'Chat thread title cannot be empty.';
    case AiExceptionCode.MESSAGE_NOT_FOUND:
      return 'Chat message not found.';
    case AiExceptionCode.API_KEY_NOT_CONFIGURED:
      return 'API key is not configured.';
    case AiExceptionCode.USER_WORKSPACE_ID_NOT_FOUND:
      return 'User workspace not found.';
    case AiExceptionCode.ROLE_NOT_FOUND:
      return 'Role not found.';
    case AiExceptionCode.ROLE_CANNOT_BE_ASSIGNED_TO_AGENTS:
      return 'This role cannot be assigned to agents.';
    default:
      return 'An unknown error occurred.';
  }
};

export class AiException extends CustomException<AiExceptionCode> {
  constructor(
    message: string,
    code: AiExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message, code, {
      userFriendlyMessage: userFriendlyMessage ?? getAiExceptionUserFriendlyMessage(code),
    });
  }
}
