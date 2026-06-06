'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Alert,
  AlertTitle,
  AlertDescription,
  EmptyState,
  Badge,
  Textarea,
  Input,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import {
  UserPlus,
  Upload,
  AlertCircle } from 'lucide-react';

import * as React from 'react';
import Papa from 'papaparse';

import { useAdManager } from '@/context/ad-manager-context';
import { createCustomAudience, addUsersToCustomAudience } from '@/app/actions/ad-manager.actions';
import { AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';

// Fallback for non-worker environments if needed, but we'll use a Web Worker for bulk hashing
async function sha256(input: string): Promise<string> {
    const norm = input.trim().toLowerCase();
    const buf = new TextEncoder().encode(norm);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Web Worker code as a string to avoid Next.js compilation issues with standard workers
const workerCode = `
async function sha256Worker(input) {
    const norm = input.trim().toLowerCase();
    const buf = new TextEncoder().encode(norm);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

self.onmessage = async function(e) {
    const { chunk, type } = e.data;
    const hashedChunk = [];
    for (const item of chunk) {
        if (type === 'EMAIL') {
            hashedChunk.push([await sha256Worker(item.email)]);
        } else if (type === 'PHONE') {
            // Clean phone number (remove non-digits, ensuring it has country code if possible)
            const cleanPhone = item.phone.replace(/\\D/g, '');
            hashedChunk.push([await sha256Worker(cleanPhone)]);
        } else if (type === 'EMAIL_LTV') {
            hashedChunk.push([await sha256Worker(item.email), item.value]);
        }
    }
    self.postMessage({ hashedChunk });
};
`;

export default function CustomerListsPage() {
    const { toast } = useToast();
    const { activeAccount } = useAdManager();

    // Form state
    const [name, setName] = React.useState('New customer list');
    const [csv, setCsv] = React.useState('');
    const [audienceType, setAudienceType] = React.useState<'EMAIL' | 'PHONE' | 'EMAIL_LTV'>('EMAIL');

    // UI state
    const [uploading, setUploading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);

    // Refs for lifecycle
    const abortControllerRef = React.useRef<AbortController | null>(null);
    const workerRef = React.useRef<Worker | null>(null);

    // Initialize from sessionStorage on mount (Hydration safe)
    React.useEffect(() => {
        const savedName = sessionStorage.getItem('am_audience_name');
        const savedCsv = sessionStorage.getItem('am_audience_csv');
        const savedType = sessionStorage.getItem('am_audience_type') as any;
        if (savedName) setName(savedName);
        if (savedCsv) setCsv(savedCsv);
        if (savedType) setAudienceType(savedType);
    }, []);

    // Sync to sessionStorage
    React.useEffect(() => {
        sessionStorage.setItem('am_audience_name', name);
    }, [name]);

    React.useEffect(() => {
        sessionStorage.setItem('am_audience_csv', csv);
    }, [csv]);

    React.useEffect(() => {
        sessionStorage.setItem('am_audience_type', audienceType);
    }, [audienceType]);

    // Cleanup worker and upload on unmount
    React.useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const isValidPhone = (phone: string) => phone.replace(/\D/g, '').length >= 10;

    // Parse current textarea content based on selected type
    const parsedLines = React.useMemo(() => {
        const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (audienceType === 'EMAIL') {
            return lines.map(l => ({ email: l, valid: isValidEmail(l) }));
        } else if (audienceType === 'PHONE') {
            return lines.map(l => ({ phone: l, valid: isValidPhone(l) }));
        } else {
            return lines.map(l => {
                const parts = l.split(',');
                const email = parts[0]?.trim() || '';
                const value = parseFloat(parts[1]?.trim() || '0');
                return { email, value, valid: isValidEmail(email) && !isNaN(value) };
            });
        }
    }, [csv, audienceType]);

    const validItems = parsedLines.filter(l => l.valid);
    const invalidCount = parsedLines.length - validItems.length;

    const handleFileUpload = (file: File) => {
        Papa.parse(file, {
            skipEmptyLines: true,
            header: true,
            complete: (results) => {
                let extractedText = '';
                const rows = results.data as any[];
                if (rows.length === 0) return;

                if (audienceType === 'EMAIL') {
                    extractedText = rows.map(r => r.email || r.Email || r.EMAIL || Object.values(r)[0]).filter(Boolean).join('\n');
                } else if (audienceType === 'PHONE') {
                    extractedText = rows.map(r => r.phone || r.Phone || r.PHONE || Object.values(r)[0]).filter(Boolean).join('\n');
                } else if (audienceType === 'EMAIL_LTV') {
                    extractedText = rows.map(r => {
                        const email = r.email || r.Email || r.EMAIL || Object.values(r)[0];
                        const value = r.value || r.Value || r.VALUE || Object.values(r)[1] || '0';
                        return email ? `${email},${value}` : '';
                    }).filter(Boolean).join('\n');
                }

                if (extractedText) {
                    setCsv(prev => prev ? `${prev}\n${extractedText}` : extractedText);
                    toast({ title: 'CSV loaded', description: 'Data extracted to the input area.', tone: 'success' });
                } else {
                    toast({ title: 'No valid data', description: 'Could not extract valid data from the CSV.', tone: 'danger' });
                }
            },
            error: (err) => {
                toast({ title: 'CSV error', description: err.message, tone: 'danger' });
            }
        });
    };

    const upload = async () => {
        if (!activeAccount) return;
        const items = validItems;
        if (items.length === 0) {
            toast({ title: 'No valid data found', description: 'Make sure each line has valid data.', tone: 'danger' });
            return;
        }

        // Setup abort controller for this upload
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const signal = abortController.signal;

        setUploading(true);
        setProgress(0);

        try {
            // 1) Create audience
            const isLtv = audienceType === 'EMAIL_LTV';
            const created = await createCustomAudience(activeAccount.account_id, {
                name,
                subtype: 'CUSTOM',
                customer_file_source: 'USER_PROVIDED_ONLY',
                is_value_based: isLtv ? 1 : 0
            });
            if (signal.aborted) throw new Error('Upload aborted');

            if (created.error || !(created.data as any)?.id) {
                throw new Error(created.error || 'Failed to create audience');
            }
            const audienceId = (created.data as any).id;

            // 2) Hash using Web Worker
            if (workerRef.current) {
                workerRef.current.terminate();
            }
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);
            workerRef.current = worker;

            const hashed: any[][] = [];
            const chunkSize = 5000;

            for (let i = 0; i < items.length; i += chunkSize) {
                if (signal.aborted) {
                    worker.terminate();
                    workerRef.current = null;
                    throw new Error('Upload aborted');
                }

                const chunk = items.slice(i, i + chunkSize);
                const hashedChunk = await new Promise<any[][]>((resolve, reject) => {
                    worker.onmessage = (e) => resolve(e.data.hashedChunk);
                    worker.onerror = (e) => reject(new Error('Worker error: ' + e.message));

                    // Abort handling during worker operation
                    signal.addEventListener('abort', () => {
                        worker.terminate();
                        workerRef.current = null;
                        reject(new Error('Upload aborted'));
                    });

                    worker.postMessage({ chunk, type: audienceType });
                });
                hashed.push(...hashedChunk);
                setProgress(Math.round(((i + chunk.length) / items.length) * 100));
            }

            worker.terminate();
            workerRef.current = null;
            URL.revokeObjectURL(workerUrl);

            // 3) Upload users
            if (signal.aborted) throw new Error('Upload aborted');

            const schema = isLtv ? ['EMAIL', 'LOOKALIKE_VALUE'] : [audienceType === 'PHONE' ? 'PHONE' : 'EMAIL'];
            const added = await addUsersToCustomAudience(audienceId, schema, hashed);

            if (signal.aborted) throw new Error('Upload aborted');
            if (added.error) throw new Error(added.error);

            toast({ title: 'Upload complete', description: `${hashed.length} items hashed and uploaded.`, tone: 'success' });

            // Success, clear state
            setCsv('');
            setName('New customer list');
            sessionStorage.removeItem('am_audience_csv');
            sessionStorage.removeItem('am_audience_name');
        } catch (e: any) {
            if (e.message !== 'Upload aborted') {
                toast({ title: 'Upload failed', description: e.message, tone: 'danger' });
            }
        } finally {
            if (!signal.aborted) {
                setUploading(false);
                setProgress(0);
            }
        }
    };

    if (!activeAccount) {
        return (
            <div className="max-w-3xl">
                <EmptyState
                    icon={AlertCircle}
                    title="No ad account selected"
                    description="Pick an ad account to upload customer lists."
                />
            </div>
        );
    }

    const dataTypeLabel =
        audienceType === 'EMAIL'
            ? 'Emails (one per line)'
            : audienceType === 'PHONE'
              ? 'Phone numbers (with country code, one per line)'
              : 'Email,Value (e.g. john@example.com,150.50)';

    return (
        <div className="space-y-6 max-w-3xl">
            <AmBreadcrumb page="Customer Lists" />

            <PageHeader bordered={false}>
                <PageHeaderHeading>
                    <PageTitle className="flex items-center gap-2">
                        <UserPlus className="h-6 w-6" aria-hidden="true" /> Customer list uploader
                        <Badge tone="success">Privacy-safe</Badge>
                    </PageTitle>
                    <PageDescription>
                        Upload {audienceType === 'PHONE' ? 'phone numbers' : 'emails'} to create a Custom Audience. Everything is SHA-256 hashed in your browser before it ever touches the network.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <Alert tone="info">
                <AlertTitle>Hashing happens on your device</AlertTitle>
                <AlertDescription>
                    Raw {audienceType === 'PHONE' ? 'phone numbers' : 'emails'} never leave your browser. Only hashed values are sent to Meta. Meta rehashes on their end to match against their user graph without ever seeing the plaintext.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                        Upload data
                        <SabFileToFileButton
                            accept="document"
                            variant="outline"
                            onPickFile={(file) => handleFileUpload(file)}
                            onError={(err) => toast({ title: 'CSV error', description: err.message, tone: 'danger' })}
                        >
                            Load from CSV
                        </SabFileToFileButton>
                    </CardTitle>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Field label="Audience name">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={uploading}
                                />
                            </Field>
                        </div>
                        <div className="w-1/3">
                            <Field label="Data type">
                                <Select
                                    value={audienceType}
                                    onValueChange={(v) => setAudienceType(v as 'EMAIL' | 'PHONE' | 'EMAIL_LTV')}
                                    disabled={uploading}
                                >
                                    <SelectTrigger aria-label="Data type">
                                        <SelectValue placeholder="Pick a data type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EMAIL">Email only</SelectItem>
                                        <SelectItem value="PHONE">Phone number only</SelectItem>
                                        <SelectItem value="EMAIL_LTV">Email with LTV</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                    </div>
                    <div
                        className={`relative rounded-[var(--st-radius)] transition-all ${isDragging ? 'ring-2 ring-[var(--st-accent)] bg-[var(--st-bg-secondary)]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); if (!uploading) setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (uploading) return;
                            const file = e.dataTransfer.files?.[0];
                            if (file && file.name.endsWith('.csv')) {
                                handleFileUpload(file);
                            } else {
                                toast({ title: 'Invalid file', description: 'Please drop a .csv file.', tone: 'danger' });
                            }
                        }}
                    >
                        <Field label={`${dataTypeLabel} or drag and drop a CSV here`}>
                            <Textarea
                                value={csv}
                                onChange={(e) => setCsv(e.target.value)}
                                disabled={uploading}
                                placeholder={
                                    audienceType === 'EMAIL' ? 'jane@example.com\njohn@example.com\n...' :
                                    audienceType === 'PHONE' ? '14155552671\n14155552672\n...' :
                                    'jane@example.com,100\njohn@example.com,250\n...'
                                }
                                className={`min-h-64 font-mono text-xs ${isDragging ? 'opacity-50 pointer-events-none' : ''}`}
                            />
                        </Field>
                        {isDragging && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="font-semibold text-[var(--st-text)] bg-[var(--st-bg)] border border-[var(--st-border)] px-4 py-2 rounded-full shadow-[var(--st-shadow)]">Drop CSV here</span>
                            </div>
                        )}
                    </div>

                    {parsedLines.length > 0 && (
                        <div className="flex items-center gap-3 text-sm">
                            <Badge tone="success">{validItems.length} valid item{validItems.length !== 1 ? 's' : ''} ready to upload</Badge>
                            {invalidCount > 0 && (
                                <Badge tone="danger">{invalidCount} invalid</Badge>
                            )}
                        </div>
                    )}

                    <Button
                        variant="primary"
                        iconLeft={Upload}
                        loading={uploading}
                        onClick={upload}
                        disabled={uploading || validItems.length === 0}
                    >
                        {uploading ? `Hashing and uploading... ${progress}%` : `Hash and upload${validItems.length > 0 ? ` (${validItems.length})` : ''}`}
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
