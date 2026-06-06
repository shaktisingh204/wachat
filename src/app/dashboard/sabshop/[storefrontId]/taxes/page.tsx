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
    Input,
    Field,
    Badge,
    Checkbox,
    Switch,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    useToast,
} from '@/components/sabcrm/20ui';
import { Plus, Trash2, Receipt, Search, ArrowLeft, Percent } from 'lucide-react';

import { listTaxRules, upsertTaxRule, deleteTaxRule } from '@/app/actions/sabshop.actions';

interface Rule {
    _id?: string;
    name: string;
    region: string;
    rate: number;
    inclusive?: boolean;
    active?: boolean;
}

export default function TaxesPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const { toast } = useToast();
    const id = params.storefrontId;

    const [items, setItems] = React.useState<Rule[]>([]);
    const [draft, setDraft] = React.useState<Rule>({ name: '', region: '', rate: 0.18, inclusive: false, active: true });
    const [isCreating, setIsCreating] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const load = React.useCallback(async () => {
        const r = await listTaxRules(id);
        if (r.ok) setItems(r.items as Rule[]);
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    async function onCreate() {
        if (!draft.name.trim() || !draft.region.trim()) {
            toast({ title: 'Missing fields', description: 'Name and Region are required.', tone: 'danger' });
            return;
        }

        const r = await upsertTaxRule({ storefrontId: id, ...draft });
        if (!r.ok) { toast({ title: 'Error', description: r.error, tone: 'danger' }); return; }

        toast.success({ title: 'Tax rule created', description: 'The tax rule has been successfully saved.' });
        setDraft({ name: '', region: '', rate: 0.18, inclusive: false, active: true });
        setIsCreating(false);
        load();
    }

    async function onDelete(rid: string) {
        if (!confirm('Are you sure you want to delete this tax rule?')) return;
        const r = await deleteTaxRule(rid);
        if (r.ok) {
            toast.success({ title: 'Tax rule deleted', description: 'The tax rule was removed.' });
            load();
        }
    }

    const filteredItems = items.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.region.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="ui20 flex flex-col gap-6 p-8 max-w-6xl mx-auto w-full h-full">
            <div className="flex flex-col gap-3">
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
                            <BreadcrumbPage>Taxes and Duties</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <PageHeader bordered={false}>
                    <PageHeaderHeading>
                        <PageTitle>Taxes and Duties</PageTitle>
                        <PageDescription>Configure regional tax overrides and how taxes are applied to prices.</PageDescription>
                    </PageHeaderHeading>
                    {!isCreating && (
                        <PageActions>
                            <Button variant="primary" iconLeft={Plus} onClick={() => setIsCreating(true)}>
                                Add Tax Rule
                            </Button>
                        </PageActions>
                    )}
                </PageHeader>
            </div>

            {isCreating ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Button
                            variant="ghost"
                            iconLeft={ArrowLeft}
                            onClick={() => setIsCreating(false)}
                            className="-ml-2 mb-2"
                        >
                            Back to tax rules
                        </Button>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tax Rule Details</CardTitle>
                                <CardDescription>Specify the region and rate for this tax configuration.</CardDescription>
                            </CardHeader>
                            <CardBody className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Tax Name">
                                        <Input
                                            placeholder="e.g. GST, VAT, Sales Tax"
                                            value={draft.name}
                                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                        />
                                    </Field>
                                    <Field label="Region (Code)" help="Use ISO country or state codes.">
                                        <Input
                                            placeholder="e.g. IN, IN-MH, US, EU"
                                            value={draft.region}
                                            onChange={(e) => setDraft({ ...draft, region: e.target.value.toUpperCase() })}
                                        />
                                    </Field>
                                </div>

                                <Field label="Tax Rate" className="max-w-[200px]">
                                    <Input
                                        iconLeft={Percent}
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={draft.rate * 100}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setDraft({ ...draft, rate: val / 100 });
                                        }}
                                    />
                                </Field>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tax Calculation</CardTitle>
                                <CardDescription>How this tax behaves with your product prices.</CardDescription>
                            </CardHeader>
                            <CardBody>
                                <label className="flex items-start gap-3 p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] cursor-pointer hover:bg-[var(--st-hover)] transition-colors">
                                    <Checkbox
                                        className="mt-1"
                                        checked={!!draft.inclusive}
                                        onChange={(e) => setDraft({ ...draft, inclusive: e.target.checked })}
                                    />
                                    <div>
                                        <p className="font-medium text-[var(--st-text)] text-sm">Tax is included in product prices</p>
                                        <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                                            Customers will pay the exact price shown on your store. The tax portion is calculated from that total.
                                        </p>
                                    </div>
                                </label>
                            </CardBody>
                        </Card>

                        <div className="flex justify-end gap-3 pb-8">
                            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                            <Button variant="primary" onClick={onCreate}>Save Tax Rule</Button>
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
                                        id="tax-active"
                                        label="Active"
                                        checked={draft.active}
                                        onCheckedChange={(c) => setDraft({ ...draft, active: c })}
                                    />
                                </div>
                                <p className="text-xs text-[var(--st-text-secondary)] mt-2">
                                    {draft.active ? 'This tax rule is currently active and will be applied at checkout.' : 'This tax rule is disabled and will not apply.'}
                                </p>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {items.length > 0 && (
                        <div className="max-w-sm">
                            <Input
                                iconLeft={Search}
                                placeholder="Search tax rules..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Search tax rules"
                            />
                        </div>
                    )}

                    {items.length === 0 ? (
                        <Card>
                            <CardBody>
                                <EmptyState
                                    icon={Receipt}
                                    title="No tax rules"
                                    description="Create a tax rule to start charging taxes on orders."
                                    action={
                                        <Button variant="primary" iconLeft={Plus} onClick={() => setIsCreating(true)}>
                                            Add Tax Rule
                                        </Button>
                                    }
                                />
                            </CardBody>
                        </Card>
                    ) : (
                        <Card padding="none">
                            <div className="overflow-x-auto">
                                <Table>
                                    <THead>
                                        <Tr>
                                            <Th>Tax Name</Th>
                                            <Th>Region</Th>
                                            <Th>Rate</Th>
                                            <Th>Calculation</Th>
                                            <Th>Status</Th>
                                            <Th align="right">Actions</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {filteredItems.length === 0 ? (
                                            <Tr>
                                                <Td colSpan={6} align="center" className="text-[var(--st-text-secondary)]">
                                                    No tax rules match your search.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            filteredItems.map((r) => (
                                                <Tr key={r._id}>
                                                    <Td className="font-medium text-[var(--st-text)]">{r.name}</Td>
                                                    <Td>
                                                        <Badge variant="outline" className="font-mono">{r.region}</Badge>
                                                    </Td>
                                                    <Td>{(r.rate * 100).toFixed(1)}%</Td>
                                                    <Td className="text-[var(--st-text-secondary)]">
                                                        {r.inclusive ? 'Included in price' : 'Added at checkout'}
                                                    </Td>
                                                    <Td>
                                                        <Badge tone={r.active ? 'success' : 'neutral'}>
                                                            {r.active ? 'Active' : 'Disabled'}
                                                        </Badge>
                                                    </Td>
                                                    <Td align="right">
                                                        <IconButton
                                                            label={`Delete ${r.name}`}
                                                            icon={Trash2}
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => r._id && onDelete(r._id)}
                                                        />
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
            )}
        </div>
    );
}
