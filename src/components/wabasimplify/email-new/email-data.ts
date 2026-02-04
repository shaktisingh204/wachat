import { EmailConversation, EmailMessage } from '@/lib/definitions';
import { subHours, subDays } from 'date-fns';

const generateId = () => Math.random().toString(36).substring(7);

const users = [
    { name: 'Alice Smith', email: 'alice@example.com', avatar: 'AS' },
    { name: 'Bob Jones', email: 'bob@example.com', avatar: 'BJ' },
    { name: 'Support Team', email: 'support@company.com', avatar: 'ST' },
    { name: 'Marketing', email: 'marketing@newsletter.com', avatar: 'M' },
];

export const mockConversations: EmailConversation[] = Array.from({ length: 20 }).map((_, i) => {
    const user = users[i % users.length];
    const isUnread = i < 5;

    return {
        _id: generateId() as any, // Mock ObjectId
        userId: 'user1' as any,
        participants: [user],
        subject: `Project Update: Phase ${i + 1} - Important details inside`,
        snippet: 'Here are the latest updates regarding the ongoing project. Please review the attached documents...',
        status: isUnread ? 'unread' : 'read',
        folder: i === 0 ? 'trash' : 'inbox',
        labels: i % 3 === 0 ? ['Work', 'Urgent'] : ['Personal'],
        lastMessageAt: subDays(new Date(), i),
        unreadCount: isUnread ? 1 : 0,
        isStarred: i % 4 === 0,
        messages: [
            {
                id: generateId(),
                from: user,
                to: [{ name: 'Me', email: 'me@mycompany.com' }],
                subject: `Project Update: Phase ${i + 1}`,
                bodyText: 'Hello, here is the update...',
                bodyHtml: '<p>Hello, here is the update...</p>',
                date: subDays(new Date(), i),
                isRead: !isUnread,
                folder: 'inbox',
            }
        ]
    };
});
