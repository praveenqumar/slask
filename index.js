'use strict';

require('dotenv').config();
const crypto = require('crypto');
const Sentry = require('./lib/sentry');
const Task_Enricher = require('./lib/task-enricher');

// --- Legacy helpers (kept for backward compatibility with existing tests) ---
function extractMessageData(event) {
  const channel = event.item.channel;
  const ts = event.item.message?.ts || event.item.ts;
  const messageText = event.item.message?.text || 'Task from Slack';
  return { channel, ts, messageText };
}

function generateTaskTitle(messageText) {
  return messageText.slice(0, 100);
}

function generateMessageLink(channel, ts) {
  return `https://slack.com/archives/${channel}/p${ts.replace('.', '')}`;
}

// --- Startup env var check ---
const REQUIRED_ENV_VARS = [
  'SLACK_SIGNING_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'LLM_API_KEY',
];
for (const v of REQUIRED_ENV_VARS) {
  if (!process.env[v]) {
    console.warn(`[WARN] Missing required environment variable: ${v}`);
  }
}

// --- Slack signature verification ---
function verifySlackSignature(rawBody, headers, signingSecret) {
  const timestamp = headers['x-slack-request-timestamp'];
  const slackSig = headers['x-slack-signature'];
  if (!timestamp || !slackSig) return false;

  const sigBase = `v0:${timestamp}:${rawBody.toString()}`;
  const computed = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(sigBase)
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(slackSig));
  } catch {
    return false;
  }
}

// --- Response helper (works with raw Node http AND Express/Vercel) ---
function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  if (typeof res.status === 'function') {
    // Express / Vercel style
    res.status(statusCode).json(body);
  } else {
    // Raw Node http.ServerResponse
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(payload);
  }
}

// --- Handler factory ---
function createHandler(taskEnricher) {
  return async function handler(req, res) {
    console.log(`[WEBHOOK] Incoming request: ${req.method} ${req.url}`);

    // Ignore non-POST requests (browser hits, favicon, etc.)
    if (req.method !== 'POST') {
      sendJson(res, 200, { ok: true, service: 'slask' });
      return;
    }
    try {
      // Collect raw body
      const rawBody = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
      console.log(`[WEBHOOK] Raw body (${rawBody.length} bytes):`, rawBody.toString().slice(0, 300));

      // Parse JSON body
      let body;
      try {
        body = JSON.parse(rawBody.toString());
      } catch {
        console.error('[WEBHOOK] Failed to parse JSON body');
        sendJson(res, 400, { error: 'Invalid JSON' });
        return;
      }

      // Signature verification (skip in test mode)
      if (process.env.NODE_ENV !== 'test') {
        const valid = verifySlackSignature(
          rawBody,
          req.headers,
          process.env.SLACK_SIGNING_SECRET || ''
        );
        console.log(`[WEBHOOK] Signature valid: ${valid}`);
        if (!valid) {
          sendJson(res, 401, { error: 'Invalid signature' });
          return;
        }
      } else {
        console.log('[WEBHOOK] Skipping signature verification (NODE_ENV=test)');
      }

      const { type, event, challenge } = body;
      console.log(`[WEBHOOK] Event type: ${type}, event.type: ${event?.type}, item.type: ${event?.item?.type}`);

      // url_verification challenge
      if (type === 'url_verification') {
        console.log('[WEBHOOK] Responding to url_verification challenge');
        sendJson(res, 200, { challenge });
        return;
      }

      // star_added message events — respond immediately, process in background
      if (event && event.type === 'star_added' && event.item && event.item.type === 'message') {
        console.log('[WEBHOOK] star_added message event detected — responding 200, enriching in background');
        console.log('[WEBHOOK] Event item:', JSON.stringify(event.item, null, 2));
        sendJson(res, 200, { ok: true });
        taskEnricher.enrich(event).catch((err) => {
          Sentry.captureException(err);
          console.error('[ERROR] Background enrichment failed:', err.message);
        });
        return;
      }

      console.log(`[WEBHOOK] Unhandled event type "${type}" / "${event?.type}" — responding 200`);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      Sentry.captureException(err);
      console.error('[ERROR] Unhandled error in webhook handler:', err.message);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  };
}

const defaultHandler = createHandler(new Task_Enricher());

// Build a shared Google Tasks API instance for legacy test compatibility
const { google } = require('googleapis');
const _oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
_oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const tasks = google.tasks({ version: 'v1', auth: _oauth2Client });

async function verifyTaskCreated(taskId) {
  try {
    const response = await tasks.tasks.get({ tasklist: '@default', task: taskId });
    return response.data;
  } catch (err) {
    console.error('Failed to verify task', err.message);
    return null;
  }
}

module.exports = defaultHandler;
module.exports.createHandler = createHandler;
module.exports.extractMessageData = extractMessageData;
module.exports.generateTaskTitle = generateTaskTitle;
module.exports.generateMessageLink = generateMessageLink;
module.exports.tasks = tasks;
module.exports.verifyTaskCreated = verifyTaskCreated;
