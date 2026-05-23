'use client';

import { useState } from 'react';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Button, Input, Textarea, Label } from '@/components/zoruui';
import { submitContact } from './actions';
import { toast } from 'sonner';

export function ContactForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const result = await submitContact(formData);
      if (result.success) {
        toast.success("Request executed successfully [200 OK]", { description: "Your message has been received." });
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error("Execution failed [400 Bad Request]", { description: result.error });
      }
    } catch (error) {
      toast.error("Execution failed [500 Server Error]");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-black border-white/20 text-white rounded-none shadow-none">
      <ZoruCardHeader className="border-b border-white/20 pb-4">
        <ZoruCardTitle className="text-lg font-bold">Try it out</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="pt-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
              <Label htmlFor="name" className="text-white">name <span className="text-white/50">*</span></Label>
              <Input id="name" name="name" required placeholder="string" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" />
          </div>
           <div className="space-y-2">
              <Label htmlFor="email" className="text-white">email <span className="text-white/50">*</span></Label>
              <Input id="email" name="email" type="email" required placeholder="string ($email)" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" />
          </div>
           <div className="space-y-2">
              <Label htmlFor="message" className="text-white">message <span className="text-white/50">*</span></Label>
              <Textarea id="message" name="message" required minLength={10} placeholder="string" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none min-h-[120px] focus-visible:ring-1 focus-visible:ring-white" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-zinc-200 rounded-none font-bold uppercase tracking-widest mt-4 disabled:opacity-50">
            {loading ? 'Executing...' : 'Execute'}
          </Button>
        </form>
      </ZoruCardContent>
    </Card>
  );
}
