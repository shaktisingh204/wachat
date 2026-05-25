const fs = require('fs');
const path = require('path');

const chunk31Folders = [
  'favicon-generator', 'find-and-replace', 'ga-tag-generator', 'gtm-snippet',
  'hash-generator', 'hreflang-generator', 'htaccess-redirect', 'html-formatter',
  'html-minifier', 'html-to-markdown', 'html-to-text', 'http-headers',
  'image-alt-checker', 'image-compressor', 'image-format-converter', 'image-metadata',
  'image-resizer', 'image-to-base64', 'indexed-pages', 'internal-link-analyzer',
  'js-minifier', 'json-formatter', 'keyword-cpc', 'keyword-density',
  'keyword-difficulty', 'keyword-extractor', 'keyword-generator', 'keyword-grouper',
  'keyword-mixer', 'keyword-negative', 'keyword-rank-checker', 'keyword-trends',
  'link-extractor', 'log-analyzer', 'long-tail-keywords', 'lorem-ipsum',
  'lsi-keywords', 'markdown-to-html', 'meta-tag-analyzer', 'meta-tag-generator',
  'mobile-friendly', 'nginx-redirect', 'og-image-generator', 'og-tag-generator',
  'on-page-audit'
];

const basePath = path.join(process.cwd(), 'src/app/dashboard/seo/tools');

const errorContent = `'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="text-muted-foreground">Failed to load this tool.</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
`;

const loadingContent = `import { Card, ZoruCardContent, Skeleton } from '@/components/zoruui';

export default function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[400px]" />
      </div>
      <Card>
        <ZoruCardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
`;

chunk31Folders.forEach(folder => {
  const folderPath = path.join(basePath, folder);
  if (!fs.existsSync(folderPath)) return;
  
  const errorPath = path.join(folderPath, 'error.tsx');
  const loadingPath = path.join(folderPath, 'loading.tsx');

  if (!fs.existsSync(errorPath)) {
    fs.writeFileSync(errorPath, errorContent, 'utf-8');
  }
  if (!fs.existsSync(loadingPath)) {
    fs.writeFileSync(loadingPath, loadingContent, 'utf-8');
  }
});
console.log('Done generating skeletons');
