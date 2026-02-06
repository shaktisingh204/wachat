
'use client';

import { Label } from '@/components/ui/label';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import { useProject } from '@/context/project-context';
import type { MetaFlow } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useEffect, useState } from 'react';

interface EditorProps {
    node: any;
    onUpdate: (data: any) => void;
}

export function TriggerMetaFlowEditor({ node, onUpdate }: EditorProps) {
    const { activeProjectId } = useProject();
    const [metaFlows, setMetaFlows] = useState<WithId<MetaFlow>[]>([]);

    useEffect(() => {
        if (activeProjectId) {
            getMetaFlows(activeProjectId).then(setMetaFlows);
        }
    }, [activeProjectId]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Meta Flow to Trigger</Label>
                <SmartCombobox
                    value={node.data.metaFlowId || ''}
                    onSelect={(val: string) => onUpdate({ metaFlowId: val })}
                    options={metaFlows.map(f => ({ label: f.name, value: f.metaId }))}
                    placeholder="Select a Meta Flow..."
                    searchPlaceholder="Search meta flows..."
                />
            </div>
            <div className="space-y-2"><Label>Header</Label><Input value={node.data.header || ''} onChange={e => onUpdate({ header: e.target.value })} /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea value={node.data.body || ''} onChange={e => onUpdate({ body: e.target.value })} /></div>
            <div className="space-y-2"><Label>Footer</Label><Input value={node.data.footer || ''} onChange={e => onUpdate({ footer: e.target.value })} /></div>
        </div>
    );
}
