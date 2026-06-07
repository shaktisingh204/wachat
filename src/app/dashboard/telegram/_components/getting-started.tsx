import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { Bot } from 'lucide-react';

export function GettingStarted() {
    return (
        <Card className="p-6">
            <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-gradient-to-br from-[#37BBFE] to-[#007DBB]">
                    <Bot className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <CardHeader className="p-0">
                        <CardTitle className="text-[14px]">Getting started</CardTitle>
                    </CardHeader>
                    <ol className="mt-2 flex flex-col gap-1.5 text-[13px] text-[var(--st-text)]">
                        <li>
                            1. Chat with <span className="font-mono text-[12px]">@BotFather</span> on Telegram
                            and create a new bot.
                        </li>
                        <li>
                            2. Copy the bot token and paste it into{' '}
                            <Link
                                href="/dashboard/telegram/connections"
                                className="text-[var(--st-text)] hover:underline"
                            >
                                Connections
                            </Link>
                            .
                        </li>
                        <li>3. SabNode will register a webhook with a secret token automatically.</li>
                        <li>4. Start receiving messages in the Live Chat inbox.</li>
                    </ol>
                </div>
            </div>
        </Card>
    );
}
