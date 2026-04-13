import { Send } from 'lucide-react';

export default function TelegramPage() {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
            <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                    background: 'linear-gradient(135deg, #229ED9 0%, #0088CC 100%)',
                    boxShadow: '0 8px 24px rgba(34, 158, 217, 0.25)',
                }}
            >
                <Send className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Telegram</h1>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Connect a Telegram bot or Business account to send and receive messages,
                    manage contacts, and run automations from SabNode.
                </p>
            </div>
        </div>
    );
}
