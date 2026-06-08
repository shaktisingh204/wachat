/**
 * `/dashboard/requests/blueprints/new` — create a fresh blueprint.
 *
 * Renders a blank `BlueprintEditor` (client component); on submit it
 * server-action POSTs and redirects to the detail page.
 */
import * as React from 'react';

import { BlueprintEditor } from '../_components/blueprint-editor';

export const dynamic = 'force-dynamic';

export default function NewBlueprintPage() {
    return (
        <div className="20ui flex flex-col gap-6 p-6">
            <BlueprintEditor mode="create" />
        </div>
    );
}
