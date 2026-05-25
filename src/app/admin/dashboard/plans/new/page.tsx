import type { Metadata } from 'next';
import { PlanEditor } from '../_components/PlanEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create Plan | SabNode Admin' };

export default function NewPlanPage() {
    return <PlanEditor planId="new" />;
}
