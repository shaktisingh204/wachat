'use client';

import { useState } from 'react';
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/zoruui';
import { createAdminMacro, deleteAdminMacro } from '@/app/actions/sabchat-admin.actions';

export function AdminMacrosClient({ initialData }: { initialData: any[] }) {
    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createAdminMacro({ name, content, active: true });
            setName('');
            setContent('');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure?')) return;
        await deleteAdminMacro(id);
    }

    return (
        <div className="flex flex-col gap-6">
            <form onSubmit={handleCreate} className="flex gap-4 items-end bg-muted/50 p-4 rounded-lg border">
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Macro Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Welcome Message" />
                </div>
                <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Content</label>
                    <Input value={content} onChange={(e) => setContent(e.target.value)} required placeholder="Hello! How can I help you?" />
                </div>
                <Button type="submit" disabled={isSubmitting}>Create Macro</Button>
            </form>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Content</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialData.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center">No macros found.</TableCell></TableRow>
                        ) : (
                            initialData.map((item) => (
                                <TableRow key={item._id}>
                                    <TableCell className="font-mono text-xs">{item._id}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{item.content}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(item._id)}>Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
