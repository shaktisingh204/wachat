'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/index.ts';
import { requirePermission } from '@/lib/rbac-server';
import { revalidatePath } from 'next/cache';

export async function getAgentOpenTickets(projectId: string, agentUserId: string) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    try {
        const { db } = await connectToDatabase();
        const count = await db.collection('contacts').countDocuments({
            projectId: new ObjectId(projectId),
            assignedAgentId: agentUserId,
            status: { $ne: 'closed' } // assuming 'closed' means resolved
        });
        return { count };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function reassignAndRemoveAgent(projectId: string, oldAgentUserId: string, newAgentUserId: string | null) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    const guard = await requirePermission('team_users', 'delete', projectId || null);
    if (!guard.ok) return { error: guard.error };

    try {
        const { db } = await connectToDatabase();
        
        if (newAgentUserId) {
            // Reassign open tickets
            await db.collection('contacts').updateMany(
                { projectId: new ObjectId(projectId), assignedAgentId: oldAgentUserId, status: { $ne: 'closed' } },
                { $set: { assignedAgentId: newAgentUserId } }
            );
        } else {
            // If newAgentUserId is null, we unassign them
            await db.collection('contacts').updateMany(
                { projectId: new ObjectId(projectId), assignedAgentId: oldAgentUserId, status: { $ne: 'closed' } },
                { $set: { assignedAgentId: null as any } }
            );
        }

        // Remove the agent from the project
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId), userId: new ObjectId(session.user._id) },
            { $pull: { agents: { userId: new ObjectId(oldAgentUserId) } } } as any
        );

        revalidatePath('/wachat/settings/agents');
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function updateProjectRoutingRules(projectId: string, routingStrategy: string) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId), userId: new ObjectId(session.user._id) },
            { $set: { 'wachatSettings.routingStrategy': routingStrategy } }
        );
        revalidatePath('/wachat/settings/agents');
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function updateAgentSkills(projectId: string, agentUserId: string, skills: string[]) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    try {
        const { db } = await connectToDatabase();
        // Update the agent's skills within the project's agents array
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId), userId: new ObjectId(session.user._id), 'agents.userId': new ObjectId(agentUserId) },
            { $set: { 'agents.$.skills': skills } }
        );
        revalidatePath('/wachat/settings/agents');
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
