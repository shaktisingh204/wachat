import * as Papa from 'papaparse';

self.onmessage = (e: MessageEvent) => {
    const { data } = e;
    if (!data || data.length === 0) {
        self.postMessage('');
        return;
    }
    
    // Generate CSV using PapaParse in the worker thread
    const csv = Papa.unparse(data);
    self.postMessage(csv);
};
