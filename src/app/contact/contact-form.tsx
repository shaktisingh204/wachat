'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Button, Input, Textarea, Label } from '@/components/zoruui';
import { submitContact, type ContactFormState } from './actions';
import { toast } from 'sonner';

const initialState: ContactFormState = {};

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success("Request executed successfully [200 OK]", { description: state.message });
      formRef.current?.reset();
    } else if (state.error) {
      toast.error("Execution failed [400 Bad Request]", { description: state.error });
    }
  }, [state]);

  return (
    <Card className="bg-black border-white/20 text-white rounded-none shadow-none">
      <ZoruCardHeader className="border-b border-white/20 pb-4">
        <ZoruCardTitle className="text-lg font-bold">Try it out</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="pt-6 space-y-5">
        <form action={formAction} ref={formRef} className="space-y-5">
          <div className="space-y-2">
              <Label htmlFor="name" className="text-white">name <span className="text-white/50">*</span></Label>
              <Input id="name" name="name" required placeholder="string" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" />
              {state.errors?.name && <p className="text-red-500 text-xs mt-1">{state.errors.name[0]}</p>}
          </div>
           <div className="space-y-2">
              <Label htmlFor="email" className="text-white">email <span className="text-white/50">*</span></Label>
              <Input id="email" name="email" type="email" required placeholder="string ($email)" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" />
              {state.errors?.email && <p className="text-red-500 text-xs mt-1">{state.errors.email[0]}</p>}
          </div>
           <div className="space-y-2">
              <Label htmlFor="message" className="text-white">message <span className="text-white/50">*</span></Label>
              <Textarea id="message" name="message" required minLength={10} placeholder="string" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none min-h-[120px] focus-visible:ring-1 focus-visible:ring-white" />
              {state.errors?.message && <p className="text-red-500 text-xs mt-1">{state.errors.message[0]}</p>}
          </div>
          <Button type="submit" disabled={pending} className="w-full bg-white text-black hover:bg-zinc-200 rounded-none font-bold uppercase tracking-widest mt-4 disabled:opacity-50">
            {pending ? 'Executing...' : 'Execute'}
          </Button>
        </form>
      </ZoruCardContent>
    </Card>
  );
}
