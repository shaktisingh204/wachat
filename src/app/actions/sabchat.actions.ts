
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { ObjectId, type WithId } from 'mongodb';
import type { SabChatSettings, SabChatSession, SabChatMessage } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import { headers } from 'next/headers';

export async function saveSabChatSettings(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    // Existing settings not on this form, passed via hidden input
    const existingSettings = JSON.parse(formData.get('settings') as string || '{}');

    const settings: Partial<SabChatSettings> = {
        ...existingSettings,
        // AI-related fields from this form
        aiEnabled: formData.get('aiEnabled') === 'on',
        aiContext: formData.get('aiContext') as string,
        // Auto-reply fields that might be on a different form but use the same action
        welcomeEnabled: formData.get('welcomeEnabled') === 'on',
        welcomeMessage: formData.get('welcomeMessage') as string,
        awayMessageEnabled: formData.get('awayMessageEnabled') === 'on',
        awayMessage: formData.get('awayMessage') as string,
        // General fields
        enabled: formData.get('enabled') === 'on',
        widgetColor: formData.get('widgetColor') as string,
        teamName: formData.get('teamName') as string,
        avatarUrl: formData.get('avatarUrl') as string,
    };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { sabChatSettings: settings } }
        );
        revalidatePath('/dashboard/sabchat/settings');
        revalidatePath('/dashboard/sabchat/ai-replies');
        revalidatePath('/dashboard/sabchat/widget');
        revalidatePath('/dashboard/sabchat/auto-reply');
        return { message: 'Settings saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function saveSabChatFaq(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    const id = formData.get('id') as string | null;
    const question = formData.get('question') as string;
    const answer = formData.get('answer') as string;

    if (!question || !answer) return { error: 'Question and answer are required.' };

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const faqs = user?.sabChatSettings?.faqs || [];

        if (id) {
            const index = faqs.findIndex((f: any) => f._id.toString() === id);
            if (index > -1) {
                faqs[index].question = question;
                faqs[index].answer = answer;
            }
        } else {
            faqs.push({ _id: new ObjectId(), question, answer });
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'sabChatSettings.faqs': faqs } }
        );
        revalidatePath('/dashboard/sabchat/faq');
        return { message: 'FAQ saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteSabChatFaq(faqId: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'sabChatSettings.faqs': { _id: new ObjectId(faqId) } } as any }
        );
        revalidatePath('/dashboard/sabchat/faq');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function saveSabChatQuickReply(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    const id = formData.get('id') as string | null;
    const shortcut = formData.get('shortcut') as string;
    const message = formData.get('message') as string;

    if (!shortcut || !message) return { error: 'Shortcut and message are required.' };
    if (!shortcut.startsWith('/')) return { error: 'Shortcut must start with a forward slash (/).' };

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const replies = user?.sabChatSettings?.quickReplies || [];

        if (id) {
            const index = replies.findIndex((r: any) => r._id.toString() === id);
            if (index > -1) {
                replies[index].shortcut = shortcut;
                replies[index].message = message;
            }
        } else {
            replies.push({ _id: new ObjectId(), shortcut, message });
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'sabChatSettings.quickReplies': replies } }
        );
        revalidatePath('/dashboard/sabchat/quick-replies');
        return { message: 'Quick reply saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteSabChatQuickReply(replyId: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'sabChatSettings.quickReplies': { _id: new ObjectId(replyId) } } as any }
        );
        revalidatePath('/dashboard/sabchat/quick-replies');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getChatSessionsForUser() {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const sessions = await db.collection('sabchat_sessions').find({
            userId: new ObjectId(session.user._id)
        }).sort({ updatedAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(sessions));
    } catch (e) {
        return [];
    }
}

export async function getLiveVisitors() {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const visitors = await db.collection('sabchat_sessions').find({
            userId: new ObjectId(session.user._id),
            updatedAt: { $gte: tenMinutesAgo }
        }).sort({ updatedAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(visitors));
    } catch (e) {
        return [];
    }
}

