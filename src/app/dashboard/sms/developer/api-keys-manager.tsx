'use client';

import { useState, useEffect } from 'react';
import { generateApiKey, getApiKeysForUser, revokeApiKey } from '@/app/actions/api-keys.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, Key, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function ApiKeyManager() {
    const [keys, setKeys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadKeys();
    }, []);

    const loadKeys = async () => {
        setLoading(true);
        const data = await getApiKeysForUser();
        setKeys(data);
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newKeyName) return;
        setCreating(true);
        const res = await generateApiKey(newKeyName);
        if (res.success && res.apiKey) {
            setGeneratedKey(res.apiKey);
            setNewKeyName('');
            loadKeys();
        } else {
            alert(res.error || "Failed to create key");
        }
        setCreating(false);
    };

    const handleRevoke = async (id: string) => {
        if (!confirm("Are you sure? This will immediately block any requests using this key.")) return;
        await revokeApiKey(id);
        loadKeys();
    };

    const copyToClipboard = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage keys for accessing the SMS API programmatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Creation Form */}
                <div className="flex gap-4 items-end">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Input
                            placeholder="Key Name (e.g. Production App)"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleCreate} disabled={creating || !newKeyName}>
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                        Generate Key
                    </Button>
                </div>

                {/* Success Message */}
                {generatedKey && (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-md">
                        <p className="text-sm text-green-800 font-medium mb-2">New API Key Generated!</p>
                        <div className="flex items-center gap-2">
                            <code className="bg-white px-2 py-1 rounded border font-mono text-sm">{generatedKey}</code>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copyToClipboard}>
                                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-green-700 mt-2">
                            Copy this now. You won't be able to see it again.
                        </p>
                    </div>
                )}

                {/* List */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Prefix</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Last Used</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && keys.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : keys.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No API keys found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                keys.map((key) => (
                                    <TableRow key={key._id}>
                                        <TableCell className="font-medium">{key.name}</TableCell>
                                        <TableCell className="font-mono text-xs">sn_*****</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(key.createdAt), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {key.lastUsed ? format(new Date(key.lastUsed), 'MMM d, HH:mm') : 'Never'}
                                        </TableCell>
                                        <TableCell>
                                            {key.revoked ? <Badge variant="destructive">Revoked</Badge> : <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!key.revoked && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRevoke(key._id)}
                                                >
                                                    <Trash2 className="h-4 w-4" /> Revoke
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
