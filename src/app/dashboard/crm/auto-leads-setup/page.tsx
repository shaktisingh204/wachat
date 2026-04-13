export const dynamic = 'force-dynamic';

import { getAutoLeadRules, saveAutoLeadRule, deleteAutoLeadRule } from '@/app/actions/crm-auto-leads.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Sparkles, Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

export default async function AutoLeadsSetupPage() {
    const rules = await getAutoLeadRules();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Auto-Leads Setup"
                subtitle="Automatically create leads from incoming messages based on keywords."
                icon={Sparkles}
                actions={
                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-clay-obsidian px-4 text-[13px] font-medium text-white hover:bg-clay-obsidian-hover"
                            >
                                <Plus className="h-4 w-4" strokeWidth={1.75} />
                                Add New Rule
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <form action={saveAutoLeadRule as any}>
                                <DialogHeader>
                                    <DialogTitle>Create Auto-Lead Rule</DialogTitle>
                                    <DialogDescription>Define when to automatically create a lead.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>Rule Name</Label>
                                        <Input name="name" placeholder="e.g. Pricing Enquiry" required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Source Channel</Label>
                                        <Select name="source" defaultValue="Email">
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Email">Email</SelectItem>
                                                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                                <SelectItem value="SMS">SMS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Contains Keyword</Label>
                                        <Input name="keyword" placeholder="e.g. price, quote, cost" required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Assign Lead Source</Label>
                                        <Input name="leadSource" placeholder="e.g. Auto-Email" defaultValue="Auto-Generated" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit">Save Rule</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Active Rules</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Incoming messages matching these rules will trigger lead creation.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Rule Name</TableHead>
                                <TableHead className="text-clay-ink-muted">Channel</TableHead>
                                <TableHead className="text-clay-ink-muted">Keyword</TableHead>
                                <TableHead className="text-clay-ink-muted">Target Source</TableHead>
                                <TableHead className="w-[100px] text-clay-ink-muted" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rules.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No rules configured. Add a rule to start automating lead generation.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rules.map((rule) => (
                                    <TableRow key={rule._id.toString()} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{rule.name}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{rule.source}</TableCell>
                                        <TableCell>
                                            <code className="relative rounded bg-clay-surface-2 px-[0.3rem] py-[0.2rem] font-mono text-[12.5px] text-clay-ink">
                                                {rule.keyword}
                                            </code>
                                        </TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{rule.leadSource}</TableCell>
                                        <TableCell>
                                            <form action={async () => {
                                                'use server';
                                                await deleteAutoLeadRule(rule._id.toString());
                                            }}>
                                                <Button variant="ghost" size="icon" className="hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </form>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    )
}
