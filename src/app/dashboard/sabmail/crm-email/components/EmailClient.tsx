'use client';

import React, { useState } from 'react';
import {
    Mail,
    Inbox,
    FileText,
    BarChart,
    Settings,
    Search,
    RefreshCw,
    Eye,
    MousePointerClick,
    Send,
    Star,
    Trash,
    Archive,
    User,
    Plus,
} from 'lucide-react';
import {
    Button,
    IconButton,
    Card,
    Field,
    Input,
    EmptyState,
    StatCard,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

interface Email {
    id: string;
    sender: string;
    subject: string;
    snippet: string;
    htmlBody: string;
    date: string;
    isRead: boolean;
}

const mockEmails: Email[] = [
    {
        id: '1',
        sender: 'John Doe <john@example.com>',
        subject: 'Project Update',
        snippet: 'Here is the latest update on the project.',
        htmlBody: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Project Update</h2>
                <p>Hi team,</p>
                <p>Here is the latest update on the SabNode project. We have successfully completed phase 1.</p>
                <br/>
                <button style="background: blue; color: white; padding: 10px; border: none; border-radius: 4px;">View Report</button>
                <br/><br/>
                <p>Thanks,<br/>John</p>
            </div>
        `,
        date: '10:30 AM',
        isRead: false,
    },
    {
        id: '2',
        sender: 'Jane Smith <jane@example.com>',
        subject: 'Weekly Newsletter',
        snippet: 'Catch up on all the news from this week.',
        htmlBody: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9;">
                <h1 style="color: #ff5722;">Weekly Newsletter</h1>
                <p>Catch up on all the news from this week!</p>
                <ul>
                    <li>Feature A launched</li>
                    <li>Bug fixes for Module B</li>
                </ul>
                <a href="#" style="color: #ff5722;">Read more on our blog</a>
            </div>
        `,
        date: 'Yesterday',
        isRead: true,
    },
    {
        id: '3',
        sender: 'Support <support@sabnode.com>',
        subject: 'Your ticket has been updated',
        snippet: 'We have resolved your issue.',
        htmlBody: `
            <div style="font-family: sans-serif;">
                <p>Your ticket #12345 has been marked as <strong>Resolved</strong>.</p>
                <p>If you have any further questions, please reply to this email.</p>
                <p>Best,<br/>SabNode Support</p>
            </div>
        `,
        date: 'May 12',
        isRead: true,
    },
];

const mockTemplates = [
    { id: '1', name: 'Welcome Email', subject: 'Welcome to SabNode!', lastUpdated: 'May 10' },
    { id: '2', name: 'Follow Up', subject: 'Checking in regarding our last meeting', lastUpdated: 'May 15' },
    { id: '3', name: 'Invoice Overdue', subject: 'Action Required: Unpaid Invoice', lastUpdated: 'May 20' },
];

const mockAnalytics = [
    { id: '1', campaign: 'Q2 Newsletter', sent: 1500, opens: 840, clicks: 320 },
    { id: '2', campaign: 'Product Launch', sent: 3000, opens: 2100, clicks: 1050 },
    { id: '3', campaign: 'Re-engagement', sent: 500, opens: 120, clicks: 45 },
];

export function EmailClient() {
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'success'>('idle');

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 1500);
    };

    const handleTestConnection = () => {
        setConnectionState('connecting');
        setTimeout(() => setConnectionState('success'), 1000);
        setTimeout(() => setConnectionState('idle'), 3000);
    };

    const renderInbox = () => {
        return (
            <div className="flex h-full w-full bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                {/* Email List (Left Pane) */}
                <div className="w-1/3 border-r border-[var(--st-border)] flex flex-col bg-[var(--st-bg)]">
                    <div className="p-4 border-b border-[var(--st-border)] flex items-center justify-between">
                        <h2 className="font-semibold text-[var(--st-text)]">Inbox</h2>
                        <IconButton
                            label="Sync inbox"
                            icon={RefreshCw}
                            variant="ghost"
                            size="sm"
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={isSyncing ? 'is-loading' : undefined}
                        />
                    </div>
                    <div className="p-3 border-b border-[var(--st-border)]">
                        <Field>
                            <Input
                                placeholder="Search emails."
                                aria-label="Search emails"
                                iconLeft={Search}
                            />
                        </Field>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {mockEmails.map((email) => (
                            <div
                                key={email.id}
                                role="button"
                                tabIndex={0}
                                aria-pressed={selectedEmail?.id === email.id}
                                onClick={() => setSelectedEmail(email)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedEmail(email);
                                    }
                                }}
                                className={`w-full text-left p-4 border-b border-[var(--st-border)] cursor-pointer hover:bg-[var(--st-bg-muted)] transition-colors ${selectedEmail?.id === email.id ? 'bg-[var(--st-bg-secondary)]' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[14px] truncate pr-2 text-[var(--st-text)] ${!email.isRead ? 'font-bold' : 'font-medium'}`}>
                                        {email.sender.split(' ')[0]}
                                    </span>
                                    <span className="text-[12px] text-[var(--st-text-secondary)] whitespace-nowrap">{email.date}</span>
                                </div>
                                <div className={`text-[13px] truncate mb-1 text-[var(--st-text)] ${!email.isRead ? 'font-semibold' : ''}`}>
                                    {email.subject}
                                </div>
                                <div className="text-[13px] text-[var(--st-text-secondary)] truncate">
                                    {email.snippet}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Email Detail (Right Pane) */}
                <div className="w-2/3 flex flex-col bg-[var(--st-bg)]">
                    {selectedEmail ? (
                        <>
                            <div className="p-4 border-b border-[var(--st-border)] flex justify-between items-center">
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" iconLeft={Archive}>Archive</Button>
                                    <Button variant="outline" size="sm" iconLeft={Trash}>Delete</Button>
                                </div>
                                <div className="flex gap-2">
                                    <IconButton label="Star email" icon={Star} variant="outline" size="sm" />
                                    <Button variant="outline" size="sm" iconLeft={Send}>Reply</Button>
                                </div>
                            </div>
                            <div className="p-6 border-b border-[var(--st-border)]">
                                <h1 className="text-xl font-semibold text-[var(--st-text)] mb-4">{selectedEmail.subject}</h1>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center">
                                            <User className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-medium text-[var(--st-text)]">{selectedEmail.sender}</div>
                                            <div className="text-[12px] text-[var(--st-text-secondary)]">to me</div>
                                        </div>
                                    </div>
                                    <div className="text-[12px] text-[var(--st-text-secondary)]">{selectedEmail.date}</div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-6">
                                {/* Safe Sandboxing using iframe srcDoc */}
                                <iframe
                                    srcDoc={selectedEmail.htmlBody}
                                    className="w-full h-full border-none"
                                    title="Email Content"
                                    sandbox="allow-popups"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <EmptyState
                                icon={Mail}
                                title="Select an email to view"
                                description="Choose a message from the list to read it here."
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTemplates = () => (
        <div className="p-6 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] h-full">
            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <PageTitle>Email Templates</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Button size="sm" iconLeft={Plus}>New Template</Button>
                </PageActions>
            </PageHeader>
            <div className="grid gap-4 mt-4">
                {mockTemplates.map((template) => (
                    <Card
                        key={template.id}
                        variant="interactive"
                        className="flex justify-between items-center"
                    >
                        <div>
                            <div className="font-medium text-[var(--st-text)] mb-1">{template.name}</div>
                            <div className="text-[13px] text-[var(--st-text-secondary)]">Subject: {template.subject}</div>
                        </div>
                        <div className="text-[12px] text-[var(--st-text-secondary)]">
                            Updated {template.lastUpdated}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );

    const renderAnalytics = () => (
        <div className="p-6 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] h-full">
            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <PageTitle>Open/Click Tracking Analytics</PageTitle>
                    <PageDescription>Track the performance of your sent emails and campaigns.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid grid-cols-3 gap-4 mt-4 mb-8">
                <StatCard label="Total Sent" value="5,000" />
                <StatCard label="Avg. Open Rate" value="61.2%" />
                <StatCard label="Avg. Click Rate" value="28.3%" />
            </div>

            <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                <Table>
                    <THead>
                        <Tr>
                            <Th>Campaign</Th>
                            <Th align="right">Sent</Th>
                            <Th align="right">Opens</Th>
                            <Th align="right">Clicks</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {mockAnalytics.map((stat) => (
                            <Tr key={stat.id}>
                                <Td className="font-medium">{stat.campaign}</Td>
                                <Td align="right">{stat.sent.toLocaleString()}</Td>
                                <Td align="right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Eye className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                        {stat.opens.toLocaleString()} ({((stat.opens / stat.sent) * 100).toFixed(1)}%)
                                    </div>
                                </Td>
                                <Td align="right">
                                    <div className="flex items-center justify-end gap-2">
                                        <MousePointerClick className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                        {stat.clicks.toLocaleString()} ({((stat.clicks / stat.sent) * 100).toFixed(1)}%)
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="p-6 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] h-full w-full">
            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <PageTitle>IMAP/SMTP Settings</PageTitle>
                    <PageDescription>Configure your email provider to sync inbox and send emails.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="space-y-6 mt-4">
                <div className="space-y-4">
                    <h3 className="text-[14px] font-semibold text-[var(--st-text)] flex items-center gap-2">
                        <Inbox className="h-4 w-4" aria-hidden="true" /> Incoming Mail (IMAP)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Host">
                            <Input defaultValue="imap.gmail.com" />
                        </Field>
                        <Field label="Port">
                            <Input defaultValue="993" />
                        </Field>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[14px] font-semibold text-[var(--st-text)] flex items-center gap-2">
                        <Send className="h-4 w-4" aria-hidden="true" /> Outgoing Mail (SMTP)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Host">
                            <Input defaultValue="smtp.gmail.com" />
                        </Field>
                        <Field label="Port">
                            <Input defaultValue="465" />
                        </Field>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[14px] font-semibold text-[var(--st-text)]">Credentials</h3>
                    <div className="space-y-3">
                        <Field label="Email Address">
                            <Input defaultValue="user@sabnode.com" />
                        </Field>
                        <Field label="Password / App Password">
                            <Input type="password" defaultValue="********" />
                        </Field>
                    </div>
                </div>

                <Button
                    block
                    className="mt-4"
                    onClick={handleTestConnection}
                    disabled={connectionState !== 'idle'}
                    loading={connectionState === 'connecting'}
                >
                    {connectionState === 'idle' && 'Test & Save Connection'}
                    {connectionState === 'connecting' && 'Connecting.'}
                    {connectionState === 'success' && 'Connected Successfully'}
                </Button>
            </div>
        </div>
    );

    return (
        <Tabs defaultValue="inbox" className="flex flex-col h-[800px]">
            <TabsList className="mb-6">
                <TabsTrigger value="inbox">
                    <span className="flex items-center gap-2">
                        <Inbox className="h-4 w-4" aria-hidden="true" />
                        Inbox
                    </span>
                </TabsTrigger>
                <TabsTrigger value="templates">
                    <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Templates
                    </span>
                </TabsTrigger>
                <TabsTrigger value="analytics">
                    <span className="flex items-center gap-2">
                        <BarChart className="h-4 w-4" aria-hidden="true" />
                        Analytics
                    </span>
                </TabsTrigger>
                <TabsTrigger value="settings">
                    <span className="flex items-center gap-2">
                        <Settings className="h-4 w-4" aria-hidden="true" />
                        Sync Settings
                    </span>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="inbox" className="flex-1 min-h-0">
                {renderInbox()}
            </TabsContent>
            <TabsContent value="templates" className="flex-1 min-h-0">
                {renderTemplates()}
            </TabsContent>
            <TabsContent value="analytics" className="flex-1 min-h-0">
                {renderAnalytics()}
            </TabsContent>
            <TabsContent value="settings" className="flex-1 min-h-0">
                {renderSettings()}
            </TabsContent>
        </Tabs>
    );
}
