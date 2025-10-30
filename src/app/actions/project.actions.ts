
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from './user.actions';
import type { Project, Contact, AutoReplySettings, UserAttribute, CannedMessage, Agent, Invitation } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';


export async function getProjects(query?: string, type?: 'whatsapp' | 'facebook'): Promise<{ projects: WithId<Project>[], groups: any[] }> {
    const session = await getSession();
    if (!session?.user) {
        return { projects: [], groups: [] };
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = { userId: new ObjectId(session.user._id) };
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }
        if (type === 'whatsapp') {
            filter.wabaId = { $exists: true, $ne: null };
        } else if (type === 'facebook') {
            filter.facebookPageId = { $exists: true, $ne: null };
            filter.wabaId = { $exists: false };
        }
        
        const projects = await db.collection<Project>('projects')
            .find(filter)
            .sort({ createdAt: -1 })
            .toArray();
        
        // This is a placeholder for a future grouping feature
        const groups: any[] = []; 
        
        return { projects: JSON.parse(JSON.stringify(projects)), groups };

    } catch (error: any) {
        console.error("Failed to fetch projects:", error);
        return { projects: [], groups: [] };
    }
}

export async function getProjectById(projectId: string): Promise<WithId<Project> | null> {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  try {
    if (!ObjectId.isValid(projectId)) {
        return null;
    }
    const { db } = await connectToDatabase();
    const project = await db.collection('projects').findOne({ 
      _id: new ObjectId(projectId),
      $or: [
        { userId: new ObjectId(session.user._id) },
        { 'agents.userId': new ObjectId(session.user._id) }
      ]
    });
    
    if (!project) return null;

    // Aggregate plan details
    const plan = await db.collection('plans').findOne({ _id: project.planId });
    project.plan = plan ? JSON.parse(JSON.stringify(plan)) : null;

    return project ? JSON.parse(JSON.stringify(project)) : null;
  } catch (error: any) {
    return null;
  }
}

export async function handleDeleteUserProject(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const session = await getSession();

    if (!session?.user) {
        return { error: 'You must be logged in to delete a project.' };
    }

    try {
        if (!ObjectId.isValid(projectId)) {
            return { error: 'Invalid Project ID.' };
        }
        const { db } = await connectToDatabase();
        
        const projectToDelete = await db.collection('projects').findOne({ 
            _id: new ObjectId(projectId), 
            userId: new ObjectId(session.user._id)
        });

        if (!projectToDelete) {
            return { error: "Project not found or you don't have permission to delete it." };
        }
        
        await db.collection('projects').deleteOne({ _id: new ObjectId(projectId) });

        // Add cascade deletes for other collections if necessary
        // e.g., await db.collection('templates').deleteMany({ projectId: new ObjectId(projectId) });

        revalidatePath('/dashboard');
        
        return { message: 'Project deleted successfully.' };

    } catch (e: any) {
        console.error("Failed to delete project:", e);
        return { error: 'An unexpected error occurred while deleting the project.' };
    }
}

export async function handleUpdateMasterSwitch(projectId: string, isEnabled: boolean) {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { "autoReplySettings.masterEnabled": isEnabled } }
        );
        revalidatePath('/dashboard/settings');
        return { message: `All auto-replies have been ${isEnabled ? 'enabled' : 'disabled'}.` };
    } catch (e: any) {
        return { error: 'Failed to update master switch.' };
    }
}

export async function handleUpdateOptInOutSettings(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Missing project ID.' };
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    const settings: OptInOutSettings = {
        enabled: formData.get('enabled') === 'on',
        optInKeywords: (formData.get('optInKeywords') as string || '').split(',').map(k => k.trim()).filter(Boolean),
        optOutKeywords: (formData.get('optOutKeywords') as string || '').split(',').map(k => k.trim()).filter(Boolean),
        optInResponse: formData.get('optInResponse') as string,
        optOutResponse: formData.get('optOutResponse') as string,
    };

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { optInOutSettings: settings } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'Opt-in/out settings saved successfully.' };
    } catch (e: any) {
        return { error: 'Failed to save settings.' };
    }
}

export async function handleSaveUserAttributes(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const projectId = formData.get('projectId') as string;
    const attributesJSON = formData.get('attributes') as string;
    
    if (!projectId) return { error: 'Project ID is missing.' };
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };
    
    try {
        const attributes: UserAttribute[] = JSON.parse(attributesJSON);
        
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { userAttributes: attributes } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'User attributes saved successfully.' };
    } catch (e: any) {
        console.error("Failed to save user attributes:", e);
        return { error: 'An error occurred while saving.' };
    }
}

