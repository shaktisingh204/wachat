'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function getDashboardStats(projectId: string) {
    if (!projectId) {
        return { totalMessages: 0, totalSent: 0, totalFailed: 0, totalDelivered: 0, totalRead: 0, totalCampaigns: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);

        const totalCampaigns = await db.collection('broadcasts').countDocuments({ projectId: projectObjectId });
        
        const outgoingMessagesCollection = db.collection('outgoing_messages');
        
        const totalMessages = await outgoingMessagesCollection.countDocuments({ projectId: projectObjectId });
        
        const sentQuery = { projectId: projectObjectId, status: { $in: ['sent', 'delivered', 'read'] } };
        const totalSent = await outgoingMessagesCollection.countDocuments(sentQuery);

        const deliveredQuery = { projectId: projectObjectId, status: { $in: ['delivered', 'read'] } };
        const totalDelivered = await outgoingMessagesCollection.countDocuments(deliveredQuery);

        const readQuery = { projectId: projectObjectId, status: 'read' };
        const totalRead = await outgoingMessagesCollection.countDocuments(readQuery);

        const failedQuery = { projectId: projectObjectId, status: 'failed' };
        const totalFailed = await outgoingMessagesCollection.countDocuments(failedQuery);

        return {
            totalMessages,
            totalSent,
            totalFailed,
            totalDelivered,
            totalRead,
            totalCampaigns,
        };

    } catch (error) {
        console.error("Failed to get dashboard stats:", error);
        return { totalMessages: 0, totalSent: 0, totalFailed: 0, totalDelivered: 0, totalRead: 0, totalCampaigns: 0 };
    }
}
