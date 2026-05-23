const fs = require('fs');

// page.tsx
let pageFile = 'src/app/dashboard/crm/inventory/items/page.tsx';
let pageContent = fs.readFileSync(pageFile, 'utf8');

if (!pageContent.includes('fetchWithTimeout')) {
    const fetchWithTimeoutDef = `
async function fetchWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('MongoDB fetch timeout exceeded');
      resolve(fallback);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}
`;
    pageContent = pageContent.replace(/(export const dynamic = 'force-dynamic';)/, `$1\n${fetchWithTimeoutDef}`);
    
    // Replace Promise.all
    pageContent = pageContent.replace(/const \[pageResult, kpiResult\] = await Promise\.all\(\[\n\s*getCrmProducts\(page, limit, q \|\| undefined\),\n\s*getCrmProducts\(1, 200, undefined\),\n\s*\]\);/, 
    `const [pageResult, kpiResult] = await Promise.all([
    fetchWithTimeout(getCrmProducts(page, limit, q || undefined), 8000, { products: [], total: 0 }),
    fetchWithTimeout(getCrmProducts(1, 200, undefined), 8000, { products: [], total: 0 }),
  ]);`);
  
    // Replace any/unknown in toRow
    pageContent = pageContent.replace(/\(d\.vendorIds as unknown\[\]\)/g, '(d.vendorIds as string[])');
    fs.writeFileSync(pageFile, pageContent);
}

// [productId]/page.tsx
let detailPageFile = 'src/app/dashboard/crm/inventory/items/[productId]/page.tsx';
let detailContent = fs.readFileSync(detailPageFile, 'utf8');

if (!detailContent.includes('fetchWithTimeout')) {
    const fetchWithTimeoutDef = `
async function fetchWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('MongoDB fetch timeout exceeded');
      resolve(fallback);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}
`;
    detailContent = detailContent.replace(/(export const dynamic = 'force-dynamic';)/, `$1\n${fetchWithTimeoutDef}`);
    
    detailContent = detailContent.replace(/const product = \(await getCrmProductById\(productId\)\) as\n\s*\|\s*\(WithId<CrmProduct> & Record<string, unknown>\)\n\s*\|\s*null;/,
    `const product = await fetchWithTimeout(getCrmProductById(productId), 8000, null) as (WithId<CrmProduct> & Record<string, unknown>) | null;`);
    
    fs.writeFileSync(detailPageFile, detailContent);
}
