
'use client';

import { useState } from 'react';
import type { WithId, Project } from '@/lib/definitions';
import { ZoruCard, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
import { handleUpdateMasterSwitch } from '@/app/actions/project.actions';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle } from 'lucide-react';
import { ZoruSeparator } from '../ui/separator';
import { AutoReplyForm } from './auto-reply-form';
import { OptInOutForm } from './opt-in-out-form';


interface AutoReplySettingsTabProps {
  project: WithId<Project>;
}

export function AutoReplySettingsTab({ project }: AutoReplySettingsTabProps) {
    const { toast } = useToast();
    const [isSwitchPending, setIsSwitchPending] = useState(false);

    const onMasterSwitchChange = async (checked: boolean) => {
        setIsSwitchPending(true);
        const result = await handleUpdateMasterSwitch(project._id.toString(), checked);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
        }
        setIsSwitchPending(false);
    }
    
    return (
        <div className="space-y-6">
            <ZoruCard>
                 <ZoruCardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1.5">
                            <ZoruCardTitle>Master Auto-Reply ZoruSwitch</ZoruCardTitle>
                            <ZoruCardDescription>Enable or disable all auto-reply functionality for this project.</ZoruCardDescription>
                        </div>
                         <div className="flex items-center gap-2">
                             {isSwitchPending && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />}
                             <ZoruSwitch 
                                defaultChecked={project.autoReplySettings?.masterEnabled !== false}
                                onCheckedChange={onMasterSwitchChange}
                                disabled={isSwitchPending}
                            />
                        </div>
                    </div>
                </ZoruCardHeader>
            </ZoruCard>

            <ZoruSeparator />
            
            <div className="grid md:grid-cols-2 gap-6">
                <AutoReplyForm type="welcomeMessage" project={project} />
                <AutoReplyForm type="inactiveHours" project={project} />
                <AutoReplyForm type="general" project={project} />
                <AutoReplyForm type="aiAssistant" project={project} />
            </div>

            <ZoruSeparator />
            
            <OptInOutForm project={project} />

        </div>
    )
}
