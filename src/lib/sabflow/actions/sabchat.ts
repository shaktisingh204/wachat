
'use server';

import { 
    postChatMessage, 
    closeChatSession, 
    addTagToSession,
    getOrCreateChatSession,
    getFullChatSession,
    getChatHistory
} from '@/app/actions/sabchat.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';

export async function executeSabChatAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const { db } = await connectToDatabase();

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
            case 'getOrCreateSession': {
                 if (!inputs.email) {
                    throw new Error('Email is required to get or create a session.');
                }
                const result = await getOrCreateChatSession(user._id.toString(), inputs.email);
                if (result.error || !result.session) throw new Error(result.error || 'Failed to get/create session.');
                return { output: { sessionId: result.sessionId, session: result.session } };
            }
            case 'getSessionDetails': {
                 if (!inputs.sessionId) {
                    throw new Error('Session ID is required.');
                }
                const session = await getFullChatSession(inputs.sessionId);
                if (!session) throw new Error('Session not found.');
                return { output: { session } };
            }
            case 'updateVisitorInfo': {
                if (!inputs.sessionId) throw new Error('Session ID is required.');
                const { sessionId, ...visitorInfo } = inputs;
                const update: any = {};
                if(visitorInfo.name) update['visitorInfo.name'] = visitorInfo.name;
                if(visitorInfo.email) update['visitorInfo.email'] = visitorInfo.email;
                if(visitorInfo.phone) update['visitorInfo.phone'] = visitorInfo.phone;
                
                const result = await db.collection('sabchat_sessions').updateOne(
                    { _id: new ObjectId(sessionId), userId: user._id },
                    { $set: update }
                );
                if (result.modifiedCount === 0) throw new Error('Session not found or no info to update.');
                return { output: { success: true } };
            }
            case 'assignAgent': {
                if (!inputs.sessionId || !inputs.agentId) throw new Error('Session ID and Agent ID are required.');
                const result = await db.collection('sabchat_sessions').updateOne(
                    { _id: new ObjectId(inputs.sessionId), userId: user._id },
                    { $set: { assignedAgentId: new ObjectId(inputs.agentId) } }
                );
                 if (result.modifiedCount === 0) throw new Error('Session not found.');
                return { output: { success: true } };
            }
            case 'getChatHistory': {
                if (!inputs.sessionId) throw new Error('Session ID is required.');
                const history = await getChatHistory(inputs.sessionId);
                return { output: { history } };
            }
            default:
                throw new Error(`sabChat action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}

export const sabChatActions = [
    { name: 'sendMessage', label: 'Send Message', description: 'Sends a message to an active chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'content', label: 'Message Content', type: 'textarea', required: true }
    ]},
    { name: 'closeSession', label: 'Close Session', description: 'Closes an active chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
    ]},
    { name: 'addTagToSession', label: 'Add Tag to Session', description: 'Adds a tag to a chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'tagName', label: 'Tag Name', type: 'text', required: true },
    ]},
    { name: 'getOrCreateSession', label: 'Get or Create Session', description: 'Finds an existing session by email or creates a new one.', inputs: [
        { name: 'email', label: 'Visitor Email', type: 'email', required: true },
    ]},
    { name: 'getSessionDetails', label: 'Get Session Details', description: 'Retrieves all information for a specific chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
    ]},
    { name: 'updateVisitorInfo', label: 'Update Visitor Info', description: 'Updates the name, email, or phone for a visitor.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', type: 'tel' },
    ]},
    { name: 'assignAgent', label: 'Assign Agent', description: 'Assigns a team member to a chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'agentId', label: 'Agent', type: 'agent-selector', required: true },
    ]},
    { name: 'getChatHistory', label: 'Get Chat History', description: 'Retrieves the message history for a session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
    ]}
];