export async function getFullChatSession(sessionId: string): Promise<WithId<SabChatSession> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (!sessionId || !ObjectId.isValid(sessionId)) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const chatSession = await db.collection<SabChatSession>('sabchat_sessions').findOne({
            _id: new ObjectId(sessionId),
            userId: new ObjectId(session.user._id)
        });

        return chatSession ? JSON.parse(JSON.stringify(chatSession)) : null;

    } catch (e) {
        return null;
    }
}

export async function getOrCreateChatSession(userId: string, email: string, name?: string, visitorId?: string | null): Promise<{ sessionId?: string; session?: WithId<SabChatSession>, error?: string }> {
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const headersList = await headers();

        let validVisitorId: ObjectId;

        if (visitorId && ObjectId.isValid(visitorId)) {
            validVisitorId = new ObjectId(visitorId);
        } else {
            validVisitorId = new ObjectId();
        }


        const result = await db.collection<SabChatSession>('sabchat_sessions').findOneAndUpdate(
            { userId: new ObjectId(userId), visitorId: validVisitorId.toString() } as any,
            {
                $set: {
                    updatedAt: now,
                    'visitorInfo.email': email,
                    'visitorInfo.name': name || email.split('@')[0], // Fallback to email prefix
                    'visitorInfo.ip': headersList.get('x-forwarded-for') || 'unknown',
                    'visitorInfo.userAgent': headersList.get('user-agent') || 'unknown',
                    'visitorInfo.page': headersList.get('referer') || 'unknown'
                },
                $setOnInsert: {
                    userId: new ObjectId(userId),
                    visitorId: validVisitorId.toString(),
                    status: 'open',
                    createdAt: now,
                    history: [],
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        const session = result;

        if (!session) {
            return { error: "Could not create or find a session." };
        }

        return { sessionId: session._id.toString(), session: JSON.parse(JSON.stringify(session)) };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function postChatMessage(sessionId: string, sender: 'visitor' | 'agent', content: string): Promise<{ success: boolean; error?: string }> {
    if (!sessionId || !ObjectId.isValid(sessionId)) {
        return { success: false, error: 'Invalid session ID.' };
    }

    try {
        const { db } = await connectToDatabase();

        const newMessage: SabChatMessage = {
            _id: new ObjectId(),
            sender,
            content,
            type: 'text',
            timestamp: new Date()
        };

        const result = await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            {
                $push: { history: newMessage } as any,
                $set: { updatedAt: new Date() }
            }
        );

        if (result.modifiedCount === 0) {
            return { success: false, error: 'Session not found.' };
        }

        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getChatHistory(sessionId: string) {
    if (!sessionId || !ObjectId.isValid(sessionId)) {
        return [];
    }
    try {
        const { db } = await connectToDatabase();
        const session = await db.collection<SabChatSession>('sabchat_sessions').findOne(
            { _id: new ObjectId(sessionId) },
            { projection: { history: 1 } }
        );
        return session?.history || [];
    } catch (e) {
        return [];
    }
}

export async function getSabChatAnalytics() {
    const session = await getSession();
    if (!session?.user) return null;
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const dailyCounts = await db.collection('sabchat_sessions').aggregate([
            { $match: { userId: userId, createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", count: "$count" } }
        ]).toArray();


        const stats = await db.collection('sabchat_sessions').aggregate([
            { $match: { userId: userId } },
            {
                $group: {
                    _id: null,
                    totalChats: { $sum: 1 },
                    openChats: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } }
                }
            }
        ]).next();

        return {
            totalChats: stats?.totalChats || 0,
            openChats: stats?.openChats || 0,
            closedChats: (stats?.totalChats || 0) - (stats?.openChats || 0),
            avgResponseTime: 32, // Mock
            satisfaction: 94, // Mock
            dailyChatVolume: dailyCounts
        }

    } catch (e) {
        console.error("Failed to get sabchat analytics", e);
        return null;
    }
}

export async function closeChatSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    if (!sessionId || !ObjectId.isValid(sessionId)) return { success: false, error: 'Invalid session ID' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { $set: { status: 'closed', updatedAt: new Date() } }
        );
        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to close session.' };
    }
}

export async function addTagToSession(sessionId: string, tagName: string): Promise<{ success: boolean, error?: string }> {
    if (!sessionId || !ObjectId.isValid(sessionId)) return { success: false, error: 'Invalid session ID' };
    if (!tagName || !tagName.trim()) return { success: false, error: 'Tag name is required' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { $addToSet: { tags: tagName.trim() } as any, $set: { updatedAt: new Date() } }
        );
        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to add tag.' };
    }
}

export async function getSabChatUniqueTags(): Promise<string[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const tags = await db.collection('sabchat_sessions').distinct('tags', { userId: new ObjectId(session.user._id) });
        return tags || [];
    } catch (e) {
        return [];
    }
}