export async function saveCannedMessageAction(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    
    const messageId = formData.get('_id') as string | null;
    const projectId = formData.get('projectId') as string;
    
    if (!projectId) return { error: 'Project ID is missing.' };

    const cannedMessageData = {
        projectId: new ObjectId(projectId),
        name: formData.get('name') as string,
        type: formData.get('type') as CannedMessage['type'],
        content: {
            text: formData.get('text') as string,
            mediaUrl: formData.get('mediaUrl') as string,
            caption: formData.get('caption') as string,
            fileName: formData.get('fileName') as string,
        },
        isFavourite: formData.get('isFavourite') === 'on',
        createdBy: session.user.name,
    };

    try {
        const { db } = await connectToDatabase();
        if (messageId && ObjectId.isValid(messageId)) {
            await db.collection('canned_messages').updateOne({ _id: new ObjectId(messageId) }, { $set: cannedMessageData });
        } else {
            await db.collection('canned_messages').insertOne({ ...cannedMessageData, createdAt: new Date() } as any);
        }
        revalidatePath('/dashboard/settings');
        return { message: 'Canned message saved successfully.' };
    } catch (e: any) {
        return { error: 'Failed to save canned message.' };
    }
}

export async function deleteCannedMessage(id: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('canned_messages').deleteOne({ _id: new ObjectId(id) });
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to delete message.' };
    }
}

export async function getCannedMessages(projectId: string): Promise<WithId<CannedMessage>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        return JSON.parse(JSON.stringify(await db.collection('canned_messages').find({ projectId: new ObjectId(projectId) }).sort({ isFavourite: -1, name: 1 }).toArray()));
    } catch (e) {
        return [];
    }
}

export async function handleInviteAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!projectId || !email || !role) return { error: 'Missing required fields.' };
    if (!ObjectId.isValid(projectId)) return { error: 'Invalid project ID.' };

    try {
        const { db } = await connectToDatabase();
        const project = await getProjectById(projectId);

        if (!project || project.userId.toString() !== session.user._id.toString()) {
            return { error: 'Project not found or you are not the owner.' };
        }
        
        if (!project.plan) return { error: 'Could not determine your plan limits.' };
        const plan = project.plan;

        const currentAgentCount = project.agents?.length || 0;
        const agentLimit = plan.agentLimit || 0;
        if (agentLimit > 0 && currentAgentCount >= agentLimit) {
            return { error: `You have reached your agent limit of ${agentLimit}. Please upgrade your plan.` };
        }

        const invitee = await db.collection('users').findOne({ email });
        if (!invitee) {
            return { error: `No user found with the email "${email}". Please ask them to sign up first.` };
        }

        if (invitee._id.toString() === session.user._id.toString()) {
            return { error: "You cannot invite yourself." };
        }

        if (project.agents?.some(agent => agent.userId.toString() === invitee._id.toString())) {
            return { error: "This user is already an agent on this project." };
        }

        const newAgent: Agent = {
            userId: invitee._id,
            email: invitee.email,
            name: invitee.name,
            role: role as 'admin' | 'agent'
        };

        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $addToSet: { agents: newAgent } }
        );
        
        revalidatePath('/dashboard/settings');
        return { message: `${invitee.name} has been added to the project.` };

    } catch (e: any) {
        console.error("Agent invitation failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}

export async function handleRemoveAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const agentUserId = formData.get('agentUserId') as string;

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!projectId || !agentUserId) return { error: 'Missing required fields.' };
    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(agentUserId)) return { error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
        if (!project || project.userId.toString() !== session.user._id.toString()) {
            return { error: 'Project not found or you are not the owner.' };
        }

        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $pull: { agents: { userId: new ObjectId(agentUserId) } } }
        );
        
        revalidatePath('/dashboard/settings');
        return { message: 'Agent removed successfully.' };

    } catch (e: any) {
        console.error("Agent removal failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}


export async function handleUpdateAutoReplySettings(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const replyType = formData.get('replyType') as keyof Project['autoReplySettings'];
    if (!projectId || !replyType) return { error: 'Missing required data.' };

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    let updatePayload: any = { enabled: formData.get('enabled') === 'on' };

    if (replyType === 'welcomeMessage') {
        updatePayload.message = formData.get('message') as string;
    }
    if (replyType === 'general') {
        const repliesJSON = formData.get('replies') as string;
        try {
            updatePayload.replies = repliesJSON ? JSON.parse(repliesJSON) : [];
            delete updatePayload.message; 
            delete updatePayload.context; 
        } catch (e) {
            return { error: 'Invalid format for replies data.' };
        }
    }
    if (replyType === 'inactiveHours') {
        updatePayload = {
            ...updatePayload,
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            timezone: formData.get('timezone'),
            days: [0, 1, 2, 3, 4, 5, 6].filter(day => formData.get(`day_${day}`) === 'on')
        }
    }
    if (replyType === 'aiAssistant') {
        updatePayload.context = formData.get('context');
        updatePayload.autoTranslate = formData.get('autoTranslate') === 'on';
        delete updatePayload.message;
    }
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { [`autoReplySettings.${replyType}`]: updatePayload } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'Auto-reply settings updated successfully!' };
    } catch (e: any) {
        return { error: e.message || 'Failed to save settings.' };
    }
}
