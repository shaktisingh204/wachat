const fs = require('fs');
const file = 'src/app/dashboard/sabdesk/analytics/live-dashboards/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// import action
content = content.replace(
  /import React, \{ useState \} from 'react';/,
  "import React, { useState, useEffect } from 'react';\nimport { getLiveDashboardsData } from '@/app/actions/sabdesk-assist.actions';"
);

// add state
content = content.replace(
  /const \[searchTerm, setSearchTerm\] = useState\(''\);/,
  "const [searchTerm, setSearchTerm] = useState('');\n    const [data, setData] = useState<any[]>([]);\n    const [isLoading, setIsLoading] = useState(true);\n\n    useEffect(() => {\n        async function loadData() {\n            setIsLoading(true);\n            try {\n                const res = await getLiveDashboardsData();\n                if (res.success && res.data) {\n                    setData(res.data);\n                }\n            } catch (err) {\n                console.error(err);\n            } finally {\n                setIsLoading(false);\n            }\n        }\n        loadData();\n    }, []);"
);

// replace Array.from({ length: 15 }) with data map
content = content.replace(
  /\{Array\.from\(\{ length: 15 \}\)\.map\(\(_, i\) => \(/g,
  "{data.length > 0 ? data.map((item, i) => ("
);

// replace hardcoded #ANA-{1000 + i} with item._id or something
content = content.replace(
  /<td className="p-4 text-sm text-neutral-300 font-mono">#ANA-\{1000 \+ i\}<\/td>/,
  '<td className="p-4 text-sm text-neutral-300 font-mono">{item._id ? `#ANA-${item._id.substring(0,6)}` : `#ANA-${1000 + i}`}</td>'
);

content = content.replace(
  /<td className="p-4 text-sm text-white font-medium">Analytics Live Dashboards Item \{i \+ 1\}<\/td>/,
  '<td className="p-4 text-sm text-white font-medium">{item.name || `Analytics Live Dashboards Item ${i + 1}`}</td>'
);

// close the ternary at the end of the map
content = content.replace(
  /<\/tr>\s*\)\)\}\s*<\/tbody>/,
  '</tr>\n                                )) : <tr><td colSpan={5} className="p-4 text-center text-neutral-500">No dashboard items found.</td></tr>}\n                            </tbody>'
);

fs.writeFileSync(file, content);
