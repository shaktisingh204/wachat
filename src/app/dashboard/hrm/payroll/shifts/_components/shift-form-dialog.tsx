'use client';

import * as React from 'react';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import {
    Button,
    Checkbox,
    Dialog,
    ZoruDialogContent,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    Input,
    Label,
    Textarea,
    useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { ShiftForm } from './shift-form';
import { saveShift } from '@/app/actions/crm-shifts.actions';
import type { CrmShiftDoc, CrmShiftStatus } from '@/lib/rust-client/crm-shifts';



export function ShiftDialog({
    open,
    onOpenChange,
    onSaved,
    initial,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (shift: CrmShiftDoc) => void;
    initial: CrmShiftDoc | null;
}) {
    const isEditing = !!initial;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[560px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>
                        {isEditing ? 'Edit shift' : 'New shift'}
                    </ZoruDialogTitle>
                </ZoruDialogHeader>
                <ShiftForm
                    initial={initial}
                    onSaved={() => {
                        // The form state handles the toast, we just need to refresh list and close
                        if (initial) {
                            onSaved(initial); // Pass the updated shift or original so it triggers refresh
                        } else {
                            onSaved({} as CrmShiftDoc); // Let the list refresh
                        }
                        onOpenChange(false);
                    }}
                    onCancel={() => onOpenChange(false)}
                />
            </ZoruDialogContent>
        </Dialog>
    );
}
