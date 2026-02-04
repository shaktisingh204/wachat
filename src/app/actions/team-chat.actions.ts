'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { TeamChannel, TeamMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils'; // Assuming this util exists or I should use generic error handling

// Create or get DM channel
export async function getOrCreateDmChannel(targetUserId: string): Promise<WithId<TeamChannel> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (!ObjectId.isValid(targetUserId)) return null;
    const currentUserId = new ObjectId(session.user._id);
    const targetId = new ObjectId(targetUserId);

    try {
        const { db } = await connectToDatabase();

        // Find existing DM channel
        const existingChannel = await db.collection<TeamChannel>('team_channels').findOne({
            type: 'dm',
            participants: { $all: [{ $elemMatch: { userId: currentUserId } }, { $elemMatch: { userId: targetId } }] }
        });

        if (existingChannel) {
            return JSON.parse(JSON.stringify(existingChannel));
        }

        // Get User details for participants
        const users = await db.collection('users').find({ _id: { $in: [currentUserId, targetId] } }).toArray();
        const currentUser = users.find(u => u._id.equals(currentUserId));
        const targetUser = users.find(u => u._id.equals(targetId));

        if (!currentUser || !targetUser) return null;

        // Create new channel
        const newChannel: Omit<TeamChannel, '_id'> = {
            type: 'dm',
            participants: [
                { userId: currentUser._id, name: currentUser.name || currentUser.email, avatar: currentUser.image }, // Assuming 'image' or typical structure
                { userId: targetUser._id, name: targetUser.name || targetUser.email, avatar: targetUser.image }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('team_channels').insertOne(newChannel as any);
        return JSON.parse(JSON.stringify({ ...newChannel, _id: result.insertedId }));

    } catch (e) {
        console.error("Failed to get/create DM channel:", e);
        return null;
    }
}

// Get messages for a channel
export async function getChannelMessages(channelId: string): Promise<WithId<TeamMessage>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    if (!ObjectId.isValid(channelId)) return [];

    try {
        const { db } = await connectToDatabase();
        const messages = await db.collection<TeamMessage>('team_messages')
            .find({ channelId: new ObjectId(channelId) })
            .sort({ createdAt: 1 }) // Oldest first
            .limit(100)
            .toArray();

        return JSON.parse(JSON.stringify(messages));
    } catch (e) {
        console.error("Failed to fetch messages:", e);
        return [];
    }
}

// Send a message
export async function sendTeamMessage(channelId: string, content: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!ObjectId.isValid(channelId) || !content.trim()) return { success: false, error: 'Invalid input' };

    try {
        const { db } = await connectToDatabase();
        const newMessage: Omit<TeamMessage, '_id'> = {
            channelId: new ObjectId(channelId),
            senderId: new ObjectId(session.user._id),
            content: content.trim(),
            readBy: [new ObjectId(session.user._id)],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection('team_messages').insertOne(newMessage as any);

        // Update channel's last message
        await db.collection('team_channels').updateOne(
            { _id: new ObjectId(channelId) },
            {
                $set: {
                    updatedAt: new Date(),
                    lastMessage: {
                        content: content.substring(0, 100), // Truncate preview
                        senderId: new ObjectId(session.user._id),
                        createdAt: new Date()
                    }
                }
            }
        );

        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
