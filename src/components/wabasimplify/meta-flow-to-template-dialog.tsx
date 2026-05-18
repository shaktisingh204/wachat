'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Send } from 'lucide-react';
import { handleCreateFlowTemplate } from '@/app/actions/template.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { MetaFlow } from '@/lib/definitions';

const initialState = { message: undefined, error: undefined, payload: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Create Template
    </ZoruButton>
  );
}

interface MetaFlowToTemplateDialogProps {
  flow: WithId<MetaFlow>;
}

const languages = [
  { name: 'Afrikaans', code: 'af' }, { name: 'Albanian', code: 'sq' }, { name: 'Arabic', code: 'ar' },
  { name: 'Azerbaijani', code: 'az' }, { name: 'Bengali', code: 'bn' }, { name: 'Bulgarian', code: 'bg' },
  { name: 'Catalan', code: 'ca' }, { name: 'Chinese (CHN)', code: 'zh_CN' }, { name: 'Chinese (HKG)', code: 'zh_HK' },
  { name: 'Chinese (TAI)', code: 'zh_TW' }, { name: 'Croatian', code: 'hr' }, { name: 'Czech', code: 'cs' },
  { name: 'Danish', code: 'da' }, { name: 'Dutch', code: 'nl' }, { name: 'English', code: 'en' },
  { name: 'English (US)', code: 'en_US' }, { name: 'Estonian', code: 'et' }, { name: 'Filipino', code: 'fil' },
  { name: 'Finnish', code: 'fi' }, { name: 'French', code: 'fr' }, { name: 'Georgian', code: 'ka' },
  { name: 'German', code: 'de' }, { name: 'Greek', code: 'el' }, { name: 'Gujarati', code: 'gu' },
  { name: 'Hausa', code: 'ha' }, { name: 'Hebrew', code: 'he' }, { name: 'Hindi', code: 'hi' },
  { name: 'Hungarian', code: 'hu' }, { name: 'Indonesian', code: 'id' }, { name: 'Irish', code: 'ga' },
  { name: 'Italian', code: 'it' }, { name: 'Japanese', code: 'ja' }, { name: 'Kannada', code: 'kn' },
  { name: 'Kazakh', code: 'kk' }, { name: 'Kinyarwanda', code: 'rw_RW' }, { name: 'Korean', code: 'ko' },
  { name: 'Kyrgyz (Kyrgyzstan)', code: 'ky_KG' }, { name: 'Lao', code: 'lo' }, { name: 'Latvian', code: 'lv' },
  { name: 'Lithuanian', code: 'lt' }, { name: 'Macedonian', code: 'mk' }, { name: 'Malay', code: 'ms' },
  { name: 'Malayalam', code: 'ml' }, { name: 'Marathi', code: 'mr' }, { name: 'Norwegian', code: 'nb' },
  { name: 'Persian', code: 'fa' }, { name: 'Polish', code: 'pl' }, { name: 'Portuguese (BR)', code: 'pt_BR' },
  { name: 'Portuguese (POR)', code: 'pt_PT' }, { name: 'Punjabi', code: 'pa' }, { name: 'Romanian', code: 'ro' },
  { name: 'Russian', code: 'ru' }, { name: 'Serbian', code: 'sr' }, { name: 'Slovak', code: 'sk' },
  { name: 'Slovenian', code: 'sl' }, { name: 'Spanish', code: 'es' }, { name: 'Spanish (ARG)', code: 'es_AR' },
  { name: 'Spanish (MEX)', code: 'es_MX' }, { name: 'Spanish (SPA)', code: 'es_ES' }, { name: 'Swahili', code: 'sw' },
  { name: 'Swedish', code: 'sv' }, { name: 'Tamil', code: 'ta' }, { name: 'Telugu', code: 'te' },
  { name: 'Thai', code: 'th' }, { name: 'Turkish', code: 'tr' }, { name: 'Ukrainian', code: 'uk' },
  { name: 'Urdu', code: 'ur' }, { name: 'Uzbek', code: 'uz' }, { name: 'Vietnamese', code: 'vi' },
  { name: 'Zulu', code: 'zu' }
];

export function MetaFlowToTemplateDialog({ flow }: MetaFlowToTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleCreateFlowTemplate, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
    }
    if (state.error) {
      toast({ title: 'Error Creating Template', description: state.error, variant: 'destructive' });
    }
  }, [state, toast]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="secondary" size="sm"><Send className="mr-2 h-4 w-4" />Create Send Template</ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="projectId" value={flow.projectId.toString()} />
          <input type="hidden" name="flowId" value={flow.metaId} />
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Create Template for Flow</ZoruDialogTitle>
            <ZoruDialogDescription>
              Create a message template with a button to trigger the "{flow.name}" flow.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="templateName">Template Name</ZoruLabel>
                <ZoruInput id="templateName" name="templateName" placeholder="e.g., start_support_flow" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ZoruLabel htmlFor="language">Language</ZoruLabel>
                  <ZoruSelect name="language" defaultValue="en_US" required>
                    <ZoruSelectTrigger id="language"><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {languages.map(lang => <ZoruSelectItem key={lang.code} value={lang.code}>{lang.name}</ZoruSelectItem>)}
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
                <div className="space-y-2">
                  <ZoruLabel htmlFor="category">Category</ZoruLabel>
                  <ZoruSelect name="category" required>
                    <ZoruSelectTrigger id="category"><ZoruSelectValue placeholder="ZoruSelect..." /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="MARKETING">Marketing</ZoruSelectItem>
                      <ZoruSelectItem value="UTILITY">Utility</ZoruSelectItem>
                      <ZoruSelectItem value="AUTHENTICATION">Authentication</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="bodyText">Body Text</ZoruLabel>
                <ZoruTextarea id="bodyText" name="bodyText" placeholder="This message will appear above the button." required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="buttonText">ZoruButton Text</ZoruLabel>
                <ZoruInput id="buttonText" name="buttonText" placeholder="e.g., Start Support Chat" required />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
