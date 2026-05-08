export const dynamic = 'force-dynamic';

import { getAutoLeadRules, saveAutoLeadRule, deleteAutoLeadRule } from '@/app/actions/crm-auto-leads.actions';
import { Sparkles, Trash2, Plus } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogClose,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
                    <ZoruDialog>
                        <ZoruDialogTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-zoru-ink px-4 text-[13px] font-medium text-white hover:bg-zoru-ink/90"
                            >
                                <Plus className="h-4 w-4" strokeWidth={1.75} />
                                Add New Rule
                            </button>
                        </ZoruDialogTrigger>
                        <ZoruDialogContent>
                            <form action={saveAutoLeadRule as any}>
                                <ZoruDialogHeader>
                                    <ZoruDialogTitle>Create Auto-Lead Rule</ZoruDialogTitle>
                                    <ZoruDialogDescription>Define when to automatically create a lead.</ZoruDialogDescription>
                                </ZoruDialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <ZoruLabel>Rule Name</ZoruLabel>
                                        <ZoruInput name="name" placeholder="e.g. Pricing Enquiry" required className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                                    </div>
                                    <div className="grid gap-2">
                                        <ZoruLabel>Source Channel</ZoruLabel>
                                        <ZoruSelect name="source" defaultValue="Email">
                                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="Email">Email</ZoruSelectItem>
                                                <ZoruSelectItem value="WhatsApp">WhatsApp</ZoruSelectItem>
                                                <ZoruSelectItem value="SMS">SMS</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </ZoruSelect>
                                    </div>
                                    <div className="grid gap-2">
                                        <ZoruLabel>Contains Keyword</ZoruLabel>
                                        <ZoruInput name="keyword" placeholder="e.g. price, quote, cost" required className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                                    </div>
                                    <div className="grid gap-2">
                                        <ZoruLabel>Assign Lead Source</ZoruLabel>
                                        <ZoruInput name="leadSource" placeholder="e.g. Auto-Email" defaultValue="Auto-Generated" className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                                    </div>
                                </div>
                                <ZoruDialogFooter>
                                    <ZoruDialogClose asChild>
                                        <ZoruButton type="submit">Save Rule</ZoruButton>
                                    </ZoruDialogClose>
                                </ZoruDialogFooter>
                            </form>
                        </ZoruDialogContent>
                    </ZoruDialog>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-zoru-ink">Active Rules</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">Incoming messages matching these rules will trigger lead creation.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Rule Name</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Channel</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Keyword</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Target Source</ZoruTableHead>
                                <ZoruTableHead className="w-[100px] text-zoru-ink-muted" />
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {rules.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No rules configured. Add a rule to start automating lead generation.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                rules.map((rule) => (
                                    <ZoruTableRow key={rule._id.toString()} className="border-zoru-line">
                                        <ZoruTableCell className="font-medium text-zoru-ink">{rule.name}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">{rule.source}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <code className="relative rounded bg-zoru-surface-2 px-[0.3rem] py-[0.2rem] font-mono text-[12.5px] text-zoru-ink">
                                                {rule.keyword}
                                            </code>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">{rule.leadSource}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <form action={async () => {
                                                'use server';
                                                await deleteAutoLeadRule(rule._id.toString());
                                            }}>
                                                <ZoruButton variant="ghost" size="icon" className="hover:text-zoru-danger-ink">
                                                    <Trash2 className="h-4 w-4" />
                                                </ZoruButton>
                                            </form>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    )
}
