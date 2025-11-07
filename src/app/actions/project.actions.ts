
'use server';

import { getSession } from './user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId, Filter } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { Project, Contact, KanbanColumnData, OptInOutSettings, UserAttribute, CannedMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getProjectById(projectId?: string | null): Promise<WithId<Project> | null> {
    const session = await getSession();
    if (!session?.user || !projectId || !ObjectId.isValid(projectId)) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        const project = await db.collection('projects').aggregate([
            { $match: { _id: projectObjectId } },
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


export async function getProjects(query?: string, type?: 'whatsapp' | 'facebook'): Promise<WithId<Project>[]> {
    const session = await getSession();
    if (!session?.user) {
        return [];
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const projectFilter: Filter<Project> = {
            $or: [
                { userId: userObjectId },
                { 'agents.userId': userObjectId },
            ],
        };

        if (query) {
            projectFilter.name = { $regex: query, $options: 'i' };
        }
        
        if (type === 'whatsapp') {
            projectFilter.wabaId = { $exists: true, $ne: null };
        } else if (type === 'facebook') {
            projectFilter.facebookPageId = { $exists: true, $ne: null };
        }

        const projects = await db.collection<Project>('projects')
            .find(projectFilter)
            .sort({ createdAt: -1 })
            .toArray();
            
        return JSON.parse(JSON.stringify(projects));
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return [];
    }
}

export async function getProjectsForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ projects: WithId<any>[], total: number }> {
     try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = {};
        if (query) {
             filter.name = { $regex: query, $options: 'i' };
        }
        
        const skip = (page - 1) * limit;
        
        const [projects, total] = await Promise.all([
             db.collection<Project>('projects').aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'plans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'plan'
                    }
                },
                {
                    $unwind: { path: '$plan', preserveNullAndEmptyArrays: true }
                }
             ]).toArray(),
             db.collection('projects').countDocuments(filter)
        ]);

        return { projects: JSON.parse(JSON.stringify(projects)), total };
    } catch(e) {
        return { projects: [], total: 0 };
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

export async function handleUpdateContactDetails(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const variablesJSON = formData.get('variables') as string;

    if (!ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid Contact ID' };
    }
    
    try {
        const variables = JSON.parse(variablesJSON);
        const { db } = await connectToDatabase();
        
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { variables } }
        );
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to update contact.' };
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
        const attributes = JSON.parse(attributesJSON);
        
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

    const cannedMessageData: Partial<Omit<CannedMessage, '_id'>> = {
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
            await db.collection('canned_messages').insertOne({ ...cannedMessageData, createdAt: new Date() } as CannedMessage);
        }
        revalidatePath('/dashboard/settings');
        return { message: 'Canned message saved successfully.' };
    } catch (e: any) {
        return { error: 'Failed to save canned message.' };
    }
}

export async function deleteCannedMessage(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

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
     const session = await getSession();
    if (!session?.user) return [];

    if (!ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        return JSON.parse(JSON.stringify(await db.collection<CannedMessage>('canned_messages').find({ projectId: new ObjectId(projectId) }).sort({ isFavourite: -1, name: 1 }).toArray()));
    } catch (e) {
        return [];
    }
}
    
