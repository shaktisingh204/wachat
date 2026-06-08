import * as React from 'react';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';
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

function CanvasFallback() {
    return (
        <div className="20ui flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] px-4 py-3 md:px-6">
                <Skeleton circle width={32} height={32} />
                <Skeleton width={240} height={34} />
                <Skeleton width={70} height={22} />
                <div className="ml-auto flex gap-2">
                    <Skeleton width={84} height={34} />
                    <Skeleton width={110} height={34} />
                </div>
            </div>
            <div className="grid flex-1 grid-cols-12 gap-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="col-span-12 lg:col-span-4">
                        <Card>
                            <CardBody className="flex flex-col gap-3">
                                <Skeleton width="50%" height={14} />
                                {Array.from({ length: 5 }).map((__, j) => (
                                    <Skeleton key={j} width="100%" height={12} />
                                ))}
                            </CardBody>
                        </Card>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default async function RecipePage({ params }: Props) {
    const { id } = await params;
    return (
        <Suspense fallback={<CanvasFallback />}>
            <Canvas id={id} />
        </Suspense>
    );
}
