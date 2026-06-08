'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, CalendarPlus, CheckSquare, Lightbulb } from 'lucide-react';

import {
    Button,
    Checkbox,
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
                <Button variant="primary" size="sm" iconLeft={Briefcase}>
                    New engagement
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New engagement</DialogTitle>
                    <DialogDescription>
                        A scoped block of work with its own billing terms.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Name" required>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="FY26 statutory audit"
                            autoFocus
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Billing cadence">
                            <Select value={cadence} onValueChange={setCadence}>
                                <SelectTrigger aria-label="Billing cadence">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                    <SelectItem value="on_completion">On completion</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field
                            label="Hourly rate"
                            help="In minor units, e.g. 500000 for 5,000.00."
                        >
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
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
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
                                    toast.error('Could not create the engagement');
                                }
                            })
                        }
                        disabled={pending || !name.trim()}
                    >
                        Create engagement
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
                <Button variant="outline" size="sm" iconLeft={CheckSquare}>
                    New task
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New task</DialogTitle>
                    <DialogDescription>A work item inside an engagement.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Title" required>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Reconcile bank ledger"
                            autoFocus
                        />
                    </Field>
                    <Field
                        label="Engagement"
                        required
                        help="Paste the engagement ID this task belongs to."
                    >
                        <Input
                            value={eid}
                            onChange={(e) => setEid(e.target.value)}
                            placeholder="Engagement ID"
                        />
                    </Field>
                    <Checkbox
                        label="Billable"
                        checked={billable}
                        onChange={(e) => setBillable(e.target.checked)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
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
                                    toast.error('Could not create the task');
                                }
                            })
                        }
                        disabled={pending || !title.trim() || !eid.trim()}
                    >
                        Create task
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
                <Button variant="outline" size="sm" iconLeft={CalendarPlus}>
                    New deadline
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New compliance deadline</DialogTitle>
                    <DialogDescription>
                        A filing or compliance date to track for this client.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Name" required>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="GST return, Q1"
                            autoFocus
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Kind">
                            <Select value={kind} onValueChange={setKind}>
                                <SelectTrigger aria-label="Kind">
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
                        <Field label="Due date" required>
                            <Input
                                type="date"
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                            />
                        </Field>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
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
                                    toast.error('Could not create the deadline');
                                }
                            })
                        }
                        disabled={pending || !name.trim() || !due}
                    >
                        Create deadline
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
                <Button variant="outline" size="sm" iconLeft={Lightbulb}>
                    New advisory note
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New advisory note</DialogTitle>
                    <DialogDescription>
                        Capture an insight, action, or risk. Share it to the portal later.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <Field label="Title" required>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Cash runway tightening in Q3"
                            autoFocus
                        />
                    </Field>
                    <Field label="Kind">
                        <Select value={kind} onValueChange={setKind}>
                            <SelectTrigger aria-label="Kind">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="insight">Insight</SelectItem>
                                <SelectItem value="action">Action</SelectItem>
                                <SelectItem value="risk">Risk</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Body" help="Markdown is supported.">
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={6}
                            placeholder="Receivables aged over 90 days have grown to 18% of revenue..."
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
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
                                    toast.error('Could not save the advisory note');
                                }
                            })
                        }
                        disabled={pending || !title.trim()}
                    >
                        Save draft
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
                        toast.error('Could not share the advisory note');
                    }
                })
            }
        >
            {pending ? 'Sharing' : 'Share'}
        </Button>
    );
}
