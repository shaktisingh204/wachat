'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createEcommShop } from '@/app/actions/custom-ecommerce.actions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Shop
        </Button>
    )
}

interface CreateEcommShopDialogProps {
    projectId: string;
    onSuccess: () => void;
}

export function CreateEcommShopDialog({ projectId, onSuccess }: CreateEcommShopDialogProps) {
    const [open, setOpen] = useState(false);
    const [state, formAction] = useActionState(createEcommShop, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onSuccess();
            setOpen(false);
        }
        if (state.error) {
            toast({ title: 'Error Creating Shop', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSuccess]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Shop
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    <input type="hidden" name="projectId" value={projectId} />
                    <ZoruDialogHeader className="px-6 pt-6 pb-2">
                        <ZoruDialogTitle>Create New Shop</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Enter a name and currency for your new e-commerce storefront.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Shop Name</Label>
                                <Input id="name" name="name" placeholder="e.g., My T-Shirt Store" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Select name="currency" defaultValue="USD" required>
                                    <ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="USD">USD - US Dollar</ZoruSelectItem>
                                        <ZoruSelectItem value="EUR">EUR - Euro</ZoruSelectItem>
                                        <ZoruSelectItem value="INR">INR - Indian Rupee</ZoruSelectItem>
                                        <ZoruSelectItem value="GBP">GBP - British Pound</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
