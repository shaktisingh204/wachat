'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Checkbox,
    Dialog,
    DialogContent,
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
import {
    createSabpracticeAdvisoryNote,
    createSabpracticeDeadline,
    createSabpracticeEngagement,
    createSabpracticeTask,
    shareSabpracticeAdvisoryNote,
} from '@/app/actions/sabpractice.actions';

export function CreateEngagementButton({ clientId }: { clientId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [cadence, setCadence] = React.useState('monthly');
    const [rate, setRate] = React.useState('');
    const [pending, start] = React.useTransition();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>New engagement</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New engagement</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Name">
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="FY26 audit"
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Billing cadence">
                            <Select value={cadence} onValueChange={setCadence}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="on_completion">On completion</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Hourly rate (minor)">
                            <Input
                                inputMode="numeric"
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                                placeholder="500000"
                            />
                        </Field>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        loading={pending}
                        onClick={() =>
                            start(async () => {
                                if (!name.trim()) return;
                                try {
                                    await createSabpracticeEngagement({
                                        clientId,
                                        name: name.trim(),
                                        startDate: new Date().toISOString(),
                                        billingCadence: cadence,
                                        hourlyRateMinor: rate ? Number(rate) : undefined,
                                    });
                                    toast.success('Engagement created');
                                    setOpen(false);
                                    setName('');
                                    setRate('');
                                    router.refresh();
                                } catch {
                                    toast.error('Could not create engagement');
                                }
                            })
                        }
                        disabled={pending || !name.trim()}
                    >
                        {pending ? 'Saving' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CreateTaskButton({
    clientId,
    engagementId,
}: {
    clientId: string;
    engagementId?: string;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [eid, setEid] = React.useState(engagementId ?? '');
    const [billable, setBillable] = React.useState(true);
    const [pending, start] = React.useTransition();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">New task</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New task</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Title">
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </Field>
                    <Field label="Engagement ID">
                        <Input
                            value={eid}
                            onChange={(e) => setEid(e.target.value)}
                            placeholder="engagement _id"
                        />
                    </Field>
                    <Checkbox
                        label="Billable"
                        checked={billable}
                        onChange={(e) => setBillable(e.target.checked)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        loading={pending}
                        onClick={() =>
                            start(async () => {
                                if (!title.trim() || !eid.trim()) return;
                                try {
                                    await createSabpracticeTask({
                                        clientId,
                                        engagementId: eid.trim(),
                                        title: title.trim(),
                                        billable,
                                    });
                                    toast.success('Task created');
                                    setOpen(false);
                                    setTitle('');
                                    router.refresh();
                                } catch {
                                    toast.error('Could not create task');
                                }
                            })
                        }
                        disabled={pending || !title.trim() || !eid.trim()}
                    >
                        {pending ? 'Saving' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CreateDeadlineButton({ clientId }: { clientId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [kind, setKind] = React.useState('tax_filing');
    const [due, setDue] = React.useState('');
    const [pending, start] = React.useTransition();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">New deadline</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New compliance deadline</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Name">
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Kind">
                            <Select value={kind} onValueChange={setKind}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tax_filing">Tax filing</SelectItem>
                                    <SelectItem value="payroll">Payroll</SelectItem>
                                    <SelectItem value="gst">GST</SelectItem>
                                    <SelectItem value="audit">Audit</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Due date">
                            <Input
                                type="date"
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                            />
                        </Field>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        loading={pending}
                        onClick={() =>
                            start(async () => {
                                if (!name.trim() || !due) return;
                                try {
                                    await createSabpracticeDeadline({
                                        clientId,
                                        name: name.trim(),
                                        kind,
                                        dueDate: new Date(due).toISOString(),
                                    });
                                    toast.success('Deadline created');
                                    setOpen(false);
                                    setName('');
                                    setDue('');
                                    router.refresh();
                                } catch {
                                    toast.error('Could not create deadline');
                                }
                            })
                        }
                        disabled={pending || !name.trim() || !due}
                    >
                        {pending ? 'Saving' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CreateAdvisoryNoteButton({ clientId }: { clientId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [body, setBody] = React.useState('');
    const [kind, setKind] = React.useState('insight');
    const [pending, start] = React.useTransition();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">New advisory note</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New advisory note</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Title">
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </Field>
                    <Field label="Kind">
                        <Select value={kind} onValueChange={setKind}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="insight">Insight</SelectItem>
                                <SelectItem value="action">Action</SelectItem>
                                <SelectItem value="risk">Risk</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Body (markdown)">
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={6}
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        loading={pending}
                        onClick={() =>
                            start(async () => {
                                if (!title.trim()) return;
                                try {
                                    await createSabpracticeAdvisoryNote({
                                        clientId,
                                        authorUserId: '',
                                        title: title.trim(),
                                        body,
                                        kind,
                                        status: 'draft',
                                    });
                                    toast.success('Advisory note saved');
                                    setOpen(false);
                                    setTitle('');
                                    setBody('');
                                    router.refresh();
                                } catch {
                                    toast.error('Could not save advisory note');
                                }
                            })
                        }
                        disabled={pending || !title.trim()}
                    >
                        {pending ? 'Saving' : 'Save draft'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ShareAdvisoryNoteButton({ id }: { id: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, start] = React.useTransition();
    return (
        <Button
            size="sm"
            variant="outline"
            loading={pending}
            disabled={pending}
            onClick={() =>
                start(async () => {
                    try {
                        await shareSabpracticeAdvisoryNote(id);
                        toast.success('Advisory note shared');
                        router.refresh();
                    } catch {
                        toast.error('Could not share advisory note');
                    }
                })
            }
        >
            {pending ? 'Sharing' : 'Share'}
        </Button>
    );
}
