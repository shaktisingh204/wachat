

'use server';

import { postChatMessage, closeChatSession, addTagToSession } from '@/app/actions/sabchat.actions';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';

export async function executeSabChatAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        switch (actionName) {
            case 'sendMessage': {
                if (!inputs.sessionId || !inputs.content) {
                    throw new Error('Session ID and content are required to send a message.');
                }
                const result = await postChatMessage(inputs.sessionId, 'agent', inputs.content);
                if (!result.success) throw new Error(result.error);
                return { output: result };
            }
            case 'closeSession': {
                if (!inputs.sessionId) {
                    throw new Error('Session ID is required to close a session.');
                }
                const result = await closeChatSession(inputs.sessionId);
                 if (!result.success) throw new Error(result.error);
                return { output: result };
            }
            case 'addTagToSession': {
                 if (!inputs.sessionId || !inputs.tagName) {
                    throw new Error('Session ID and Tag Name are required.');
                }
                const result = await addTagToSession(inputs.sessionId, inputs.tagName);
                if (!result.success) throw new Error(result.error);
                return { output: result };
            }
            default:
                throw new Error(`sabChat action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}

    