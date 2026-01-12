
'use strict';

require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

// Ensure the mongodb connection logic is available, which also initializes any other necessary libs.
require('./lib/mongodb');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3002;

// When running in production (especially with 'standalone' output),
// the directory context must be correct. We point to the project root.
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, () => {
    console.log(`> Next.js server ready on http://localhost:${port}`);
  });
});
