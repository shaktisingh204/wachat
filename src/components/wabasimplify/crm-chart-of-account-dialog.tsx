'use client';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
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
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Submit'}
        </ZoruButton>
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
    const { toast } = useZoruToast();
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
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    {isEditing && <input type="hidden" name="accountId" value={initialData?._id.toString()} />}
                    <ZoruDialogHeader className="px-6 pt-6 pb-2">
                        <ZoruDialogTitle className="text-zoru-ink">{isEditing ? 'Edit' : 'Create New'} Account</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="name" className="text-zoru-ink">Account Name *</ZoruLabel>
                                <ZoruInput id="name" name="name" placeholder="Type Account Name" required defaultValue={initialData?.name} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="accountGroupId" className="text-zoru-ink">Account Group *</ZoruLabel>
                                <input type="hidden" name="accountGroupId" value={selectedGroupId} />
                                <EntityPicker
                                    entity="account"
                                    value={selectedGroupId || null}
                                    onChange={(next) => setSelectedGroupId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                                />
                            </div>

                            <div>
                                <ZoruLabel className="font-semibold text-zoru-ink">Opening Balances</ZoruLabel>
                                <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-2 mt-2">
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-xs text-zoru-ink">Currency</ZoruLabel>
                                        <ZoruSelect name="currency" defaultValue={initialData?.currency || "INR"}>
                                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="INR">INR</ZoruSelectItem>
                                                <ZoruSelectItem value="USD">USD</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </ZoruSelect>
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-xs text-zoru-ink">Opening CR/DR *</ZoruLabel>
                                        <ZoruRadioGroup name="balanceType" defaultValue={initialData?.balanceType || "Dr"} className="flex gap-4 pt-2">
                                            <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="Cr" id="type-cr" /><ZoruLabel htmlFor="type-cr" className="font-normal text-zoru-ink">CR</ZoruLabel></div>
                                            <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="Dr" id="type-dr" /><ZoruLabel htmlFor="type-dr" className="font-normal text-zoru-ink">DR</ZoruLabel></div>
                                        </ZoruRadioGroup>
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel className="text-xs text-zoru-ink">Opening Balance *</ZoruLabel>
                                        <ZoruInput id="openingBalance" name="openingBalance" type="number" step="0.01" min="-100000000000" max="100000000000" required defaultValue={initialData?.openingBalance || 0} />
                                    </div>
                                </div>
                                <ZoruButton variant="link" className="p-0 h-auto mt-2 text-xs" disabled>Add Opening Balance in Other Currency</ZoruButton>
                            </div>

                            <div className="space-y-2">
                                <ZoruLabel htmlFor="description" className="text-zoru-ink">Description (Optional)</ZoruLabel>
                                <ZoruTextarea id="description" name="description" defaultValue={initialData?.description} />
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <ZoruSwitch id="status" name="status" defaultChecked={initialData?.status === 'Active' || !isEditing} />
                                <ZoruLabel htmlFor="status" className="text-zoru-ink">Set as Active</ZoruLabel>
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="shrink-0 border-t border-zoru-line bg-zoru-bg px-6 pb-6 pt-4">
                        <ZoruButton type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
