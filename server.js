'use strict';

require('dotenv').config();
const http = require('http');
const handler = require('./index');

const PORT = process.env.PORT || 3000;

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`\n⚡ Local server running at http://localhost:${PORT}`);
  console.log(`📌 Expose with: npx ngrok http ${PORT}`);
  console.log(`🔗 Then set Slack Request URL to: https://<ngrok-id>.ngrok.io`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
