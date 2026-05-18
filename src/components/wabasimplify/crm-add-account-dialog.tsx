'use client';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Plus } from 'lucide-react';
import { addCrmAccount } from '@/app/actions/crm-accounts.actions';
import { SmartCombobox } from './smart-combobox';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Add Account
    </ZoruButton>
  );
}

interface CrmAddAccountDialogProps {
  onAdded: () => void;
}

// ... imports

export function CrmAddAccountDialog({ onAdded }: CrmAddAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addCrmAccount, initialState);
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  // State for SmartComboboxes
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [addressState, setAddressState] = useState(''); // Avoid collision with 'state' formState

  // Mock Data (Replace with real DB/API fetch later)
  const industryOptions = [
    { label: 'Technology', value: 'Technology' },
    { label: 'Finance', value: 'Finance' },
    { label: 'Healthcare', value: 'Healthcare' },
    { label: 'Retail', value: 'Retail' },
    { label: 'Manufacturing', value: 'Manufacturing' },
  ];

  const countryOptions = [
    { label: 'India', value: 'India' },
    { label: 'USA', value: 'USA' },
    { label: 'UK', value: 'UK' },
    { label: 'UAE', value: 'UAE' },
    { label: 'Canada', value: 'Canada' },
  ];

  // TODO: Make states dynamic based on country
  const stateOptions = [
    { label: 'Maharashtra', value: 'Maharashtra' },
    { label: 'Delhi', value: 'Delhi' },
    { label: 'Karnataka', value: 'Karnataka' },
    { label: 'New York', value: 'New York' },
    { label: 'California', value: 'California' },
    { label: 'Texas', value: 'Texas' },
  ];

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setIndustry('');
      setCountry('');
      setAddressState('');
      setOpen(false);
      onAdded();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onAdded]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle className="text-zoru-ink">Add New Account</ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">Create a new company record in your CRM.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="name" className="text-zoru-ink">Company Name</ZoruLabel>
                <ZoruInput id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel className="text-zoru-ink">Industry</ZoruLabel>
                <input type="hidden" name="industry" value={industry} />
                <SmartCombobox
                  options={industryOptions}
                  value={industry}
                  onSelect={setIndustry}
                  onCreate={setIndustry}
                  placeholder="Select or create industry..."
                  createLabel="Create Industry"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ZoruLabel htmlFor="website" className="text-zoru-ink">Website</ZoruLabel>
                  <ZoruInput id="website" name="website" type="url" placeholder="https://example.com" />
                </div>
                <div className="space-y-2">
                  <ZoruLabel htmlFor="phone" className="text-zoru-ink">Phone</ZoruLabel>
                  <ZoruInput id="phone" name="phone" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ZoruLabel className="text-zoru-ink">Country</ZoruLabel>
                  <input type="hidden" name="country" value={country} />
                  <SmartCombobox
                    options={countryOptions}
                    value={country}
                    onSelect={setCountry}
                    onCreate={setCountry}
                    placeholder="Select country..."
                    createLabel="Create Country"
                  />
                </div>
                <div className="space-y-2">
                  <ZoruLabel className="text-zoru-ink">State</ZoruLabel>
                  <input type="hidden" name="state" value={addressState} />
                  <SmartCombobox
                    options={stateOptions}
                    value={addressState}
                    onSelect={setAddressState}
                    onCreate={setAddressState}
                    placeholder="Select state..."
                    createLabel="Create State"
                  />
                </div>
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
