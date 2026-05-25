import re

with open('src/app/sabsms/lists/lists-table.tsx', 'r') as f:
    content = f.read()

# Add a Lock icon import
if 'Lock' not in content:
    content = content.replace('Users,', 'Users,\n  Lock,')

kind_col = """
    {
      id: "kind",
      header: "Kind",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] capitalize">
            {r.kind || "Static"}
          </Badge>
          {r.isLocked && (
            <Lock className="h-3 w-3 text-amber-500" title="Locked" />
          )}
        </div>
      ),
    },"""

# Insert right after the Name column
content = content.replace('        </button>\n      ),\n    },', '        </button>\n      ),\n    },' + kind_col)

with open('src/app/sabsms/lists/lists-table.tsx', 'w') as f:
    f.write(content)
