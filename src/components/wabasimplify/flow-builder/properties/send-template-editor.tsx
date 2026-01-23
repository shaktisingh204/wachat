
'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTemplates } from '@/app/actions';
import { useProject } from '@/context/project-context';
import type { Template } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useEffect, useState } from 'react';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function SendTemplateEditor({ node, onUpdate }: EditorProps) {
    const { activeProjectId } = useProject();
    const [templates, setTemplates] = useState<WithId<Template>[]>([]);

    useEffect(() => {
        if (activeProjectId) {
            getTemplates(activeProjectId).then(data => setTemplates(data.filter(t => t.status === 'APPROVED')));
        }
    }, [activeProjectId]);

    return (
        <div className="space-y-2">
            <Label>Template</Label>
            <Select value={node.data.templateId || ''} onValueChange={(val) => onUpdate({ ...node.data, templateId: val })}>
                <SelectTrigger><SelectValue placeholder="Select a template..."/></SelectTrigger>
                <SelectContent>{templates.map(t => <SelectItem key={t._id.toString()} value={t._id.toString()}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}
