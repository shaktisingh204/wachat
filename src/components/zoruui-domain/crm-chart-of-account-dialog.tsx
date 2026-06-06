'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, RadioGroup, ZoruRadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import { saveCrmChartOfAccount } from '@/app/actions/crm-accounting.actions';
import type { CrmChartOfAccount,
  CrmAccountGroup } from '@/lib/definitions';

import { LoaderCircle, Save } from 'lucide-react';
import { EntityPicker } from '@/components/crm/entity-picker';

const saveInitialState = { message: undefined, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Submit'}
        </Button>
    )
}

interface CrmChartOfAccountDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    accountGroups: WithId<CrmAccountGroup>[];
    initialData: WithId<CrmChartOfAccount> | null
}

export function CrmChartOfAccountDialog({ isOpen, onOpenChange, onSave, accountGroups, initialData }: CrmChartOfAccountDialogProps) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(saveCrmChartOfAccount, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [selectedGroupId, setSelectedGroupId] = useState(initialData?.accountGroupId.toString() || '');

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onSave();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSave, onOpenChange]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    {isEditing && <input type="hidden" name="accountId" value={initialData?._id.toString()} />}
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <DialogTitle className="text-[var(--st-text)]">{isEditing ? 'Edit' : 'Create New'} Account</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[var(--st-text)]">Account Name *</Label>
                                <Input id="name" name="name" placeholder="Type Account Name" required defaultValue={initialData?.name} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountGroupId" className="text-[var(--st-text)]">Account Group *</Label>
                                <input type="hidden" name="accountGroupId" value={selectedGroupId} />
                                <EntityPicker
                                    entity="account"
                                    value={selectedGroupId || null}
                                    onChange={(next) => setSelectedGroupId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                                />
                            </div>

                            <div>
                                <Label className="font-semibold text-[var(--st-text)]">Opening Balances</Label>
                                <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2 mt-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-[var(--st-text)]">Currency</Label>
                                        <Select name="currency" defaultValue={initialData?.currency || "INR"}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INR">INR</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-[var(--st-text)]">Opening CR/DR *</Label>
                                        <RadioGroup name="balanceType" defaultValue={initialData?.balanceType || "Dr"} className="flex gap-4 pt-2">
                                            <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="Cr" id="type-cr" /><Label htmlFor="type-cr" className="font-normal text-[var(--st-text)]">CR</Label></div>
                                            <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="Dr" id="type-dr" /><Label htmlFor="type-dr" className="font-normal text-[var(--st-text)]">DR</Label></div>
                                        </RadioGroup>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-[var(--st-text)]">Opening Balance *</Label>
                                        <Input id="openingBalance" name="openingBalance" type="number" step="0.01" min="-100000000000" max="100000000000" required defaultValue={initialData?.openingBalance || 0} />
                                    </div>
                                </div>
                                <Button variant="link" className="p-0 h-auto mt-2 text-xs" disabled>Add Opening Balance in Other Currency</Button>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-[var(--st-text)]">Description (Optional)</Label>
                                <Textarea id="description" name="description" defaultValue={initialData?.description} />
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Switch id="status" name="status" defaultChecked={initialData?.status === 'Active' || !isEditing} />
                                <Label htmlFor="status" className="text-[var(--st-text)]">Set as Active</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="shrink-0 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-6 pb-6 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
