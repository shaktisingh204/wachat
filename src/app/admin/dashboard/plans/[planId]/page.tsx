'use client';

import { useParams } from 'next/navigation';
import { PlanEditor } from '../_components/PlanEditor';

export default function PlanEditorPage() {
    const params = useParams();
    const planId = params.planId as string;
    
    return <PlanEditor planId={planId} />;
}
