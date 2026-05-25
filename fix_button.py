import os
import re

path = 'src/app/dashboard/crm/banking/bank-transactions/_components/bank-transactions-list-client.tsx'

with open(path, 'r') as f:
    content = f.read()

sync_button = """          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePlaidSync} disabled={isSyncing}>
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> Sync with Plaid
            </Button>"""

content = content.replace('          <div className="ml-auto flex items-center gap-2">', sync_button)

with open(path, 'w') as f:
    f.write(content)
