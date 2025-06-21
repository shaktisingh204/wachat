'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { handleStartBroadcast } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { LoaderCircle, Send } from 'lucide-react';

type Template = {
  name: string;
  category: string;
  body: string;
};

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Start Broadcast
        </>
      )}
    </Button>
  );
}

export function BroadcastForm({ templates }: { templates: WithId<Template>[] }) {
  const [state, formAction] = useFormState(handleStartBroadcast, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      formRef.current?.reset();
      setFileName('');
    }
    if (state?.error) {
      toast({
        title: 'Broadcast Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <Card>
      <form ref={formRef} action={formAction}>
        <CardHeader>
          <CardTitle>New Broadcast Campaign</CardTitle>
          <CardDescription>Select a template and upload your contacts CSV file.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="templateId">1. Select Message Template</Label>
            <Select name="templateId" required>
              <SelectTrigger id="templateId">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template._id.toString()} value={template._id.toString()}>
                    {template.name} ({template.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="csvFile">2. Upload Contacts</Label>
            <Input
              id="csvFile"
              name="csvFile"
              type="file"
              accept=".csv"
              required
              ref={fileInputRef}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              className="file:text-primary file:font-medium"
            />
            <p className="text-xs text-muted-foreground">
              Must be a .csv file with a 'phone' column header. For templates
              with variables like {'{{1}}'}, include columns named 'variable1', etc.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
