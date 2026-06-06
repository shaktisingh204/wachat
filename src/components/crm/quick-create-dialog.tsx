'use client';

import React, { useState } from 'react';
import { Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogDescription, Button, Input, Label } from '@/components/sabcrm/20ui/compat';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { quickCreateEntity } from '@/app/actions/crm-quick-create.actions';
import type { LookupItem, EntityKey } from '@/lib/lookup-registry';

interface QuickCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entity: EntityKey;
    onCreated: (item: LookupItem) => void;
}

export function QuickCreateDialog({ open, onOpenChange, entity, onCreated }: QuickCreateDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        
        const res = await quickCreateEntity(entity, formData);
        
        setLoading(false);
        
        if (res.success && res.item) {
            toast.success('Created successfully!');
            onCreated(res.item);
            onOpenChange(false);
        } else {
            toast.error(res.error || 'Failed to create.');
        }
    };

    const getEntityTitle = () => {
        switch (entity) {
            case 'client': return 'Client';
            case 'contact': return 'Contact';
            case 'vendor': return 'Vendor';
            case 'item': return 'Item';
            case 'employee': return 'Employee';
            case 'lead': return 'Lead';
            case 'project': return 'Project';
            case 'task': return 'Task';
            default: return 'Record';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[425px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Create New {getEntityTitle()}</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Quickly add a new {getEntityTitle().toLowerCase()} record.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Render fields conditionally based on entity */}
                    
                    {entity === 'client' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="businessName">Company / Business Name *</Label>
                                <Input id="businessName" name="businessName" required placeholder="e.g. Acme Corp" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="contact@acme.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" name="phone" placeholder="+1 234 567 8900" />
                            </div>
                        </>
                    )}

                    {entity === 'contact' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name *</Label>
                                <Input id="name" name="name" required placeholder="e.g. John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input id="email" name="email" type="email" required placeholder="john@example.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company">Company</Label>
                                <Input id="company" name="company" placeholder="Company Name" />
                            </div>
                        </>
                    )}

                    {entity === 'vendor' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Vendor Name *</Label>
                                <Input id="name" name="name" required placeholder="e.g. Supply Co" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="sales@supplyco.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" name="phone" placeholder="+1 234 567 8900" />
                            </div>
                        </>
                    )}

                    {entity === 'item' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Item Name *</Label>
                                <Input id="name" name="name" required placeholder="e.g. Premium Widget" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU</Label>
                                <Input id="sku" name="sku" placeholder="PRM-WDGT-01" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellingPrice">Selling Price</Label>
                                <Input id="sellingPrice" name="sellingPrice" type="number" step="0.01" placeholder="99.99" />
                            </div>
                        </>
                    )}

                    {entity === 'employee' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Employee Name *</Label>
                                <Input id="name" name="name" required placeholder="e.g. Jane Smith" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input id="email" name="email" type="email" required placeholder="jane@company.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="designation">Designation</Label>
                                <Input id="designation" name="designation" placeholder="e.g. Software Engineer" />
                            </div>
                        </>
                    )}

                    {entity === 'lead' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="title">Lead Title *</Label>
                                <Input id="title" name="title" required placeholder="e.g. Website Redesign Inquiry" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactName">Contact Name *</Label>
                                <Input id="contactName" name="contactName" required placeholder="e.g. Bob Jones" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="bob@example.com" />
                            </div>
                        </>
                    )}

                    {entity === 'project' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Project Name *</Label>
                                <Input id="name" name="name" required placeholder="e.g. Q4 Marketing Campaign" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input id="description" name="description" placeholder="Brief details about the project" />
                            </div>
                        </>
                    )}

                    {entity === 'task' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="title">Task Title *</Label>
                                <Input id="title" name="title" required placeholder="e.g. Prepare Quarterly Report" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <select id="priority" name="priority" className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm ring-offset-zoru-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--st-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>
                        </>
                    )}
                    
                    {/* Fallback for unsupported entities */}
                    {!['client', 'contact', 'vendor', 'item', 'employee', 'lead', 'project', 'task'].includes(entity) && (
                        <div className="text-sm text-[var(--st-text-secondary)]">
                            Quick creation is not supported for {entity}. Please create it from the main {getEntityTitle()} page.
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !['client', 'contact', 'vendor', 'item', 'employee', 'lead', 'project', 'task'].includes(entity)}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create'}
                        </Button>
                    </div>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
