
'use server';

import { getSession } from './user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId, Filter } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { Project, Contact, KanbanColumnData } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getProjectById(projectId?: string | null): Promise<WithId<Project> | null> {
    const session = await getSession();
    if (!session?.user || !projectId || !ObjectId.isValid(projectId)) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        
        const project = await db.collection('projects').aggregate([
            { $match: { _id: new ObjectId(projectId) } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            {
                $unwind: {
                    path: '$planInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    plan: '$planInfo'
                }
            },
            { $project: { planInfo: 0 } }
        ]).next();

        if (!project) return null;
        
        const isOwner = project.userId.toString() === session.user._id.toString();
        const isAgent = project.agents?.some((agent: any) => agent.userId.toString() === session.user._id.toString());
        
        if (!isOwner && !isAgent) {
            return null;
        }
        
        return JSON.parse(JSON.stringify(project));
    } catch (error) {
        console.error("Failed to fetch project:", error);
        return null;
    }
}


export async function handleUpdateProjectSettings(
  prevState: any,
  formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const messagesPerSecond = formData.get('messagesPerSecond') as string;

    if (!projectId) {
        return { error: 'Missing project ID.' };
    }
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Project not found or you do not have access.' };

    const mps = parseInt(messagesPerSecond, 10);
    if (isNaN(mps) || mps < 1) {
        return { error: 'Messages per second must be a number and at least 1.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { messagesPerSecond: mps } }
        );
        
        if (result.matchedCount === 0) {
            return { error: 'Project not found.' };
        }
        
        revalidatePath('/dashboard/settings');

        return { message: 'Settings updated successfully!' };

    } catch (e: any) {
        console.error('Project settings update failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred while saving the settings.' };
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
        return { error: e.message || 'Failed to update master switch.' };
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

export async function handleBulkUpdateAppId(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const projectIdsString = formData.get('projectIds') as string;
    const newAppId = formData.get('appId') as string;

    if (!projectIdsString || !newAppId) {
        return { success: false, error: 'Project IDs and a new App ID are required.' };
    }
    
    const projectIds = projectIdsString.split(',');
    
    try {
        const { db } = await connectToDatabase();
        const objectIds = projectIds.map(id => new ObjectId(id));
        
        const ownedProjectsCount = await db.collection('projects').countDocuments({
            _id: { $in: objectIds },
            userId: new ObjectId(session.user._id)
        });

        if (ownedProjectsCount !== projectIds.length) {
            return { success: false, error: 'You do not have permission to modify one or more of the selected projects.' };
        }

        const result = await db.collection('projects').updateMany(
            { _id: { $in: objectIds } },
            { $set: { appId: newAppId } }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'No matching projects found to update.' };
        }

        revalidatePath('/dashboard');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getKanbanData(projectId: string): Promise<{ project: WithId<Project> | null, columns: KanbanColumnData[] }> {
    const defaultData = { project: null, columns: [] };
    const project = await getProjectById(projectId);
    if (!project) return defaultData;
    
    try {
        const { db } = await connectToDatabase();
        const contacts = await db.collection<Contact>('contacts')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ lastMessageTimestamp: -1 })
            .toArray();

        const defaultStatuses = ['new', 'open', 'resolved'];
        const customStatuses = project.kanbanStatuses || [];
        const allStatuses = [...new Set([...defaultStatuses, ...customStatuses])];

        const columns = allStatuses.map(status => ({
            name: status,
            contacts: contacts.filter(c => (c.status || 'new') === status),
        }));

        return {
            project: JSON.parse(JSON.stringify(project)),
            columns: JSON.parse(JSON.stringify(columns))
        };
    } catch (e) {
        console.error("Failed to get Kanban data:", e);
        return defaultData;
    }
}

export async function saveKanbanStatuses(projectId: string, statuses: string[]): Promise<{ success: boolean; error?: string }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const defaultStatuses = ['new', 'open', 'resolved'];
        const customStatuses = statuses.filter(s => !defaultStatuses.includes(s));
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { kanbanStatuses: customStatuses } }
        );
        revalidatePath('/dashboard/chat/kanban');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to save Kanban lists.' };
    }
}

export async function handleUpdateContactStatus(contactId: string, status: string, assignedAgentId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(contactId)) return { success: false, error: 'Invalid Contact ID' };

    const session = await getSession();
    if (!session) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        const contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
        if (!contact) return { success: false, error: 'Contact not found' };

        const project = await getProjectById(contact.projectId.toString());
        if (!project) return { success: false, error: 'Access denied' };
        
        const update: any = { status };
        if (assignedAgentId) {
            update.assignedAgentId = assignedAgentId;
        } else {
            update.assignedAgentId = null;
        }
        
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: update });
        
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/chat/kanban');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: 'Failed to update contact status.' };
    }
}
