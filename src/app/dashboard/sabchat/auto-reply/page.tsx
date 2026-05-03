
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
      Save Auto-Reply Settings
    </ClayButton>
  );
}

export default function AutoReplyPage() {
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
        title="Auto Reply"
        subtitle="Automated messages sent to visitors"
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
            teamName: settings.teamName,
            avatarUrl: settings.avatarUrl,
            officeHours: settings.officeHours,
            aiEnabled: settings.aiEnabled,
            aiContext: settings.aiContext,
            faqs: settings.faqs,
            quickReplies: settings.quickReplies,
          })}
        />

        <ClayCard>
          <h2 className="mb-4 text-[15px] font-semibold text-foreground">Automated Messages</h2>

          {/* Welcome Message */}
          <div className="mb-4 rounded-lg border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="welcomeEnabled" className="text-[13px] font-semibold text-foreground">
                Welcome Message
              </Label>
              <Switch id="welcomeEnabled" name="welcomeEnabled" defaultChecked={settings.welcomeEnabled} />
            </div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              The first message a visitor sees when they start a chat.
            </p>
            <Textarea
              name="welcomeMessage"
              defaultValue={settings.welcomeMessage || 'Hello! How can we help you today?'}
              placeholder="Welcome message..."
              className="min-h-24"
            />
          </div>

          {/* Away Message */}
          <div className="mb-4 rounded-lg border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="awayMessageEnabled" className="text-[13px] font-semibold text-foreground">
                Away Message
              </Label>
              <Switch id="awayMessageEnabled" name="awayMessageEnabled" defaultChecked={settings.awayMessageEnabled} />
            </div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Sent automatically when a visitor messages you outside of office hours.
            </p>
            <Textarea
              name="awayMessage"
              defaultValue={settings.awayMessage || 'We are currently away, but we will get back to you as soon as possible.'}
              placeholder="Away message..."
              className="min-h-24"
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Office hours can be configured under general settings.
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
