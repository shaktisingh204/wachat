/**
 * New storefront — `/dashboard/crm/store/storefronts/new`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { StorefrontForm } from '../_components/storefront-form';

export const dynamic = 'force-dynamic';

export default function NewStorefrontPage() {
    return (
        <EntityDetailShell
            eyebrow="STOREFRONT"
            title="New storefront"
            back={{ href: '/dashboard/crm/store/storefronts', label: 'Storefronts' }}
        >
            <StorefrontForm />
        </EntityDetailShell>
    );
}
