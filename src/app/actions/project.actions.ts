

'use server';

import { getSession, getUsersForAdmin } from '@/app/actions/user.actions';
import { handleSubscribeProjectWebhook, handleSyncPhoneNumbers } from '@/app/actions/whatsapp.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Project, Plan, OptInOutSettings, UserAttribute, CannedMessage, Agent, Invitation, Contact, KanbanColumnData, User } from '@/lib/definitions';
import { ObjectId, type WithId, Filter } from 'mongodb';
import axios from 'axios';
import { revalidatePath } from 'next/cache';

export async function getProjectById(projectId: string, userId?: string) {
    if (!ObjectId.isValid(projectId)) {
        console.error("Invalid Project ID in getProjectById:", projectId);
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);

        let query: Filter<Project> = { _id: projectObjectId };

        if (!userId) {
            const session = await getSession();
            if (!session?.user) return null;
            userId = session.user._id;
        }

        query = {
            ...query,
            $or: [
                { userId: new ObjectId(userId) },
                { 'agents.userId': new ObjectId(userId) }
            ]
        };
        
        const project = await db.collection('projects').findOne(query);

        if (!project) return null;
        
        const plan = project.planId ? await db.collection('plans').findOne({ _id: project.planId }) : null;
        const finalProject = { ...project, plan };
        
        return JSON.parse(JSON.stringify(finalProject));
    } catch (error) {
        console.error("Failed to fetch project by ID:", error);
        return null;
    }
}

export async function handleManualWachatSetup(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to create a project.' };
    }

    const wabaId = formData.get('wabaId') as string;
    const appId = formData.get('appId') as string;
    const accessToken = formData.get('accessToken') as string;
    const includeCatalog = formData.get('includeCatalog') === 'on';

    if (!wabaId || !appId || !accessToken) {
        return { error: 'WABA ID, App ID, and Access Token are required.' };
    }

    try {
        // We will now attempt to create the project first, and only then try to subscribe the webhook.
        // This prevents setup failure if the token is valid but lacks webhook permissions.
        
        let businessId: string | undefined = undefined;
        if(includeCatalog) {
            try {
                const businessesResponse = await axios.get(`https://graph.facebook.com/v23.0/me/businesses`, {
                    params: { access_token: accessToken }
                });
                const businesses = businessesResponse.data.data;
                if (businesses && businesses.length > 0) {
                    businessId = businesses[0].id;
                } else {
                    console.warn("Could not find a Meta Business Account associated with this token to enable Catalog features.");
                }
            } catch(e) {
                // Non-fatal, just means catalog features might not work
                console.warn("Could not retrieve business ID for catalog features:", getErrorMessage(e));
            }
        }
        
        const projectDetailsResponse = await fetch(`https://graph.facebook.com/v23.0/${wabaId}?fields=name&access_token=${accessToken}`);
        const projectData = await projectDetailsResponse.json();

        if (projectData.error) {
            return { error: `Meta API Error (fetching project name): ${projectData.error.message}` };
        }

        const { db } = await connectToDatabase();
        
        const existingProject = await db.collection('projects').findOne({ wabaId: wabaId });
        if(existingProject) {
            return { error: 'A project with this WABA ID already exists.'};
        }

        const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
        
        const newProject: Omit<Project, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: projectData.name,
            wabaId: wabaId,
            appId: appId,
            businessId: businessId,
            accessToken: accessToken,
            phoneNumbers: [],
            createdAt: new Date(),
            messagesPerSecond: 80,
            planId: defaultPlan?._id,
            credits: defaultPlan?.signupCredits || 0,
            hasCatalogManagement: includeCatalog,
        };

        const result = await db.collection('projects').insertOne(newProject as any);
        
        // Attempt to subscribe to webhooks after creation, but don't fail the entire process if it doesn't work.
        if(result.insertedId) {
            await handleSyncPhoneNumbers(result.insertedId.toString());
            await handleSubscribeProjectWebhook(wabaId, appId, accessToken);
        }

        revalidatePath('/dashboard');
        
        return { message: `Project "${projectData.name}" created successfully!` };

    } catch (e: any) {
        console.error('Manual project creation failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
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
        const attributes = attributesJSON ? JSON.parse(attributesJSON) : [];
        
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
        createdAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (messageId) {
            await db.collection('canned_messages').updateOne({ _id: new ObjectId(messageId) }, { $set: { ...cannedMessageData, createdAt: undefined } as any});
        } else {
            await db.collection('canned_messages').insertOne(cannedMessageData as any);
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
        if (currentAgentCount >= (plan.agentLimit || 0)) {
            return { error: `You have reached your agent limit of ${plan.agentLimit}. Please upgrade your plan.` };
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

        const newInvitation: Omit<Invitation, '_id'> = {
            projectId: project._id,
            projectName: project.name,
            inviterId: new ObjectId(session.user._id),
            inviterName: session.user.name,
            inviteeEmail: email,
            role,
            status: 'pending',
            createdAt: new Date(),
        };

        await db.collection('invitations').insertOne(newInvitation as any);
        
        revalidatePath('/dashboard/settings');
        return { message: `Invitation sent to ${email}.` };

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
    console.log(`Bulk updating App ID for ${projectIds.length} projects to ${newAppId}`);
    
    try {
        const { db } = await connectToDatabase();
        const objectIds = projectIds.map(id => new ObjectId(id));
        
        // Ensure user owns all selected projects
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

export async function getWhatsAppProjectsForAdmin(
    page: number = 1,
    limit: number = 20,
    query?: string,
    userId?: string
): Promise<{ projects: WithId<Project & { owner: { name: string; email: string } }>[], total: number, users: WithId<User>[] }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = { wabaId: { $exists: true, $ne: null } };
        
        if (query) {
             filter.name = { $regex: query, $options: 'i' };
        }
        if (userId) {
            filter.userId = new ObjectId(userId);
        }
        
        const skip = (page - 1) * limit;

        const pipeline: any[] = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'ownerInfo'
                }
            },
            { $unwind: { path: '$ownerInfo', preserveNullAndEmptyArrays: true } },
            { $addFields: { 'owner.name': '$ownerInfo.name', 'owner.email': '$ownerInfo.email' } },
            { $project: { ownerInfo: 0 } }
        ];
        
        const [projects, total, users] = await Promise.all([
             db.collection<Project>('projects').aggregate(pipeline).toArray(),
             db.collection('projects').countDocuments(filter),
             db.collection('users').find({}).project({ name: 1, email: 1 }).toArray()
        ]);

        return { 
            projects: JSON.parse(JSON.stringify(projects)), 
            total: total,
            users: JSON.parse(JSON.stringify(users))
        };
    } catch(e) {
        console.error("Failed to get WhatsApp projects for admin:", e);
        return { projects: [], total: 0, users: [] };
    }
}
