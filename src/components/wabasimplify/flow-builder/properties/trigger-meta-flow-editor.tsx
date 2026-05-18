
'use client';

import { ZoruLabel } from '@/components/zoruui';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { ZoruInput } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
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
                <ZoruLabel>Meta Flow to Trigger</ZoruLabel>
                <SmartCombobox
                    value={node.data.metaFlowId || ''}
                    onSelect={(val: string) => onUpdate({ metaFlowId: val })}
                    options={metaFlows.map(f => ({ label: f.name, value: f.metaId }))}
                    placeholder="ZoruSelect a Meta Flow..."
                    searchPlaceholder="Search meta flows..."
                />
            </div>
            <div className="space-y-2"><ZoruLabel>Header</ZoruLabel><ZoruInput value={node.data.header || ''} onChange={e => onUpdate({ header: e.target.value })} /></div>
            <div className="space-y-2"><ZoruLabel>Body</ZoruLabel><ZoruTextarea value={node.data.body || ''} onChange={e => onUpdate({ body: e.target.value })} /></div>
            <div className="space-y-2"><ZoruLabel>Footer</ZoruLabel><ZoruInput value={node.data.footer || ''} onChange={e => onUpdate({ footer: e.target.value })} /></div>
        </div>
    );
}
