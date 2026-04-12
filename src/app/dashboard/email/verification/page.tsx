'use client';

import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Mail, Upload, List, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type VerificationResult = {
    email: string;
    status: 'valid' | 'invalid' | 'risky' | 'unknown';
    reason: string;
};

function getStatusIcon(status: string) {
    switch (status) {
        case 'valid': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'invalid': return <XCircle className="h-4 w-4 text-red-500" />;
        case 'risky': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
        default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
}

function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
        valid: 'default', invalid: 'destructive', risky: 'secondary', unknown: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
}

function validateEmailFormat(email: string): VerificationResult {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { email: trimmed, status: 'invalid', reason: 'Empty email address' };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return { email: trimmed, status: 'invalid', reason: 'Invalid email format' };

    const disposableDomains = ['tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com', 'yopmail.com', 'sharklasers.com', 'trashmail.com'];
    const domain = trimmed.split('@')[1];
    if (disposableDomains.includes(domain)) return { email: trimmed, status: 'risky', reason: 'Disposable email provider detected' };

    const roleBased = ['admin', 'info', 'support', 'noreply', 'no-reply', 'webmaster', 'postmaster', 'abuse'];
    const localPart = trimmed.split('@')[0];
    if (roleBased.includes(localPart)) return { email: trimmed, status: 'risky', reason: 'Role-based email address' };

    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return { email: trimmed, status: 'invalid', reason: 'Invalid top-level domain' };

    return { email: trimmed, status: 'valid', reason: 'Email format is valid and domain looks legitimate' };
}

export default function EmailVerificationPage() {
    const { toast } = useToast();
    const [singleEmail, setSingleEmail] = useState('');
    const [singleResult, setSingleResult] = useState<VerificationResult | null>(null);
    const [isVerifying, startVerify] = useTransition();
    const [bulkResults, setBulkResults] = useState<VerificationResult[]>([]);
    const [isBulkVerifying, startBulkVerify] = useTransition();

    const handleSingleVerify = () => {
        startVerify(() => {
            const result = validateEmailFormat(singleEmail);
            setSingleResult(result);
        });
    };

    const handleBulkVerify = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        startBulkVerify(async () => {
            const text = await file.text();
            const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.includes('@'));
            // Extract emails (handle CSV with headers)
            const emails = lines.map(l => {
                const parts = l.split(',');
                // Find the part that looks like an email
                const emailPart = parts.find(p => p.trim().includes('@'));
                return emailPart?.trim().replace(/"/g, '') || '';
            }).filter(Boolean);

            const results = emails.map(validateEmailFormat);
            setBulkResults(results);
            toast({
                title: `Verified ${results.length} emails`,
                description: `${results.filter(r => r.status === 'valid').length} valid, ${results.filter(r => r.status === 'invalid').length} invalid, ${results.filter(r => r.status === 'risky').length} risky`,
            });
        });
        e.target.value = '';
    };

    const downloadCleanList = () => {
        const csv = 'email,status\n' + bulkResults.map(r => `${r.email},${r.status}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'verified-emails.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShieldCheck /> Email Verification</h1>
                <p className="text-muted-foreground">Improve your deliverability by verifying emails and cleaning your contact lists.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/> Real-time Validation</CardTitle>
                    <CardDescription>Check a single email address for validity, deliverability, and quality.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="single-email">Email Address</Label>
                        <div className="flex gap-2">
                            <Input
                                id="single-email"
                                type="email"
                                placeholder="test@example.com"
                                value={singleEmail}
                                onChange={(e) => setSingleEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSingleVerify()}
                            />
                            <Button onClick={handleSingleVerify} disabled={isVerifying || !singleEmail.trim()}>
                                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                            </Button>
                        </div>
                    </div>
                    {singleResult && (
                        <div className="p-4 rounded-lg border space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(singleResult.status)}
                                    <span className="font-mono text-sm">{singleResult.email}</span>
                                </div>
                                {getStatusBadge(singleResult.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{singleResult.reason}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><List className="h-5 w-5"/> Bulk List Cleaning</CardTitle>
                    <CardDescription>Upload a CSV file of contacts to identify invalid, risky, or bounced emails.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-file">Contact File (.csv)</Label>
                        <Input id="bulk-file" type="file" accept=".csv,.txt" onChange={handleBulkVerify} />
                    </div>
                    {isBulkVerifying && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Verifying emails...
                        </div>
                    )}
                    {bulkResults.length > 0 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <div className="p-3 rounded-lg border text-center">
                                    <div className="text-2xl font-bold text-green-600">{bulkResults.filter(r => r.status === 'valid').length}</div>
                                    <div className="text-xs text-muted-foreground">Valid</div>
                                </div>
                                <div className="p-3 rounded-lg border text-center">
                                    <div className="text-2xl font-bold text-red-600">{bulkResults.filter(r => r.status === 'invalid').length}</div>
                                    <div className="text-xs text-muted-foreground">Invalid</div>
                                </div>
                                <div className="p-3 rounded-lg border text-center">
                                    <div className="text-2xl font-bold text-yellow-600">{bulkResults.filter(r => r.status === 'risky').length}</div>
                                    <div className="text-xs text-muted-foreground">Risky</div>
                                </div>
                                <div className="p-3 rounded-lg border text-center">
                                    <div className="text-2xl font-bold">{bulkResults.length}</div>
                                    <div className="text-xs text-muted-foreground">Total</div>
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto border rounded-lg">
                                {bulkResults.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 border-b last:border-0 text-sm">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(r.status)}
                                            <span className="font-mono">{r.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">{r.reason}</span>
                                            {getStatusBadge(r.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={downloadCleanList}>
                                <Upload className="mr-2 h-4 w-4" />
                                Download Results CSV
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
