

'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Invitation, User, Project } from '@/lib/definitions';
import { ObjectId, type WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';

async function findUserByEmail(email: string) {
    const { db } = await connectToDatabase();
    return await db.collection('users').findOne({ email: email.toLowerCase() });
}

export async function getInvitedUsers(): Promise<WithId<User>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();

        const userProjects = await db.collection('projects').find({ userId: new ObjectId(session.user._id) }).toArray();
        
        let agentUserIds: ObjectId[] = [];
        userProjects.forEach(project => {
            if (project.agents) {
                project.agents.forEach((agent: any) => {
                    if (agent.userId && !agentUserIds.some(id => id.equals(agent.userId))) {
                        agentUserIds.push(agent.userId);
                    }
                });
            }
        });

        if (agentUserIds.length === 0) return [];
        
        const users = await db.collection<User>('users').find({ _id: { $in: agentUserIds } }).project({ password: 0 }).toArray();
        
        const usersWithRoles = users.map(user => {
            const roles: Record<string, string> = {};
            userProjects.forEach(project => {
                const agentInfo = project.agents?.find((a: any) => a.userId.equals(user._id));
                if(agentInfo) {
                    roles[project.name] = agentInfo.role;
                }
            });
            return { ...user, roles };
        });
        
        return JSON.parse(JSON.stringify(usersWithRoles));
    } catch (e: any) {
        console.error("Error fetching invited users:", e);
        return [];
    }
}

export async function handleInviteAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    const projectId = formData.get('projectId') as string; // This can be null for global invites

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!email || !role) return { error: 'Missing required fields.' };
    
    const invitee = await findUserByEmail(email);
    if (!invitee) {
        return { error: `No user found with the email "${email}". Please ask them to sign up first.` };
    }
    if (invitee._id.toString() === session.user._id.toString()) {
        return { error: "You cannot invite yourself." };
    }

    try {
        const { db } = await connectToDatabase();
        
        // If a specific project ID is provided, invite to that project only.
        if (projectId && ObjectId.isValid(projectId)) {
            const project = await db.collection<WithId<Project>>('projects').findOne({ _id: new ObjectId(projectId) });

            if(!project || project.userId.toString() !== session.user._id.toString()) {
                return { error: "Project not found or you are not the owner." };
            }

            if (project.agents?.some((agent: any) => agent.userId.equals(invitee._id))) {
                return { error: "This user is already an agent on this project." };
            }
            
            await db.collection('projects').updateOne(
                { _id: project._id },
                { $addToSet: { agents: { userId: invitee._id, email: invitee.email, name: invitee.name, role: role } } }
            );
            
            revalidatePath('/dashboard/settings');
            revalidatePath('/dashboard/team/manage-users');
            return { message: `Invitation sent to ${email} for project ${project.name}.` };
        } else {
            // If no project ID, invite to all projects owned by the user.
            const userProjects = await db.collection<WithId<Project>>('projects').find({ userId: new ObjectId(session.user._id) }).toArray();

            if (userProjects.length === 0) {
                return { error: "You do not own any projects to invite a team member to." };
            }

            let updatedCount = 0;
            for (const project of userProjects) {
                if (project.agents?.some((agent: any) => agent.userId.equals(invitee._id))) {
                    console.log(`User ${email} is already an agent on project ${project.name}. Skipping.`);
                    continue;
                }
                
                await db.collection('projects').updateOne(
                    { _id: project._id },
                    { $addToSet: { agents: { userId: invitee._id, email: invitee.email, name: invitee.name, role: role } } }
                );
                updatedCount++;
            }

            if (updatedCount === 0) {
                return { message: `User ${email} is already a member of all your projects.` };
            }

            revalidatePath('/dashboard/settings');
            revalidatePath('/dashboard/team/manage-users');
            return { message: `Invitation sent to ${email}. They have been added to ${updatedCount} project(s).` };
        }
    } catch (e: any) {
        console.error("Agent invitation failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}

export async function handleRemoveAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const agentUserId = formData.get('agentUserId') as string;
    const projectId = formData.get('projectId') as string | null;
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!agentUserId || !ObjectId.isValid(agentUserId)) {
        return { error: 'Invalid Agent ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const agentObjectId = new ObjectId(agentUserId);
        
        if (projectId && ObjectId.isValid(projectId)) {
            // Case 1: Remove from a specific project
             await db.collection('projects').updateOne(
                { _id: new ObjectId(projectId), userId: userObjectId },
                { $pull: { agents: { userId: agentObjectId } } }
            );
        } else {
            // Case 2: Remove from all projects owned by the user
            await db.collection('projects').updateMany(
                { userId: userObjectId },
                { $pull: { agents: { userId: agentObjectId } } }
            );
        }
        
        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard/team/manage-users');
        return { message: 'Agent removed successfully.' };
    } catch (e: any) {
        console.error("Agent removal failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}

    
