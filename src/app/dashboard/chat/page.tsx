
import type { Metadata } from 'next';
import { getProjectById } from '@/app/actions';
import { ChatClient } from '@/components/wabasimplify/chat-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live Chat | Wachat',
};

// This is a server component that fetches the initial project data
// and passes it to the client component that handles the chat logic.
export default async function ChatPage() {
    // In a real app, you'd get the active project ID from the user's session or a similar source.
    // For now, we simulate this by expecting it to be available, but this part would need to be implemented.
    // Let's assume the client component will handle fetching based on localStorage for this prototype.

    return <ChatClient />;
}
