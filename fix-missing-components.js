const fs = require('fs');
const path = require('path');

const dir = 'src/components/crm';

const files = {
  'entity-error.tsx': `export function EntityError({ error, reset }: any) { return <div><h2>Error</h2><p>{error?.message}</p><button onClick={reset}>Retry</button></div>; }`,
  'entity-error-state.tsx': `export function EntityErrorState({ title, message, retry }: any) { return <div><h2>{title}</h2><p>{message}</p><button onClick={retry}>Retry</button></div>; }`,
  'error-boundary-shell.tsx': `export function ErrorBoundaryShell({ children }: any) { return <>{children}</>; }`,
  'error-boundary-wrapper.tsx': `export function ErrorBoundaryWrapper({ children }: any) { return <>{children}</>; }`,
  'form-skeleton.tsx': `export function FormSkeleton() { return <div>Loading form...</div>; }`,
  'page-error.tsx': `export function PageError({ error, reset }: any) { return <div><h2>Page Error</h2><p>{error?.message}</p><button onClick={reset}>Retry</button></div>; }`,
  'state-card.tsx': `export function StateCard({ title, children }: any) { return <div><h3>{title}</h3>{children}</div>; }`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(dir, filename), content);
}
console.log("Missing components created.");
