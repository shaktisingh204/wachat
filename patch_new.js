const fs = require('fs');

let pageFile = 'src/app/dashboard/crm/inventory/items/new/page.tsx';
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
    pageContent = pageContent.replace(/await getCrmProductById\(sp.fromId\)/, 
    `await fetchWithTimeout(getCrmProductById(sp.fromId), 8000, null)`);
  
    fs.writeFileSync(pageFile, pageContent);
}
