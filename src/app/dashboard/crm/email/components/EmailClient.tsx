'use client';

import React, { useState } from 'react';
import { Mail, Inbox, FileText, BarChart, Settings, Search, RefreshCw, Eye, MousePointerClick, Send, Star, Trash, Archive, User, Plus, X } from 'lucide-react';
import { Button, Card, Input } from '@/components/zoruui';

type TabType = 'inbox' | 'templates' | 'analytics' | 'settings';

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
        snippet: 'Here is the latest update on the project...',
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
    }
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
    const [activeTab, setActiveTab] = useState<TabType>('inbox');
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 1500);
    };

    const renderInbox = () => {
        return (
            <div className="flex h-full w-full bg-zoru-background border border-zoru-border rounded-lg overflow-hidden">
                {/* Email List (Left Pane) */}
                <div className="w-1/3 border-r border-zoru-border flex flex-col bg-white">
                    <div className="p-4 border-b border-zoru-border flex items-center justify-between">
                        <h2 className="font-semibold text-zoru-ink">Inbox</h2>
                        <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing}>
                            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <div className="p-3 border-b border-zoru-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
                            <Input placeholder="Search emails..." className="pl-9 h-9" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {mockEmails.map(email => (
                            <div 
                                key={email.id} 
                                onClick={() => setSelectedEmail(email)}
                                className={`p-4 border-b border-zoru-border cursor-pointer hover:bg-zoru-surface-2 transition-colors ${selectedEmail?.id === email.id ? 'bg-zoru-surface' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-medium text-[14px] truncate pr-2 ${!email.isRead ? 'text-zoru-ink font-bold' : 'text-zoru-ink'}`}>
                                        {email.sender.split(' ')[0]}
                                    </span>
                                    <span className="text-[12px] text-zoru-ink-muted whitespace-nowrap">{email.date}</span>
                                </div>
                                <div className={`text-[13px] truncate mb-1 ${!email.isRead ? 'text-zoru-ink font-semibold' : 'text-zoru-ink'}`}>
                                    {email.subject}
                                </div>
                                <div className="text-[13px] text-zoru-ink-muted truncate">
                                    {email.snippet}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Email Detail (Right Pane) */}
                <div className="w-2/3 flex flex-col bg-white">
                    {selectedEmail ? (
                        <>
                            <div className="p-4 border-b border-zoru-border flex justify-between items-center bg-white">
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm"><Archive className="h-4 w-4 mr-1" /> Archive</Button>
                                    <Button variant="outline" size="sm"><Trash className="h-4 w-4 mr-1" /> Delete</Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm"><Star className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm"><Send className="h-4 w-4 mr-1" /> Reply</Button>
                                </div>
                            </div>
                            <div className="p-6 border-b border-zoru-border">
                                <h1 className="text-xl font-semibold text-zoru-ink mb-4">{selectedEmail.subject}</h1>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-zoru-surface-2 flex items-center justify-center">
                                            <User className="h-5 w-5 text-zoru-ink-muted" />
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-medium text-zoru-ink">{selectedEmail.sender}</div>
                                            <div className="text-[12px] text-zoru-ink-muted">to me</div>
                                        </div>
                                    </div>
                                    <div className="text-[12px] text-zoru-ink-muted">{selectedEmail.date}</div>
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
                        <div className="flex-1 flex flex-col items-center justify-center text-zoru-ink-muted">
                            <Mail className="h-12 w-12 mb-4 opacity-20" />
                            <p>Select an email to view</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTemplates = () => (
        <div className="p-6 bg-white border border-zoru-border rounded-lg h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-zoru-ink">Email Templates</h2>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Template</Button>
            </div>
            <div className="grid gap-4">
                {mockTemplates.map(template => (
                    <Card key={template.id} className="p-4 flex justify-between items-center hover:border-zoru-brand transition-colors cursor-pointer">
                        <div>
                            <div className="font-medium text-zoru-ink mb-1">{template.name}</div>
                            <div className="text-[13px] text-zoru-ink-muted">Subject: {template.subject}</div>
                        </div>
                        <div className="text-[12px] text-zoru-ink-muted">
                            Updated {template.lastUpdated}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );

    const renderAnalytics = () => (
        <div className="p-6 bg-white border border-zoru-border rounded-lg h-full">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-zoru-ink mb-1">Open/Click Tracking Analytics</h2>
                <p className="text-[13px] text-zoru-ink-muted">Track the performance of your sent emails and campaigns.</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
                <Card className="p-4">
                    <div className="text-[13px] text-zoru-ink-muted mb-2">Total Sent</div>
                    <div className="text-2xl font-semibold text-zoru-ink">5,000</div>
                </Card>
                <Card className="p-4">
                    <div className="text-[13px] text-zoru-ink-muted mb-2">Avg. Open Rate</div>
                    <div className="text-2xl font-semibold text-zoru-ink">61.2%</div>
                </Card>
                <Card className="p-4">
                    <div className="text-[13px] text-zoru-ink-muted mb-2">Avg. Click Rate</div>
                    <div className="text-2xl font-semibold text-zoru-ink">28.3%</div>
                </Card>
            </div>

            <div className="border border-zoru-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-[14px]">
                    <thead className="bg-zoru-surface-2 border-b border-zoru-border">
                        <tr>
                            <th className="p-3 font-medium text-zoru-ink-muted">Campaign</th>
                            <th className="p-3 font-medium text-zoru-ink-muted text-right">Sent</th>
                            <th className="p-3 font-medium text-zoru-ink-muted text-right">Opens</th>
                            <th className="p-3 font-medium text-zoru-ink-muted text-right">Clicks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zoru-border bg-white">
                        {mockAnalytics.map(stat => (
                            <tr key={stat.id}>
                                <td className="p-3 text-zoru-ink font-medium">{stat.campaign}</td>
                                <td className="p-3 text-zoru-ink text-right">{stat.sent.toLocaleString()}</td>
                                <td className="p-3 text-zoru-ink text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Eye className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                        {stat.opens.toLocaleString()} ({(stat.opens/stat.sent*100).toFixed(1)}%)
                                    </div>
                                </td>
                                <td className="p-3 text-zoru-ink text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <MousePointerClick className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                        {stat.clicks.toLocaleString()} ({(stat.clicks/stat.sent*100).toFixed(1)}%)
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="p-6 bg-white border border-zoru-border rounded-lg h-full max-w-2xl">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-zoru-ink mb-1">IMAP/SMTP Settings</h2>
                <p className="text-[13px] text-zoru-ink-muted">Configure your email provider to sync inbox and send emails.</p>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <h3 className="text-[14px] font-semibold text-zoru-ink flex items-center gap-2">
                        <Inbox className="h-4 w-4" /> Incoming Mail (IMAP)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[12px] font-medium text-zoru-ink-muted mb-1">Host</label>
                            <Input defaultValue="imap.gmail.com" />
                        </div>
                        <div>
                            <label className="block text-[12px] font-medium text-zoru-ink-muted mb-1">Port</label>
                            <Input defaultValue="993" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[14px] font-semibold text-zoru-ink flex items-center gap-2">
                        <Send className="h-4 w-4" /> Outgoing Mail (SMTP)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[12px] font-medium text-zoru-ink-muted mb-1">Host</label>
                            <Input defaultValue="smtp.gmail.com" />
                        </div>
                        <div>
                            <label className="block text-[12px] font-medium text-zoru-ink-muted mb-1">Port</label>
                            <Input defaultValue="465" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[14px] font-semibold text-zoru-ink">Credentials</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[12px] font-medium text-zoru-ink-muted mb-1">Email Address</label>
                            <Input defaultValue="user@sabnode.com" />
                        </div>
                        <div>
                            <label className="block text-[12px] font-medium text-zoru-ink-muted mb-1">Password / App Password</label>
                            <Input type="password" defaultValue="********" />
                        </div>
                    </div>
                </div>

                <Button className="w-full mt-4" onClick={() => {
                    const btn = document.activeElement as HTMLButtonElement;
                    const origText = btn.innerText;
                    btn.innerText = 'Connecting...';
                    setTimeout(() => btn.innerText = 'Connected Successfully', 1000);
                    setTimeout(() => btn.innerText = origText, 3000);
                }}>
                    Test & Save Connection
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[800px]">
            {/* Top Navigation */}
            <div className="flex border-b border-zoru-border mb-6 space-x-1">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'inbox' ? 'border-zoru-brand text-zoru-brand' : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'}`}
                >
                    <div className="flex items-center gap-2">
                        <Inbox className="h-4 w-4" />
                        Inbox
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'templates' ? 'border-zoru-brand text-zoru-brand' : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'}`}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Templates
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'analytics' ? 'border-zoru-brand text-zoru-brand' : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'}`}
                >
                    <div className="flex items-center gap-2">
                        <BarChart className="h-4 w-4" />
                        Analytics
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-zoru-brand text-zoru-brand' : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'}`}
                >
                    <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Sync Settings
                    </div>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {activeTab === 'inbox' && renderInbox()}
                {activeTab === 'templates' && renderTemplates()}
                {activeTab === 'analytics' && renderAnalytics()}
                {activeTab === 'settings' && renderSettings()}
            </div>
        </div>
    );
}
