

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

export async function getProjectByIdSystem(projectId: string): Promise<WithId<Project> | null> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection<Project>('projects').findOne({ _id: new ObjectId(projectId) });

        if (!project) return null;

        // Populate plan if needed, similar to getProjectById but simpler if fine
        // Using existing aggregation logic if plan details are required everywhere
        // For now, doing a simple findOne as wachat.ts mainly needs phoneNumbers/access token
        // If plan is needed, we should replicate aggregation or share logic.
        // Replicating aggregation from getProjectById for consistency:
        const projectWithPlan = await db.collection('projects').aggregate([
            { $match: { _id: new ObjectId(projectId) } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
            { $addFields: { plan: '$planInfo' } },
            { $project: { planInfo: 0 } }
        ]).next();

        return projectWithPlan ? JSON.parse(JSON.stringify(projectWithPlan)) : null;

    } catch (error) {
        console.error("Failed to fetch project (system):", error);
        return null;
    }
}

export async function getProjectForBroadcast(projectId: string): Promise<(Pick<WithId<Project>, '_id' | 'name' | 'phoneNumbers' | 'tags' | 'optInOutSettings'>) | null> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return null;

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne(
            { _id: new ObjectId(projectId) },
            { projection: { name: 1, phoneNumbers: 1, optInOutSettings: 1, tags: 1 } }
        );

        if (!project) {
            console.error("Project not found for ID:", projectId);
            return null;
        }

        return JSON.parse(JSON.stringify(project));
    } catch (error: any) {
        console.error("Exception in getProjectForBroadcast:", error);
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
            projectFilter.wabaId = { $exists: true, $ne: null as any };
        } else if (type === 'facebook') {
            projectFilter.facebookPageId = { $exists: true, $ne: null as any };
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

// getProjectsForAdmin moved to admin.actions.ts


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

    const enabledVal = formData.get('enabled');
    let updatePayload: any = { enabled: enabledVal === 'on' || enabledVal === 'true' };

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
            message: formData.get('message') as string,
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            timezone: formData.get('timezone'),
            days: [0, 1, 2, 3, 4, 5, 6].filter(day => {
                const val = formData.get(`day_${day}`);
                return val === 'on' || val === 'true';
            })
        }
    }
    if (replyType === 'aiAssistant') {
        updatePayload.context = formData.get('context');
        const autoTransVal = formData.get('autoTranslate');
        updatePayload.autoTranslate = autoTransVal === 'on' || autoTransVal === 'true';
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

// handleUpdateContactStatus moved to contact.actions.ts


// handleUpdateContactDetails moved to contact.actions.ts


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

export async function handleDeleteUserProject(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    const projectId = formData.get('projectId') as string;
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid project ID.' };
    }

    try {
        const { db } = await connectToDatabase();

        const project = await db.collection('projects').findOne({
            _id: new ObjectId(projectId),
            userId: new ObjectId(session.user._id)
        });

        if (!project) {
            return { error: 'Project not found or you do not have permission to delete it.' };
        }

        await db.collection('projects').deleteOne({ _id: new ObjectId(projectId) });

        const projectObjectId = new ObjectId(projectId);
        await Promise.all([
            db.collection('contacts').deleteMany({ projectId: projectObjectId }),
            db.collection('flows').deleteMany({ projectId: projectObjectId }),
            db.collection('canned_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('invitations').deleteMany({ projectId: projectObjectId }),
        ]);

        revalidatePath('/dashboard');

        return { message: `Project "${project.name}" deleted successfully.` };

    } catch (e: any) {
        console.error('Delete project failed:', e);
        return { error: getErrorMessage(e) || 'Failed to delete project.' };
    }
}


export async function handleUpdateProjectTags(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const projectId = formData.get('projectId') as string;
    const tagsJSON = formData.get('tags') as string | null;

    if (!projectId) return { error: 'Project ID is missing.' };

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();

        let updateData: any = {};
        if (tagsJSON) {
            const parsedTags = JSON.parse(tagsJSON).map((tag: any) => ({
                _id: tag._id && !tag._id.startsWith('temp_') ? new ObjectId(tag._id) : new ObjectId(),
                name: tag.name,
                color: tag.color
            }));
            updateData.tags = parsedTags;
        }

        if (Object.keys(updateData).length === 0) {
            return { error: 'No data provided to update.' };
        }

        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: updateData }
        );

        revalidatePath('/dashboard/chat');
        return { message: 'Tags updated successfully.' };
    } catch (e: any) {
        console.error("Failed to update tags:", e);
        return { error: 'An error occurred while updating tags.' };
    }
}
