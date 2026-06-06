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
    Field,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import { createSabpracticeClient } from '@/app/actions/sabpractice.actions';

export function ClientCreateDialog() {
    const router = useRouter();
    const { toast } = useToast();
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
            try {
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
                toast.success('Client created');
            } catch {
                toast.error('Could not create the client. Please try again.');
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="primary">New client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add a client business</DialogTitle>
                    <DialogDescription>
                        Track the business whose books or advisory work you manage.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-2">
                    <Field label="Business name" required>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Acme Industries Pvt Ltd"
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Industry">
                            <Input
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                placeholder="Manufacturing"
                            />
                        </Field>
                        <Field label="Fiscal year start" help="Month and day, e.g. 04-01.">
                            <Input
                                value={fiscalYearStart}
                                onChange={(e) => setFiscalYearStart(e.target.value)}
                                placeholder="04-01"
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Contact name">
                            <Input
                                value={primaryContactName}
                                onChange={(e) => setPrimaryContactName(e.target.value)}
                            />
                        </Field>
                        <Field label="Contact email">
                            <Input
                                type="email"
                                value={primaryContactEmail}
                                onChange={(e) => setPrimaryContactEmail(e.target.value)}
                            />
                        </Field>
                    </div>
                    <Field label="Status">
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger aria-label="Status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="onboarding">Onboarding</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Notes">
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={submit}
                        loading={pending}
                        disabled={!name.trim()}
                    >
                        Create client
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
