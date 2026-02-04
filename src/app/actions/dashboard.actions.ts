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

export async function getDashboardChartData(projectId: string) {
    if (!projectId) return [];

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const pipeline = [
            {
                $match: {
                    projectId: projectObjectId,
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $project: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    status: 1
                }
            },
            {
                $group: {
                    _id: "$date",
                    sent: { $sum: { $cond: [{ $in: ["$status", ["sent", "delivered", "read"]] }, 1, 0] } },
                    delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
                    read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date ascending
            }
        ];

        const results = await db.collection('outgoing_messages').aggregate(pipeline).toArray();

        // Fill in missing dates
        const chartData = [];
        const resultMap = new Map(results.map((r: any) => [r._id, r]));

        for (let i = 0; i < 30; i++) {
            const date = new Date(thirtyDaysAgo);
            date.setDate(date.getDate() + i);
            const dateString = date.toISOString().split('T')[0];

            const data = resultMap.get(dateString);
            chartData.push({
                date: dateString,
                sent: data ? data.sent : 0,
                delivered: data ? data.delivered : 0,
                read: data ? data.read : 0
            });
        }

        return chartData;

    } catch (error) {
        console.error("Failed to fetch dashboard chart data:", error);
        return [];
    }
}
