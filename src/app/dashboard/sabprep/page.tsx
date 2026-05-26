import * as React from 'react';
import { Suspense } from 'react';
import { listRecipes } from '@/app/actions/dataprep.actions';
import { RecipeListClient } from './_components/recipe-list-client';

export const metadata = {
    title: 'DataPrep · SabNode',
    description: 'Visual data preparation — clean, transform, join, profile.',
};

async function RecipesData() {
    const initial = await listRecipes({ status: 'active', limit: 50 });
    return <RecipeListClient initial={initial} />;
}

export default function DataprepIndexPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm opacity-60">Loading DataPrep…</div>}>
            <RecipesData />
        </Suspense>
    );
}
