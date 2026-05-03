'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { Megaphone, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveNotice } from '@/app/actions/worksuite/knowledge.actions';

export default function NewNoticePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(saveNotice, {
    message: '',
    error: '',
  } as any);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/workspace/notices');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Notice"
        subtitle="Publish a notice to your team."
        icon={Megaphone}
      />

      <ClayCard>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="heading" className="text-foreground">Heading *</Label>
            <Input id="heading" name="heading" required className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description" className="text-foreground">Description *</Label>
            <Textarea id="description" name="description" rows={6} required className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="notice_to" className="text-foreground">Audience</Label>
            <Select name="notice_to" defaultValue="all">
              <SelectTrigger id="notice_to" className="mt-1.5 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="employee">Specific employees</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pinned" className="text-foreground">Pinned</Label>
            <Select name="pinned" defaultValue="false">
              <SelectTrigger id="pinned" className="mt-1.5 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <input type="hidden" name="file_attached" value="false" />

          <div className="md:col-span-2 flex justify-end gap-2">
            <ClayButton variant="pill" type="button" onClick={() => router.back()}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="obsidian"
              type="submit"
              disabled={isPending}
              leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            >
              Publish
            </ClayButton>
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
