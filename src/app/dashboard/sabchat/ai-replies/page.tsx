
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ClayCard, ClayButton } from '@/components/clay';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bot, LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveSabChatSettings } from '@/app/actions/sabchat.actions';
import { useProject } from '@/context/project-context';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const initialState: any = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
    >
      Save AI Settings
    </ClayButton>
  );
}

export default function AiRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const settings = sessionUser?.sabChatSettings || {};
  const [state, formAction] = useActionState(saveSabChatSettings, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      reloadProject();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, reloadProject]);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="AI Replies"
        subtitle="Configure the AI assistant for your chat"
        icon={Bot}
      />

      <form action={formAction}>
        {/* Pass through existing settings that aren't on this form */}
        <input
          type="hidden"
          name="settings"
          value={JSON.stringify({
            enabled: settings.enabled,
            widgetColor: settings.widgetColor,
            welcomeMessage: settings.welcomeMessage,
            awayMessage: settings.awayMessage,
            teamName: settings.teamName,
            avatarUrl: settings.avatarUrl,
            officeHours: settings.officeHours,
            faqs: settings.faqs,
            quickReplies: settings.quickReplies,
          })}
        />

        <ClayCard>
          <h2 className="mb-4 text-[15px] font-semibold text-foreground">AI Assistant Configuration</h2>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Provide context about your business. The AI will use this information, along with your FAQs, to answer visitor questions automatically.
          </p>

          <div className="mb-4 flex items-center gap-3">
            <Switch id="aiEnabled" name="aiEnabled" defaultChecked={settings.aiEnabled} />
            <Label htmlFor="aiEnabled" className="text-[13px] text-foreground">
              Enable AI Assistant
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aiContext" className="text-[12px] text-muted-foreground">
              Business Context
            </Label>
            <Textarea
              id="aiContext"
              name="aiContext"
              defaultValue={settings.aiContext || ''}
              className="min-h-[250px] rounded-lg border-border bg-card text-[13px]"
              placeholder="Describe your business, services, hours, and common policies..."
            />
            <p className="text-[12px] text-muted-foreground">
              The more detailed your context, the better the AI will perform.
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <SubmitButton />
          </div>
        </ClayCard>
      </form>
    </div>
  );
}
