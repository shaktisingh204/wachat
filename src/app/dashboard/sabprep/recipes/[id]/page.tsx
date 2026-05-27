import * as React from 'react';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import {
    getRecipe,
    listDatasets,
    getDatasetPreview,
} from '@/app/actions/sabprep.actions';
import { RecipeCanvasClient } from '../../_components/recipe-canvas-client';
import type { Row } from '@/lib/rust-client/sabprep-steps';

export const metadata = { title: 'Recipe · DataPrep · SabNode' };

interface Props {
    params: Promise<{ id: string }>;
}

async function Canvas({ id }: { id: string }) {
    // Run independent loads in parallel — async-parallel best practice.
    const [recipe, datasets] = await Promise.all([
        getRecipe(id),
        listDatasets(),
    ]);
    if (!recipe) {
        notFound();
    }

    let sourcePreview: { rows: Row[]; name: string; rowsCount: number } | null = null;
    if (recipe.sourceDatasetId) {
        try {
            const preview = await getDatasetPreview(recipe.sourceDatasetId, 50);
            sourcePreview = {
                rows: preview.rows,
                name: preview.name,
                rowsCount: preview.rowsCount,
            };
        } catch {
            sourcePreview = null;
        }
    }

    return (
        <RecipeCanvasClient
            recipe={recipe}
            datasets={datasets}
            sourcePreview={sourcePreview}
        />
    );
}

export default async function RecipePage({ params }: Props) {
    const { id } = await params;
    return (
        <Suspense fallback={<div className="p-6 text-sm opacity-60">Loading recipe…</div>}>
            <Canvas id={id} />
        </Suspense>
    );
}
