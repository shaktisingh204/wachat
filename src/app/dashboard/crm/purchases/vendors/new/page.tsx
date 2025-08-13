

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, Building, User, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Add Vendor Lead
    </Button>
  );
}

export default function NewVendorLeadPage() {
    const [state, formAction] = useActionState(saveCrmVendor, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [bankDetails, setBankDetails] = useState({ accountNumber: '', accountHolder: '', ifsc: '' });

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/purchases/vendors');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <div className="max-w-4xl mx-auto">
             <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/purchases/vendors"><ArrowLeft className="mr-2 h-4 w-4" />Back to Vendors</Link>
                </Button>
            </div>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="bankAccountDetails" value={JSON.stringify(bankDetails)} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-6 w-6" />
                            New Vendor Lead
                        </CardTitle>
                        <CardDescription>Enter the details for the new vendor or supplier.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" defaultValue={['basic', 'tax', 'address']} className="w-full">
                            <AccordionItem value="basic">
                                <AccordionTrigger>Basic Information</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <div className="space-y-2">
                                        <Label htmlFor="name">Full Name *</Label>
                                        <Input id="name" name="name" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
                                        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject</Label>
                                        <Input id="subject" name="subject" placeholder="Brief 4-5 words on what they’re looking for" />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="address">
                                <AccordionTrigger>Address Information</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Country *</Label><Select name="country" defaultValue="India" required><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="India">India</SelectItem></SelectContent></Select></div>
                                        <div className="space-y-2"><Label>State</Label><Select name="state"><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent><SelectItem value="Rajasthan">Rajasthan</SelectItem></SelectContent></Select></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>City</Label><Input name="city" /></div>
                                        <div className="space-y-2"><Label>Pincode</Label><Input name="pincode" /></div>
                                    </div>
                                    <div className="space-y-2"><Label>Street</Label><Input name="street" /></div>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="tax">
                                <AccordionTrigger>Tax Information (Optional)</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="space-y-2">
                                        <Label>Vendor Type</Label>
                                        <RadioGroup name="vendorType" defaultValue="individual" className="flex gap-4">
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="individual" id="type-individual"/><Label htmlFor="type-individual" className="font-normal">Individual</Label></div>
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="company" id="type-company"/><Label htmlFor="type-company" className="font-normal">Company</Label></div>
                                        </RadioGroup>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Business GSTIN</Label><Input name="gstin" /></div>
                                        <div className="space-y-2"><Label>PAN Number</Label><Input name="pan" /></div>
                                    </div>
                                    <div className="space-y-2"><Label>Name as Per PAN</Label><Input name="panName" /></div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="bank">
                                <AccordionTrigger>Bank Account Details (Optional)</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="space-y-2"><Label>Account Number</Label><Input value={bankDetails.accountNumber} onChange={e => setBankDetails(prev => ({...prev, accountNumber: e.target.value}))}/></div>
                                    <div className="space-y-2"><Label>Account Holder Name</Label><Input value={bankDetails.accountHolder} onChange={e => setBankDetails(prev => ({...prev, accountHolder: e.target.value}))}/></div>
                                    <div className="space-y-2"><Label>IFSC Code</Label><Input value={bankDetails.ifsc} onChange={e => setBankDetails(prev => ({...prev, ifsc: e.target.value}))}/></div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                    <CardFooter className="pt-6">
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    )
}