export async function postChatMessageAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const sender = formData.get('sender') as 'visitor' | 'agent';
    const content = formData.get('content') as string;

    if (!content || !content.trim()) {
        return { success: false, error: 'Message cannot be empty.' };
    }

    return postChatMessage(sessionId, sender, content);
}

export async function assignAgent(sessionId: string, agentId: string) {
    if (!sessionId || !ObjectId.isValid(sessionId)) return { success: false, error: 'Invalid session ID' };
    if (!agentId) return { success: false, error: 'Agent ID is required' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { $set: { assignedTo: agentId, updatedAt: new Date() } }
        );
        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to assign agent.' };
    }
}

export async function updateVisitorInfo(sessionId: string, name?: string, email?: string, phone?: string) {
    if (!sessionId || !ObjectId.isValid(sessionId)) return { success: false, error: 'Invalid session ID' };

    const updates: any = {};
    if (name) updates['visitorInfo.name'] = name;
    if (email) updates['visitorInfo.email'] = email;
    if (phone) updates['visitorInfo.phone'] = phone;

    if (Object.keys(updates).length === 0) return { success: true };

    try {
        const { db } = await connectToDatabase();
        await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { $set: { ...updates, updatedAt: new Date() } }
        );
        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to update visitor info.' };
    }
}

export async function getSabChatQuickReplies(): Promise<{ value: string, label: string }[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const replies = user?.sabChatSettings?.quickReplies || [];
        return replies.map((r: any) => ({ value: r._id.toString(), label: r.shortcut }));
    } catch (e) {
        return [];
    }
}

export async function getSabChatFaqs(): Promise<{ value: string, label: string }[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const faqs = user?.sabChatSettings?.faqs || [];
        return faqs.map((f: any) => ({ value: f._id.toString(), label: f.question }));
    } catch (e) {
        return [];
    }
}

export async function sendQuickReply(sessionId: string, replyId: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const reply = user?.sabChatSettings?.quickReplies?.find((r: any) => r._id.toString() === replyId);

        if (!reply) return { success: false, error: 'Quick reply not found' };

        return await postChatMessage(sessionId, 'agent', reply.message);
    } catch (e) {
        return { success: false, error: 'Failed to send quick reply' };
    }
}

export async function sendFaq(sessionId: string, faqId: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const faq = user?.sabChatSettings?.faqs?.find((f: any) => f._id.toString() === faqId);

        if (!faq) return { success: false, error: 'FAQ not found' };

        return await postChatMessage(sessionId, 'agent', faq.answer);
    } catch (e) {
        return { success: false, error: 'Failed to send FAQ' };
    }
}

export async function blockVisitor(sessionId: string) {
    if (!sessionId || !ObjectId.isValid(sessionId)) return { success: false, error: 'Invalid session ID' };
    // Placeholder for blocking logic (e.g., adding IP to blacklist or flagging visitor)
    try {
        const { db } = await connectToDatabase();
        await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { $set: { blocked: true, status: 'closed', updatedAt: new Date() } }
        );
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Failed to block visitor' };
    }
}

