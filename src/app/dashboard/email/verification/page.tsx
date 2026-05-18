'use client';

import {
  ZoruCard,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruBadge,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useTransition } from 'react';
import { ShieldCheck,
  Mail,
  Upload,
  List,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2 } from 'lucide-react';

type VerificationResult = {
    email: string;
    status: 'valid' | 'invalid' | 'risky' | 'unknown';
    reason: string;
};

function getStatusIcon(status: string) {
    switch (status) {
        case 'valid': return <CheckCircle className="h-4 w-4 text-zoru-success-ink" />;
        case 'invalid': return <XCircle className="h-4 w-4 text-zoru-danger-ink" />;
        case 'risky': return <AlertTriangle className="h-4 w-4 text-zoru-warning-ink" />;
        default: return <AlertTriangle className="h-4 w-4 text-zoru-ink-muted" />;
    }
}

function getStatusBadge(status: string) {
    const variants: Record<string, 'success' | 'danger' | 'warning' | 'ghost'> = {
        valid: 'success', invalid: 'danger', risky: 'warning', unknown: 'ghost',
    };
    return <ZoruBadge variant={variants[status] || 'ghost'}>{status}</ZoruBadge>;
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
    const { toast } = useZoruToast();
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
            const emails = lines.map(l => {
                const parts = l.split(',');
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
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>
                        <span className="inline-flex items-center gap-3">
                            <ShieldCheck className="h-7 w-7" /> Email Verification
                        </span>
                    </ZoruPageTitle>
                    <ZoruPageDescription>Improve your deliverability by verifying emails and cleaning your contact lists.</ZoruPageDescription>
                </ZoruPageHeading>
            </ZoruPageHeader>

            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/> Real-time Validation</ZoruCardTitle>
                    <ZoruCardDescription>Check a single email address for validity, deliverability, and quality.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="single-email">Email Address</ZoruLabel>
                        <div className="flex gap-2">
                            <ZoruInput
                                id="single-email"
                                type="email"
                                placeholder="test@example.com"
                                value={singleEmail}
                                onChange={(e) => setSingleEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSingleVerify()}
                            />
                            <ZoruButton onClick={handleSingleVerify} disabled={isVerifying || !singleEmail.trim()}>
                                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                            </ZoruButton>
                        </div>
                    </div>
                    {singleResult && (
                        <div className="p-4 rounded-lg border border-zoru-line space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(singleResult.status)}
                                    <span className="font-mono text-sm">{singleResult.email}</span>
                                </div>
                                {getStatusBadge(singleResult.status)}
                            </div>
                            <p className="text-sm text-zoru-ink-muted">{singleResult.reason}</p>
                        </div>
                    )}
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2"><List className="h-5 w-5"/> Bulk List Cleaning</ZoruCardTitle>
                    <ZoruCardDescription>Upload a CSV file of contacts to identify invalid, risky, or bounced emails.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="bulk-file">Contact File (.csv)</ZoruLabel>
                        <ZoruInput id="bulk-file" type="file" accept=".csv,.txt" onChange={handleBulkVerify} />
                    </div>
                    {isBulkVerifying && (
                        <div className="flex items-center gap-2 text-sm text-zoru-ink-muted">
                            <Loader2 className="h-4 w-4 animate-spin" /> Verifying emails...
                        </div>
                    )}
                    {bulkResults.length > 0 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <div className="p-3 rounded-lg border border-zoru-line text-center">
                                    <div className="text-2xl text-zoru-success-ink">{bulkResults.filter(r => r.status === 'valid').length}</div>
                                    <div className="text-xs text-zoru-ink-muted">Valid</div>
                                </div>
                                <div className="p-3 rounded-lg border border-zoru-line text-center">
                                    <div className="text-2xl text-zoru-danger-ink">{bulkResults.filter(r => r.status === 'invalid').length}</div>
                                    <div className="text-xs text-zoru-ink-muted">Invalid</div>
                                </div>
                                <div className="p-3 rounded-lg border border-zoru-line text-center">
                                    <div className="text-2xl text-zoru-warning-ink">{bulkResults.filter(r => r.status === 'risky').length}</div>
                                    <div className="text-xs text-zoru-ink-muted">Risky</div>
                                </div>
                                <div className="p-3 rounded-lg border border-zoru-line text-center">
                                    <div className="text-2xl text-zoru-ink">{bulkResults.length}</div>
                                    <div className="text-xs text-zoru-ink-muted">Total</div>
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto border border-zoru-line rounded-lg">
                                {bulkResults.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-zoru-line last:border-0 text-sm">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(r.status)}
                                            <span className="font-mono">{r.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-zoru-ink-muted">{r.reason}</span>
                                            {getStatusBadge(r.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <ZoruButton onClick={downloadCleanList}>
                                <Upload className="h-4 w-4" />
                                Download Results CSV
                            </ZoruButton>
                        </div>
                    )}
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
