'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Database, Key } from 'lucide-react';

const dltProviders = [
    { id: 'airtel', name: 'Airtel' },
    { id: 'vil', name: 'Vodafone Idea (Vi)' },
    { id: 'smartping', name: 'SmartPing' },
    { id: 'bsnl', name: 'BSNL' },
    { id: 'jio', name: 'Jio TrueConnect' },
    { id: 'other', name: 'Other' },
];

export default function DltManagementPage() {
    const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
    
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5"/>Add New DLT Account</CardTitle>
                    <CardDescription>Connect your registered DLT account to sync headers and templates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dlt-provider">Select DLT Provider</Label>
                            <Select>
                                <SelectTrigger id="dlt-provider"><SelectValue placeholder="Select a provider..."/></SelectTrigger>
                                <SelectContent>
                                    {dltProviders.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="principal-id">Principal Entity ID</Label>
                            <Input id="principal-id" placeholder="Your 19-digit DLT Principal Entity ID" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="api-key">API Key / Credentials</Label>
                        <Input id="api-key" type="password" placeholder="Enter your API Key" />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button disabled>
                        <Key className="mr-2 h-4 w-4" />
                        Connect Account
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                     <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/>Manage Connected DLTs</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Provider</TableHead>
                                <TableHead>Entity ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {connectedAccounts.length > 0 ? (
                                connectedAccounts.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell>{acc.provider}</TableCell>
                                        <TableCell>{acc.entityId}</TableCell>
                                        <TableCell><Badge>Connected</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No DLT accounts connected yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
