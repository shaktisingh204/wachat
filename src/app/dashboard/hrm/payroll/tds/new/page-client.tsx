'use client';

import { useState, useEffect } from 'react';
import { Tabs, ZoruTabsContent, ZoruTabsList, ZoruTabsTrigger } from '@/components/zoruui';
import { TdsForm } from '../_components/tds-form';
import { Users } from 'lucide-react';
import { BulkUpload } from './components/bulk-upload';

export function NewTdsClient() {
    const [activeTab, setActiveTab] = useState('single');
    const [activeUsers, setActiveUsers] = useState<number>(1);
    
    // Simulate real-time WebSocket connection for collaborative editing
    useEffect(() => {
        let mounted = true;
        const interval = setInterval(() => {
            if (mounted) {
                setActiveUsers(Math.floor(Math.random() * 3) + 1);
            }
        }, 15000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    // Date formatting to prevent hydration mismatches
    const [currentDate, setCurrentDate] = useState<string>('');
    useEffect(() => {
        setCurrentDate(new Date().toLocaleDateString());
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">New TDS Record</h2>
                    <p className="text-zoru-ink-muted">
                        Record TDS for an employee or upload in bulk. {currentDate && `Today is ${currentDate}.`}
                    </p>
                </div>
                <div className="flex items-center space-x-2 text-sm text-zoru-ink-muted bg-zoru-surface-2/50 px-3 py-1.5 rounded-full border">
                    <span className="flex h-2 w-2 rounded-full bg-zoru-success animate-pulse" />
                    <span>{activeUsers} user(s) currently viewing</span>
                    <Users className="h-4 w-4 ml-1" />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <ZoruTabsList>
                    <ZoruTabsTrigger value="single">Single Entry</ZoruTabsTrigger>
                    <ZoruTabsTrigger value="bulk">Bulk Upload</ZoruTabsTrigger>
                </ZoruTabsList>

                <ZoruTabsContent value="single" className="space-y-4">
                    <TdsForm />
                </ZoruTabsContent>

                <ZoruTabsContent value="bulk" className="space-y-4">
                    <BulkUpload />
                </ZoruTabsContent>
            </Tabs>
        </div>
    );
}
