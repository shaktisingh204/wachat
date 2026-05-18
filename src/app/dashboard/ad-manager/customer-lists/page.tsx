'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruTextarea,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import {
  UserPlus,
  Upload,
  AlertCircle } from 'lucide-react';

import * as React from 'react';

import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { createCustomAudience, addUsersToCustomAudience } from '@/app/actions/ad-manager.actions';
import { AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';

// SHA-256 hashing runs in the browser so raw PII never leaves the device.
async function sha256(input: string): Promise<string> {
    const norm = input.trim().toLowerCase();
    const buf = new TextEncoder().encode(norm);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function CustomerListsPage() {
    const { toast } = useToast();
    const { activeAccount } = useAdManager();
    const [name, setName] = React.useState('New customer list');
    const [csv, setCsv] = React.useState('');
    const [uploading, setUploading] = React.useState(false);

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    const allLines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const validEmails = allLines.filter(isValidEmail);
    const invalidCount = allLines.length - validEmails.length;

    const upload = async () => {
        if (!activeAccount) return;
        const lines = validEmails;
        if (lines.length === 0) {
            toast({ title: 'No valid emails found', description: 'Make sure each line has a valid email address.', variant: 'destructive' });
            return;
        }
        setUploading(true);
        try {
            // 1) Create audience
            const created = await createCustomAudience(activeAccount.account_id, {
                name,
                subtype: 'CUSTOM',
                customer_file_source: 'USER_PROVIDED_ONLY',
            });
            if (created.error || !(created.data as any)?.id) {
                throw new Error(created.error || 'Failed to create audience');
            }
            const audienceId = (created.data as any).id;

            // 2) Hash in-browser
            const hashed = await Promise.all(lines.map((email) => sha256(email).then((h) => [h])));

            // 3) Upload users
            const added = await addUsersToCustomAudience(audienceId, ['EMAIL'], hashed);
            if (added.error) throw new Error(added.error);

            toast({ title: 'Upload complete', description: `${hashed.length} emails hashed & uploaded.` });
            setCsv('');
        } catch (e: any) {
            toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    if (!activeAccount) {
        return (
            <div>
                <ZoruAlert>
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to upload customer lists.</ZoruAlertDescription>
                </ZoruAlert>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <AmBreadcrumb page="Customer Lists" />
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <UserPlus className="h-6 w-6" /> Customer list uploader
                    <ZoruBadge variant="success">Privacy-safe</ZoruBadge>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Upload emails to create a Custom Audience. Everything is SHA-256 hashed in your browser before
                    it ever touches the network.
                </p>
            </div>

            <ZoruAlert>
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Hashing happens on your device</ZoruAlertTitle>
                <ZoruAlertDescription>
                    Raw emails never leave your browser. Only hashed values are sent to Meta — Meta rehashes on their
                    end to match against their user graph without ever seeing the plaintext.
                </ZoruAlertDescription>
            </ZoruAlert>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle className="text-base">Upload</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-3">
                    <div className="space-y-2">
                        <ZoruLabel>Audience name</ZoruLabel>
                        <ZoruInput value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Emails (one per line)</ZoruLabel>
                        <ZoruTextarea
                            value={csv}
                            onChange={(e) => setCsv(e.target.value)}
                            placeholder={'jane@example.com\njohn@example.com\n…'}
                            className="min-h-64 font-mono text-xs"
                        />
                    </div>
                    {/* Valid email count display */}
                    {allLines.length > 0 && (
                        <div className="flex items-center gap-3 text-sm">
                            <ZoruBadge variant="success">{validEmails.length} valid email{validEmails.length !== 1 ? 's' : ''} ready to upload</ZoruBadge>
                            {invalidCount > 0 && (
                                <ZoruBadge variant="danger">{invalidCount} invalid</ZoruBadge>
                            )}
                        </div>
                    )}
                    <ZoruButton
                        className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                        onClick={upload}
                        disabled={uploading || validEmails.length === 0}
                    >
                        <Upload className="h-4 w-4 mr-1" />
                        {uploading ? 'Hashing & uploading…' : `Hash & upload${validEmails.length > 0 ? ` (${validEmails.length})` : ''}`}
                    </ZoruButton>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
