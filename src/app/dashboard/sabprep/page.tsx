import * as React from 'react';
import { Suspense } from 'react';

import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';
import { listRecipes } from '@/app/actions/sabprep.actions';
import { RecipeListClient } from './_components/recipe-list-client';

export const metadata = {
    title: 'DataPrep · SabNode',
    description: 'Visual data preparation — clean, transform, join, and profile tabular data.',
};

async function RecipesData() {
    const initial = await listRecipes({ status: 'active', limit: 50 });
    return <RecipeListClient initial={initial} />;
}

function RecipesFallback() {
    return (
        <div className="20ui flex flex-col gap-6 p-4 md:p-6">
            <div className="flex flex-col gap-2">
                <Skeleton width={120} height={12} />
                <Skeleton width={180} height={26} />
                <Skeleton width={360} height={14} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardBody className="flex flex-col gap-2">
                            <Skeleton width="50%" height={12} />
                            <Skeleton width="70%" height={22} />
                        </CardBody>
                    </Card>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                        <CardBody className="flex flex-col gap-3">
                            <Skeleton width="60%" height={16} />
                            <Skeleton width="90%" height={12} />
                            <Skeleton width="40%" height={12} />
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export default function DataprepIndexPage() {
    return (
        <Suspense fallback={<RecipesFallback />}>
            <RecipesData />
        </Suspense>
    );
}
