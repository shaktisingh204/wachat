const fs = require('fs');
let content = fs.readFileSync('src/app/page-client.tsx', 'utf8');

const statusComponent = `
function SystemStatusIndicator() {
  const [statusText, setStatusText] = React.useState('Checking systems...');
  const [statusColor, setStatusColor] = React.useState('sn-tag');
  
  React.useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        const ind = data?.page?.status_indicator || data?.status?.indicator;
        if (ind === 'none' || ind === 'operational') {
          setStatusText('All systems operational');
          setStatusColor('sn-tag sn-tag-live');
        } else if (ind === 'minor' || ind === 'degraded') {
          setStatusText('Degraded performance');
          setStatusColor('sn-tag text-yellow-600 bg-yellow-50 border-yellow-200');
        } else if (ind === 'major' || ind === 'critical') {
          setStatusText('System Outage');
          setStatusColor('sn-tag text-red-600 bg-red-50 border-red-200');
        } else {
          setStatusText('All systems · 99.99%');
          setStatusColor('sn-tag sn-tag-live');
        }
      })
      .catch(() => {
        setStatusText('All systems · 99.99%');
        setStatusColor('sn-tag sn-tag-live');
      });
  }, []);

  return (
    <div className="pt-3 flex items-center gap-3">
      <Link href="/status" className={statusColor}>
        <span className="dot" style={statusColor.includes('yellow') ? { background: '#EAB308', boxShadow: '0 0 0 3px rgba(234,179,8,0.2)' } : statusColor.includes('red') ? { background: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.2)' } : {}} /> {statusText}
      </Link>
    </div>
  );
}
`;

content = content.replace(
  /<div className="pt-3 flex items-center gap-3">[\s\S]*?<\/div>/,
  '<SystemStatusIndicator />'
);

content = content + '\n' + statusComponent;

fs.writeFileSync('src/app/page-client.tsx', content);
