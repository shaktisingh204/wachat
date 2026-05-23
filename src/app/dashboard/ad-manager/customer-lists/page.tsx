'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Textarea,
  Input,
  Label,
} from '@/components/zoruui';
import {
  UserPlus,
  Upload,
  AlertCircle,
  FileText } from 'lucide-react';

import * as React from 'react';
import Papa from 'papaparse';

import { useToast } from '@/hooks/use-toast';
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
    const [name, setName] = React.useState('New customer list');
    const [csv, setCsv] = React.useState('');
    const [uploading, setUploading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [audienceType, setAudienceType] = React.useState<'EMAIL' | 'PHONE' | 'EMAIL_LTV'>('EMAIL');

    React.useEffect(() => {
        const savedName = sessionStorage.getItem('am_audience_name');
        const savedCsv = sessionStorage.getItem('am_audience_csv');
        const savedType = sessionStorage.getItem('am_audience_type') as any;
        if (savedName) setName(savedName);
        if (savedCsv) setCsv(savedCsv);
        if (savedType) setAudienceType(savedType);
    }, []);

    React.useEffect(() => {
        sessionStorage.setItem('am_audience_name', name);
    }, [name]);

    React.useEffect(() => {
        sessionStorage.setItem('am_audience_csv', csv);
    }, [csv]);
    
    React.useEffect(() => {
        sessionStorage.setItem('am_audience_type', audienceType);
    }, [audienceType]);

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
                    toast({ title: 'CSV Loaded', description: 'Data extracted to the input area.' });
                } else {
                    toast({ title: 'No valid data', description: 'Could not extract valid data from the CSV.', variant: 'destructive' });
                }
            },
            error: (err) => {
                toast({ title: 'CSV Error', description: err.message, variant: 'destructive' });
            }
        });
    };

    const upload = async () => {
        if (!activeAccount) return;
        const items = validItems;
        if (items.length === 0) {
            toast({ title: 'No valid data found', description: 'Make sure each line has valid data.', variant: 'destructive' });
            return;
        }
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
            if (created.error || !(created.data as any)?.id) {
                throw new Error(created.error || 'Failed to create audience');
            }
            const audienceId = (created.data as any).id;

            // 2) Hash using Web Worker
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);

            const hashed: any[][] = [];
            const chunkSize = 5000;
            
            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                const hashedChunk = await new Promise<any[][]>((resolve) => {
                    worker.onmessage = (e) => resolve(e.data.hashedChunk);
                    worker.postMessage({ chunk, type: audienceType });
                });
                hashed.push(...hashedChunk);
                setProgress(Math.round(((i + chunk.length) / items.length) * 100));
            }
            
            worker.terminate();
            URL.revokeObjectURL(workerUrl);

            // 3) Upload users
            const schema = isLtv ? ['EMAIL', 'LOOKALIKE_VALUE'] : [audienceType === 'PHONE' ? 'PHONE' : 'EMAIL'];
            const added = await addUsersToCustomAudience(audienceId, schema, hashed);
            if (added.error) throw new Error(added.error);

            toast({ title: 'Upload complete', description: `${hashed.length} items hashed & uploaded.` });
            setCsv('');
            setName('New customer list');
            sessionStorage.removeItem('am_audience_csv');
            sessionStorage.removeItem('am_audience_name');
        } catch (e: any) {
            toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    if (!activeAccount) {
        return (
            <div>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to upload customer lists.</ZoruAlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <AmBreadcrumb page="Customer Lists" />
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <UserPlus className="h-6 w-6" /> Customer list uploader
                    <Badge variant="success">Privacy-safe</Badge>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Upload emails to create a Custom Audience. Everything is SHA-256 hashed in your browser before
                    it ever touches the network.
                </p>
            </div>

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Hashing happens on your device</ZoruAlertTitle>
                <ZoruAlertDescription>
                    Raw emails never leave your browser. Only hashed values are sent to Meta — Meta rehashes on their
                    end to match against their user graph without ever seeing the plaintext.
                </ZoruAlertDescription>
            </Alert>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle className="text-base flex items-center justify-between">
                        Upload
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <FileText className="h-4 w-4 mr-2" /> Load from CSV
                        </Button>
                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file);
                                e.target.value = '';
                            }}
                        />
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-3">
                    <div className="flex gap-4">
                        <div className="space-y-2 flex-1">
                            <Label>Audience name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2 w-1/3">
                            <Label>Data type</Label>
                            <select 
                                value={audienceType}
                                onChange={(e) => setAudienceType(e.target.value as any)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                            >
                                <option value="EMAIL">Email Only</option>
                                <option value="PHONE">Phone Number Only</option>
                                <option value="EMAIL_LTV">Email with LTV</option>
                            </select>
                        </div>
                    </div>
                    <div 
                        className={`space-y-2 relative rounded-md transition-all ${isDragging ? 'ring-2 ring-indigo-500 bg-indigo-50/50' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file && file.name.endsWith('.csv')) {
                                handleFileUpload(file);
                            } else {
                                toast({ title: 'Invalid file', description: 'Please drop a .csv file.', variant: 'destructive' });
                            }
                        }}
                    >
                        <Label>
                            {audienceType === 'EMAIL' && 'Emails (one per line)'}
                            {audienceType === 'PHONE' && 'Phone Numbers (with country code, one per line)'}
                            {audienceType === 'EMAIL_LTV' && 'Email,Value (e.g. john@example.com,150.50)'}
                            {' or drag & drop a CSV here'}
                        </Label>
                        <Textarea
                            value={csv}
                            onChange={(e) => setCsv(e.target.value)}
                            placeholder={
                                audienceType === 'EMAIL' ? 'jane@example.com\njohn@example.com\n…' :
                                audienceType === 'PHONE' ? '14155552671\n14155552672\n…' :
                                'jane@example.com,100\njohn@example.com,250\n…'
                            }
                            className={`min-h-64 font-mono text-xs ${isDragging ? 'opacity-50 pointer-events-none' : ''}`}
                        />
                        {isDragging && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-semibold text-indigo-600 bg-white/80 px-4 py-2 rounded-full shadow">Drop CSV here</span>
                            </div>
                        )}
                    </div>
                    {/* Valid items count display */}
                    {parsedLines.length > 0 && (
                        <div className="flex items-center gap-3 text-sm">
                            <Badge variant="success">{validItems.length} valid item{validItems.length !== 1 ? 's' : ''} ready to upload</Badge>
                            {invalidCount > 0 && (
                                <Badge variant="danger">{invalidCount} invalid</Badge>
                            )}
                        </div>
                    )}
                    <Button
                        className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white relative overflow-hidden"
                        onClick={upload}
                        disabled={uploading || validItems.length === 0}
                    >
                        {uploading && (
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300" 
                                style={{ width: `${progress}%` }} 
                            />
                        )}
                        <Upload className="h-4 w-4 mr-1 relative z-10" />
                        <span className="relative z-10">
                            {uploading ? `Hashing & uploading… ${progress}%` : `Hash & upload${validItems.length > 0 ? ` (${validItems.length})` : ''}`}
                        </span>
                    </Button>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
