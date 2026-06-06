import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/sabcrm/20ui/compat';
import { Bot } from 'lucide-react';

export function GettingStarted() {
    return (
        <Card className="p-6">
            <div className="flex items-start gap-4">
                <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)' }}
                >
                    <Bot className="h-5 w-5 text-white" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] text-zoru-ink">Getting started</h3>
                    <ol className="mt-2 flex flex-col gap-1.5 text-[13px] text-zoru-ink">
                        <li>
                            1. Chat with <span className="font-mono text-[12px]">@BotFather</span> on Telegram
                            and create a new bot.
                        </li>
                        <li>
                            2. Copy the bot token and paste it into{' '}
                            <Link
                                href="/dashboard/telegram/connections"
                                className="text-zoru-ink hover:underline"
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
