const fs = require('fs');

const file = 'src/app/dashboard/crm/inventory/items/_components/items-list-client.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('new WebSocket')) {
    const wsCode = `
  /* WebSocket for live inventory tracking */
  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${protocol}//\${window.location.host}/api/realtime/inventory\`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'INVENTORY_UPDATE') {
             // Handle live update
             toast({ title: 'Live Update', description: 'Inventory updated in real-time.' });
          }
        } catch (err) {
          console.error('Failed to parse websocket message', err);
        }
      };
    } catch (e) {
      console.error('Failed to connect WebSocket', e);
    }
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [toast]);
`;
    // Insert after const { toast } = useZoruToast();
    content = content.replace(/(const { toast } = useZoruToast\(\);\n)/, `$1${wsCode}`);
    fs.writeFileSync(file, content);
}
