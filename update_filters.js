const fs = require('fs');
const file = 'src/app/dashboard/hrm/permission-groups/_components/permission-groups-client.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const \[minModules, setMinModules\] = React.useState<number \| ''>\(''\);/,
  `const [minModules, setMinModules] = React.useState<number | ''>('');
  const [hasEmployees, setHasEmployees] = React.useState<string>('all'); // 'all', 'yes', 'no'`
);

content = content.replace(
  /if \(minModules !== ''\) {\s*res = res.filter\(g => moduleCount\(g\) >= minModules\);\s*}/,
  `if (minModules !== '') {
      res = res.filter(g => moduleCount(g) >= minModules);
    }
    
    if (hasEmployees !== 'all') {
      res = res.filter(g => {
        const count = assignments.filter(a => a.groupId === g._id).length;
        if (hasEmployees === 'yes') return count > 0;
        if (hasEmployees === 'no') return count === 0;
        return true;
      });
    }`
);

content = content.replace(
  /\[groups, search, minModules\]\);/,
  `[groups, search, minModules, hasEmployees, assignments]);`
);

content = content.replace(
  /<Input\s*type="number"\s*placeholder="Min modules \(e.g. 2\)"\s*value=\{minModules\}\s*onChange=\{\(e\) => setMinModules\(e.target.value === '' \? '' : Number\(e.target.value\)\)\}\s*className="max-w-\[150px\]"\s*\/>/,
  `<Input
          type="number"
          placeholder="Min modules (e.g. 2)"
          value={minModules}
          onChange={(e) => setMinModules(e.target.value === '' ? '' : Number(e.target.value))}
          className="max-w-[150px]"
        />
        <select
          value={hasEmployees}
          onChange={(e) => setHasEmployees(e.target.value)}
          className="h-9 rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-ink/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="all">All Assignments</option>
          <option value="yes">Has Employees</option>
          <option value="no">No Employees</option>
        </select>`
);

content = content.replace(
  /\(search \|\| minModules !== ''\)/g,
  `(search || minModules !== '' || hasEmployees !== 'all')`
);

content = content.replace(
  /setSearch\(''\); setMinModules\(''\);/,
  `setSearch(''); setMinModules(''); setHasEmployees('all');`
);

fs.writeFileSync(file, content);
