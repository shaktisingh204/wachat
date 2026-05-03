'use client';

import * as React from 'react';
import { UserPlus, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { createCustomAudience, addUsersToCustomAudience } from '@/app/actions/ad-manager.actions';

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
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to upload customer lists.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <UserPlus className="h-6 w-6" /> Customer list uploader
                    <Badge className="bg-green-600 text-white">Privacy-safe</Badge>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Upload emails to create a Custom Audience. Everything is SHA-256 hashed in your browser before
                    it ever touches the network.
                </p>
            </div>

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Hashing happens on your device</AlertTitle>
                <AlertDescription>
                    Raw emails never leave your browser. Only hashed values are sent to Meta — Meta rehashes on their
                    end to match against their user graph without ever seeing the plaintext.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Upload</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <Label>Audience name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Emails (one per line)</Label>
                        <Textarea
                            value={csv}
                            onChange={(e) => setCsv(e.target.value)}
                            placeholder={'jane@example.com\njohn@example.com\n…'}
                            className="min-h-64 font-mono text-xs"
                        />
                    </div>
                    {/* Valid email count display */}
                    {allLines.length > 0 && (
                        <div className="flex items-center gap-3 text-sm">
                            <Badge className="bg-green-600 text-white">{validEmails.length} valid email{validEmails.length !== 1 ? 's' : ''} ready to upload</Badge>
                            {invalidCount > 0 && (
                                <Badge variant="destructive">{invalidCount} invalid</Badge>
                            )}
                        </div>
                    )}
                    <Button
                        className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                        onClick={upload}
                        disabled={uploading || validEmails.length === 0}
                    >
                        <Upload className="h-4 w-4 mr-1" />
                        {uploading ? 'Hashing & uploading…' : `Hash & upload${validEmails.length > 0 ? ` (${validEmails.length})` : ''}`}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
