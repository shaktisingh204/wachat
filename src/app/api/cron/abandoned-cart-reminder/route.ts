
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import type { Project, FacebookSubscriber, EcommFlow } from '@/lib/definitions';
import { handleEcommFlowLogic } from '@/lib/webhook-processor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { db } = await connectToDatabase();

        const projects = await db.collection<Project>('projects').find({
            'ecommSettings.abandonedCart.enabled': true
        }).toArray();

        let remindersSent = 0;
        let projectsChecked = 0;

        for (const project of projects) {
            projectsChecked++;
            const settings = project.ecommSettings?.abandonedCart;
            if (!settings?.enabled || !settings.flowId || !settings.delayMinutes) {
                continue;
            }
            
            const delayMillis = settings.delayMinutes * 60 * 1000;
            const reminderThreshold = new Date(Date.now() - delayMillis);
            
            const subscribersWithAbandonedCarts = await db.collection<FacebookSubscriber>('facebook_subscribers').find({
                projectId: project._id,
                'activeEcommFlow.variables.cart': { $exists: true, $ne: [] },
                'activeEcommFlow.cartLastUpdatedAt': { $lt: reminderThreshold },
                'activeEcommFlow.variables.order_completed': { $ne: true }
            }).toArray();

            for (const subscriber of subscribersWithAbandonedCarts) {
                // To prevent re-sending, we can set a flag after sending the reminder
                if (subscriber.activeEcommFlow?.variables.abandoned_cart_reminder_sent) {
                    continue;
                }

                const reminderFlow = await db.collection<EcommFlow>('ecomm_flows').findOne({ _id: new ObjectId(settings.flowId) });
                if (reminderFlow) {
                    const logger = { log: (msg: string, data?: any) => console.log(msg, data), save: async () => {} }; // Dummy logger
                    
                    // Set a flag to indicate reminder was sent
                    await db.collection('facebook_subscribers').updateOne(
                        { _id: subscriber._id },
                        { $set: { "activeEcommFlow.variables.abandoned_cart_reminder_sent": true } }
                    );

                    // Trigger the reminder flow
                    await handleEcommFlowLogic(db, project, { ...subscriber, activeEcommFlow: { ...subscriber.activeEcommFlow, variables: { ...subscriber.activeEcommFlow?.variables, abandoned_cart_reminder_sent: true } } } as any, {});
                    
                    remindersSent++;
                }
            }
        }

        return NextResponse.json({
            message: `Abandoned cart cron job finished. Checked ${projectsChecked} project(s) and sent ${remindersSent} reminder(s).`,
        });

    } catch (error: any) {
        console.error('Error in abandoned-cart-reminder cron job:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function POST(request: Request) {
    return GET(request);
}
