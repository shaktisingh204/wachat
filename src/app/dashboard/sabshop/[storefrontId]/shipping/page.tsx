'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button,
    IconButton,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    Field,
    Input,
    Badge,
    Tag,
    Switch,
    EmptyState,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    useToast,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage,
} from '@/components/sabcrm/20ui';
import { Plus, Trash2, Globe, Truck, Search, PlusCircle, ArrowLeft } from 'lucide-react';

import {
    listShippingZones, upsertShippingZone, deleteShippingZone,
} from '@/app/actions/sabshop.actions';

interface Rate { name: string; kind: 'flat' | 'per_kg' | 'free'; flatPrice?: number; perKg?: number; minTotal?: number }
interface Zone {
    _id?: string;
    name: string;
    regions: string[];
    rates: Rate[];
    active?: boolean;
}

export default function ShippingPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const { toast } = useToast();
    const id = params.storefrontId;

    const [zones, setZones] = React.useState<Zone[]>([]);
    const [draft, setDraft] = React.useState<Zone>({ name: '', regions: [], rates: [{ name: 'Standard', kind: 'flat', flatPrice: 50 }], active: true });
    const [regionInput, setRegionInput] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);

    const load = React.useCallback(async () => {
        const r = await listShippingZones(id);
        if (r.ok) setZones(r.items as Zone[]);
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!draft.name.trim()) {
            toast({ title: 'Name required', description: 'Please provide a name for the shipping zone.', tone: 'danger' });
            return;
        }

        const r = await upsertShippingZone({ storefrontId: id, ...draft });
        if (!r.ok) { toast({ title: 'Error', description: r.error, tone: 'danger' }); return; }

        toast.success({ title: 'Zone created', description: 'Shipping zone has been saved successfully.' });
        setDraft({ name: '', regions: [], rates: [{ name: 'Standard', kind: 'flat', flatPrice: 50 }], active: true });
        setIsCreating(false);
        load();
    }

    async function onDelete(zid: string) {
        if (!confirm('Are you sure you want to delete this shipping zone?')) return;
        const r = await deleteShippingZone(zid);
        if (r.ok) {
            toast.success({ title: 'Zone deleted', description: 'Shipping zone was removed.' });
            load();
        }
    }

    function addRegion(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const v = regionInput.trim().toUpperCase();
        if (!v) return;
        setDraft((d) => ({ ...d, regions: Array.from(new Set([...d.regions, v])) }));
        setRegionInput('');
    }

    function removeRegion(region: string) {
        setDraft((d) => ({ ...d, regions: d.regions.filter(r => r !== region) }));
    }

    return (
        <div className="20ui flex flex-col gap-6 p-8 max-w-6xl mx-auto w-full h-full">
            <div className="flex flex-col gap-4">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href={`/dashboard/sabshop/${id}`}>Store</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink href={`/dashboard/sabshop/${id}/settings`}>Settings</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Shipping</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Shipping and Delivery</h1>
                        <p className="text-[var(--st-text-secondary)] mt-1">Manage where you ship and how much you charge at checkout.</p>
                    </div>
                    {!isCreating && (
                        <Button variant="primary" iconLeft={Plus} onClick={() => setIsCreating(true)}>
                            Create zone
                        </Button>
                    )}
                </div>
            </div>

            {isCreating ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Button variant="ghost" iconLeft={ArrowLeft} onClick={() => setIsCreating(false)} className="-ml-4 mb-2">
                            Back to zones
                        </Button>

                        <Card>
                            <CardHeader>
                                <CardTitle>Zone Details</CardTitle>
                                <CardDescription>Customers in these regions will see this zone's shipping rates at checkout.</CardDescription>
                            </CardHeader>
                            <CardBody className="space-y-6">
                                <Field label="Zone Name">
                                    <Input
                                        placeholder="e.g. Domestic, Europe, Rest of World"
                                        value={draft.name}
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    />
                                </Field>

                                <div className="space-y-3">
                                    <Field label="Regions">
                                        <form onSubmit={addRegion} className="flex gap-2">
                                            <div className="flex-1">
                                                <Input
                                                    iconLeft={Search}
                                                    value={regionInput}
                                                    placeholder="Search by country or region code (e.g. US, IN, EU)"
                                                    onChange={(e) => setRegionInput(e.target.value)}
                                                />
                                            </div>
                                            <Button type="button" variant="secondary" onClick={() => addRegion()}>Add</Button>
                                        </form>
                                    </Field>

                                    {draft.regions.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {draft.regions.map((r) => (
                                                <Tag key={r} color="var(--st-accent)" onRemove={() => removeRegion(r)} removeLabel={`Remove region ${r}`}>
                                                    {r}
                                                </Tag>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={Globe}
                                            size="sm"
                                            title="No regions added yet."
                                        />
                                    )}
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Shipping Rates</CardTitle>
                                    <CardDescription>Set up the rates for customers in this zone.</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    iconLeft={PlusCircle}
                                    onClick={() => setDraft({ ...draft, rates: [...draft.rates, { name: '', kind: 'flat', flatPrice: 0 }] })}
                                >
                                    Add rate
                                </Button>
                            </CardHeader>
                            <CardBody className="space-y-4">
                                {draft.rates.length === 0 ? (
                                    <EmptyState
                                        icon={Truck}
                                        size="sm"
                                        title="No rates defined."
                                        description="Add a rate to allow checkout."
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        {draft.rates.map((rate, idx) => (
                                            <div key={idx} className="p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] space-y-4 relative group">
                                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <IconButton
                                                        label="Remove rate"
                                                        icon={Trash2}
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => {
                                                            const next = [...draft.rates];
                                                            next.splice(idx, 1);
                                                            setDraft({ ...draft, rates: next });
                                                        }}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <Field label="Rate Name">
                                                        <Input
                                                            value={rate.name}
                                                            placeholder="e.g. Standard, Express"
                                                            onChange={(e) => {
                                                                const next = [...draft.rates];
                                                                next[idx] = { ...rate, name: e.target.value };
                                                                setDraft({ ...draft, rates: next });
                                                            }}
                                                        />
                                                    </Field>
                                                    <Field label="Pricing Strategy">
                                                        <Select
                                                            value={rate.kind}
                                                            onValueChange={(v) => {
                                                                const next = [...draft.rates];
                                                                next[idx] = { ...rate, kind: v as Rate['kind'] };
                                                                setDraft({ ...draft, rates: next });
                                                            }}
                                                        >
                                                            <SelectTrigger aria-label="Pricing strategy"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="flat">Flat Rate</SelectItem>
                                                                <SelectItem value="per_kg">Weight Based (Per kg)</SelectItem>
                                                                <SelectItem value="free">Free Shipping</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </Field>
                                                </div>

                                                {rate.kind !== 'free' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed border-[var(--st-border)]">
                                                        <Field label={`Price (${rate.kind === 'per_kg' ? 'per kg' : 'flat'})`}>
                                                            <Input
                                                                prefix="₹"
                                                                type="number"
                                                                placeholder="0.00"
                                                                value={rate.kind === 'per_kg' ? rate.perKg ?? '' : rate.flatPrice ?? ''}
                                                                onChange={(e) => {
                                                                    const next = [...draft.rates];
                                                                    const val = Number(e.target.value);
                                                                    next[idx] = rate.kind === 'per_kg' ? { ...rate, perKg: val } : { ...rate, flatPrice: val };
                                                                    setDraft({ ...draft, rates: next });
                                                                }}
                                                            />
                                                        </Field>
                                                        <Field label="Free shipping over (Optional)">
                                                            <Input
                                                                prefix="₹"
                                                                type="number"
                                                                placeholder="e.g. 500"
                                                                value={rate.minTotal ?? ''}
                                                                onChange={(e) => {
                                                                    const next = [...draft.rates];
                                                                    next[idx] = { ...rate, minTotal: Number(e.target.value) };
                                                                    setDraft({ ...draft, rates: next });
                                                                }}
                                                            />
                                                        </Field>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        <div className="flex justify-end gap-3 pb-8">
                            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                            <Button variant="primary" onClick={onCreate}>Save Zone</Button>
                        </div>
                    </div>

                    {/* Sidebar / Status for Draft */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Status</CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="flex items-center justify-between">
                                    <Switch
                                        label="Active"
                                        checked={draft.active}
                                        onCheckedChange={(c) => setDraft({ ...draft, active: c })}
                                    />
                                </div>
                                <p className="text-xs text-[var(--st-text-secondary)] mt-2">
                                    {draft.active ? 'This zone is currently active and rates will apply at checkout.' : 'This zone is disabled. Rates will not appear.'}
                                </p>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            ) : (
                <Card padding="none">
                    <div className="overflow-x-auto">
                        <Table hover>
                            <THead>
                                <Tr>
                                    <Th>Zone Name</Th>
                                    <Th>Regions</Th>
                                    <Th>Rates</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {zones.length === 0 ? (
                                    <Tr>
                                        <Td colSpan={5}>
                                            <EmptyState
                                                icon={Truck}
                                                title="No shipping zones"
                                                description="Create a shipping zone to start charging for delivery."
                                            />
                                        </Td>
                                    </Tr>
                                ) : (
                                    zones.map((z) => (
                                        <Tr key={z._id} className="group">
                                            <Td className="font-medium text-[var(--st-text)]">
                                                {z.name}
                                            </Td>
                                            <Td truncate align="left">
                                                <span className="text-[var(--st-text-secondary)]" title={z.regions.join(', ')}>
                                                    {z.regions.length > 0 ? z.regions.join(', ') : 'No regions'}
                                                </span>
                                            </Td>
                                            <Td>
                                                <Badge tone="neutral">{z.rates.length} rate(s)</Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone={z.active ? 'success' : 'neutral'}>
                                                    {z.active ? 'Active' : 'Draft'}
                                                </Badge>
                                            </Td>
                                            <Td align="right">
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <IconButton
                                                        label={`Delete zone ${z.name}`}
                                                        icon={Trash2}
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => z._id && onDelete(z._id)}
                                                    />
                                                </span>
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </TBody>
                        </Table>
                    </div>
                </Card>
            )}
        </div>
    );
}
