import os
import re

directories = [
    ('assets', 'Asset'),
    ('budgets', 'Budget'),
    ('inventory', 'InventoryItem'),
    ('gl', 'GlEntry')
]

for dir_name, type_name in directories:
    file_path = f"src/app/dashboard/finance/{dir_name}/_components/{dir_name}-list-client.tsx"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Update lucide-react import
    if "Download, Eye" not in content:
        content = re.sub(
            r"import \{ (.*?) \} from 'lucide-react';",
            r"import { \1, Download, Eye } from 'lucide-react';",
            content
        )

    # 2. Add state and functions
    if "exportToCsv" not in content:
        state_injection = f"""  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<{type_name} | null>(null);

  function exportToCsv() {{
    if (items.length === 0) return;
    const headers = Object.keys(items[0] || {{}}).filter(k => k !== '_id' && k !== '__v');
    const csvContent = [
      headers.join(','),
      ...items.map(item => headers.map(h => JSON.stringify((item as any)[h] ?? '')).join(','))
    ].join('\\n');

    const blob = new Blob([csvContent], {{ type: 'text/csv;charset=utf-8;' }});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '{dir_name}_export.csv';
    link.click();
  }}

  function openView(item: {type_name}) {{
    setViewingItem(item);
    setIsViewOpen(true);
  }}"""
        content = content.replace("  const [search, setSearch] = useState('');\n", f"  const [search, setSearch] = useState('');\n{state_injection}\n")

    # 3. Update primaryAction
    if "onClick={exportToCsv}" not in content:
        content = content.replace(
            "primaryAction={\n        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>",
            """primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>"""
        )
        content = content.replace(
            "          </DialogContent>\n        </Dialog>\n      }",
            "          </DialogContent>\n        </Dialog>\n        </div>\n      }"
        )

    # 4. Add View Details to DropdownMenu
    if "openView(item" not in content:
        content = content.replace(
            "<DropdownMenuContent align=\"end\">",
            """<DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(item as any)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>"""
        )

    # 5. Add View Dialog at the end of EntityListShell
    if "isViewOpen" in content and "Dialog open={isViewOpen}" not in content:
        view_dialog = """
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b pb-2">
                <div className="font-medium text-sm text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="col-span-2 text-sm">{String(value)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </EntityListShell>"""
        content = content.replace("    </EntityListShell>", view_dialog)

    with open(file_path, 'w') as f:
        f.write(content)

    print(f"Updated {file_path}")

