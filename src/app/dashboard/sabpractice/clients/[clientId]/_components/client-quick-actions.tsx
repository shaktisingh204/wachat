'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Dialog,
    DialogContent,
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
import {
    createSabpracticeAdvisoryNote,
    createSabpracticeDeadline,
    createSabpracticeEngagement,
    createSabpracticeTask,
    shareSabpracticeAdvisoryNote,
} from '@/app/actions/sabpractice.actions';

export function CreateEngagementButton({ clientId }: { clientId: string }) {
    const router = useRouter();
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
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="FY26 audit"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Billing cadence</Label>
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
                        </div>
                        <div className="space-y-1">
                            <Label>Hourly rate (minor)</Label>
                            <Input
                                inputMode="numeric"
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                                placeholder="500000"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() =>
                            start(async () => {
                                if (!name.trim()) return;
                                await createSabpracticeEngagement({
                                    clientId,
                                    name: name.trim(),
                                    startDate: new Date().toISOString(),
                                    billingCadence: cadence,
                                    hourlyRateMinor: rate ? Number(rate) : undefined,
                                });
                                setOpen(false);
                                setName('');
                                setRate('');
                                router.refresh();
                            })
                        }
                        disabled={pending || !name.trim()}
                    >
                        {pending ? 'Saving…' : 'Create'}
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
                    <div className="space-y-1">
                        <Label>Title</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label>Engagement ID</Label>
                        <Input
                            value={eid}
                            onChange={(e) => setEid(e.target.value)}
                            placeholder="engagement _id"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="sp-billable"
                            type="checkbox"
                            checked={billable}
                            onChange={(e) => setBillable(e.target.checked)}
                        />
                        <Label htmlFor="sp-billable">Billable</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() =>
                            start(async () => {
                                if (!title.trim() || !eid.trim()) return;
                                await createSabpracticeTask({
                                    clientId,
                                    engagementId: eid.trim(),
                                    title: title.trim(),
                                    billable,
                                });
                                setOpen(false);
                                setTitle('');
                                router.refresh();
                            })
                        }
                        disabled={pending || !title.trim() || !eid.trim()}
                    >
                        {pending ? 'Saving…' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CreateDeadlineButton({ clientId }: { clientId: string }) {
    const router = useRouter();
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
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Kind</Label>
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
                        </div>
                        <div className="space-y-1">
                            <Label>Due date</Label>
                            <Input
                                type="date"
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() =>
                            start(async () => {
                                if (!name.trim() || !due) return;
                                await createSabpracticeDeadline({
                                    clientId,
                                    name: name.trim(),
                                    kind,
                                    dueDate: new Date(due).toISOString(),
                                });
                                setOpen(false);
                                setName('');
                                setDue('');
                                router.refresh();
                            })
                        }
                        disabled={pending || !name.trim() || !due}
                    >
                        {pending ? 'Saving…' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CreateAdvisoryNoteButton({ clientId }: { clientId: string }) {
    const router = useRouter();
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
                    <div className="space-y-1">
                        <Label>Title</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label>Kind</Label>
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
                    </div>
                    <div className="space-y-1">
                        <Label>Body (markdown)</Label>
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={6}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() =>
                            start(async () => {
                                if (!title.trim()) return;
                                await createSabpracticeAdvisoryNote({
                                    clientId,
                                    authorUserId: '',
                                    title: title.trim(),
                                    body,
                                    kind,
                                    status: 'draft',
                                });
                                setOpen(false);
                                setTitle('');
                                setBody('');
                                router.refresh();
                            })
                        }
                        disabled={pending || !title.trim()}
                    >
                        {pending ? 'Saving…' : 'Save draft'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ShareAdvisoryNoteButton({ id }: { id: string }) {
    const router = useRouter();
    const [pending, start] = React.useTransition();
    return (
        <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
                start(async () => {
                    await shareSabpracticeAdvisoryNote(id);
                    router.refresh();
                })
            }
        >
            {pending ? 'Sharing…' : 'Share'}
        </Button>
    );
}
