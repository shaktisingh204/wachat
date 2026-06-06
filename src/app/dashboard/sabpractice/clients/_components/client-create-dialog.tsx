'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@/components/sabcrm/20ui/compat';
import { createSabpracticeClient } from '@/app/actions/sabpractice.actions';

export function ClientCreateDialog() {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [pending, startTransition] = React.useTransition();
    const [name, setName] = React.useState('');
    const [industry, setIndustry] = React.useState('');
    const [primaryContactName, setPrimaryContactName] = React.useState('');
    const [primaryContactEmail, setPrimaryContactEmail] = React.useState('');
    const [status, setStatus] = React.useState('onboarding');
    const [fiscalYearStart, setFiscalYearStart] = React.useState('');
    const [notes, setNotes] = React.useState('');

    function reset() {
        setName('');
        setIndustry('');
        setPrimaryContactName('');
        setPrimaryContactEmail('');
        setStatus('onboarding');
        setFiscalYearStart('');
        setNotes('');
    }

    function submit() {
        if (!name.trim()) return;
        startTransition(async () => {
            await createSabpracticeClient({
                name: name.trim(),
                industry: industry || undefined,
                primaryContactName: primaryContactName || undefined,
                primaryContactEmail: primaryContactEmail || undefined,
                status,
                fiscalYearStart: fiscalYearStart || undefined,
                notes: notes || undefined,
            });
            setOpen(false);
            reset();
            router.refresh();
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>New client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add a client business</DialogTitle>
                    <DialogDescription>
                        Track the business whose books or advisory work you manage.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div className="space-y-1">
                        <Label htmlFor="sp-client-name">Business name</Label>
                        <Input
                            id="sp-client-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Acme Industries Pvt Ltd"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="sp-client-industry">Industry</Label>
                            <Input
                                id="sp-client-industry"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                placeholder="Manufacturing"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="sp-client-fy">Fiscal year start</Label>
                            <Input
                                id="sp-client-fy"
                                value={fiscalYearStart}
                                onChange={(e) => setFiscalYearStart(e.target.value)}
                                placeholder="04-01"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="sp-client-pcn">Contact name</Label>
                            <Input
                                id="sp-client-pcn"
                                value={primaryContactName}
                                onChange={(e) => setPrimaryContactName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="sp-client-pce">Contact email</Label>
                            <Input
                                id="sp-client-pce"
                                type="email"
                                value={primaryContactEmail}
                                onChange={(e) => setPrimaryContactEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label>Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="onboarding">Onboarding</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sp-client-notes">Notes</Label>
                        <Textarea
                            id="sp-client-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={pending || !name.trim()}>
                        {pending ? 'Saving…' : 'Create client'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
