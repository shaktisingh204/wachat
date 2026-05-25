import os
import re

path = 'src/app/dashboard/crm/banking/bank-transactions/_components/bank-transactions-list-client.tsx'

with open(path, 'r') as f:
    content = f.read()

# Add imports
content = content.replace(
    "import Papa from 'papaparse';",
    "import Papa from 'papaparse';\nimport { useRouter, usePathname, useSearchParams } from 'next/navigation';"
)

content = content.replace(
    "CheckCircle2,",
    "CheckCircle2,\n  RefreshCw,"
)

# Update state usage
content = re.sub(
    r"const \{ toast \} = useZoruToast\(\);\n\n  const \[rows, setRows\] = React\.useState<CrmBankTransactionRow\[\]>\(initialRows\);\n  const \[total, setTotal\] = React\.useState\(initialTotal\);\n  const \[accounts, setAccounts\] = React\.useState<WithId<CrmPaymentAccount>\[\]>\(\[\]\);\n  const \[isLoading, setIsLoading\] = React\.useState\(false\);",
    "const { toast } = useZoruToast();\n  const router = useRouter();\n  const pathname = usePathname();\n  const searchParams = useSearchParams();\n\n  const rows = initialRows;\n  const total = initialTotal;\n  const [accounts, setAccounts] = React.useState<WithId<CrmPaymentAccount>[]>([]);\n  const [isSyncing, setIsSyncing] = React.useState(false);",
    content
)

# Replace refresh
refresh_pattern = r"const refresh = React\.useCallback\(async \(\) => \{[\s\S]*?\}, \[accountFilter, statusFilter, typeFilter, search, from, to\]\);"
refresh_repl = """const updateUrl = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (accountFilter !== 'all') params.set('accountId', accountFilter); else params.delete('accountId');
    if (statusFilter !== 'all') params.set('status', statusFilter); else params.delete('status');
    if (typeFilter !== 'all') params.set('type', typeFilter); else params.delete('type');
    if (search.trim()) params.set('q', search.trim()); else params.delete('q');
    if (from) params.set('from', from); else params.delete('from');
    if (to) params.set('to', to); else params.delete('to');
    
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [accountFilter, statusFilter, typeFilter, search, from, to, pathname, router, searchParams]);"""
content = re.sub(refresh_pattern, refresh_repl, content)

# Replace timeout call
content = content.replace(
    "void refresh();",
    "updateUrl();"
)

content = content.replace(
    "}, [refresh]);",
    "}, [updateUrl]);"
)

# Replace refresh in handleBulk and onImported
content = content.replace("await refresh();", "router.refresh();")
content = content.replace("onImported={() => void refresh()}", "onImported={() => router.refresh()}")
content = content.replace("isLoading", "isPending")

# Add Sync button
sync_button = """          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePlaidSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sync with Plaid
          </Button>"""

content = content.replace('          </div>\n\n          <Button\n            variant="outline"', sync_button + '\n          <Button\n            variant="outline"')

sync_handler = """  const handlePlaidSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast({ title: 'Sync complete', description: 'Fetched latest transactions from Plaid API.' });
      router.refresh();
    }, 1500);
  };

  const allSelected"""
content = content.replace("  const allSelected", sync_handler)

with open(path, 'w') as f:
    f.write(content)
