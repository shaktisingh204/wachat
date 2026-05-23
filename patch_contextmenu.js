const fs = require('fs');
const file = 'src/app/dashboard/crm/inventory/items/_components/items-table.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const [contextMenu, setContextMenu]')) {
    const importCode = `import { usePathname } from 'next/navigation';\n`;
    content = content.replace(/(import \* as React from 'react';)/, `$1\n${importCode}`);
    
    const hookCode = `
  const pathname = usePathname();
  const [contextMenu, setContextMenu] = React.useState<{ id: string; x: number; y: number } | null>(null);

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
`;
    content = content.replace(/(export function ItemsTable\([^)]+\)\s*\{\s*)/, `$1${hookCode}`);
    
    // Add onContextMenu to row
    content = content.replace(/<tr\s+key=\{row\._id\}\s+className=\{/, 
      `<tr key={row._id} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ id: row._id, x: e.clientX, y: e.clientY }); }} className={`
    );
    
    // Add context menu UI before closing div of ItemsTable
    const contextMenuUI = `
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-40 rounded-md border border-zoru-line bg-zoru-surface p-1 shadow-md"
        >
          <button onClick={() => { onToggleRow(contextMenu.id); setContextMenu(null); }} className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-zoru-surface-2 rounded-sm text-zoru-ink">Toggle selection</button>
          <Link href={\`/dashboard/crm/inventory/items/\${contextMenu.id}\`} className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-zoru-surface-2 rounded-sm text-zoru-ink">View details</Link>
          <Link href={\`/dashboard/crm/inventory/items/\${contextMenu.id}?tab=inventory\`} className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-zoru-surface-2 rounded-sm text-zoru-ink">View inventory</Link>
          <button onClick={() => { window.location.href = \`/dashboard/crm/inventory/items/\${contextMenu.id}/edit\`; }} className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-zoru-surface-2 rounded-sm text-zoru-ink">Edit item</button>
        </div>
      )}
`;
    content = content.replace(/<\/div>\s*<\/CrmBulkyGrid>/, `${contextMenuUI}\n    </div>\n    </CrmBulkyGrid>`);
    
    fs.writeFileSync(file, content);
}
