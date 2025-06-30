import NodeCache from 'node-cache';

// stdTTL: time-to-live in seconds for every new entry.
// checkperiod: how often to check for expired entries.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export default cache;
