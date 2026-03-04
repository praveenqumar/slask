require('dotenv').config();
const { App } = require('@slack/bolt');
const { google } = require('googleapis');
const { debug, info, error, section } = require('./lib/logger');

// --- Google Tasks Client ---
section('INITIALIZING GOOGLE TASKS CLIENT');
debug('Google Client ID', process.env.GOOGLE_CLIENT_ID);
debug('Google Refresh Token exists', !!process.env.GOOGLE_REFRESH_TOKEN);

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

// --- Slack App (Socket Mode) ---
const TRIGGER_EMOJI = process.env.TRIGGER_EMOJI || 'white_check_mark';

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    userToken: process.env.SLACK_USER_TOKEN,
    // Vercel: HTTP mode (webhooks) instead of Socket Mode
    // socketMode: true,
    // appToken: process.env.SLACK_APP_TOKEN,
});

// --- Message Processing Functions ---
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

// --- Verification: Read task back by ID ---
async function verifyTaskCreated(taskId) {
    section('VERIFYING TASK CREATION');
    try {
        debug('Fetching task with ID', { taskId });
        const response = await tasks.tasks.get({
            tasklist: '@default',
            task: taskId,
        });
        info('✅ Task verified in Google Tasks', {
            id: response.data.id,
            title: response.data.title,
            notes: response.data.notes,
            status: response.data.status,
            updated: response.data.updated
        });
        return response.data;
    } catch (err) {
        error('❌ Failed to verify task', { error: err.message, taskId });
        return null;
    }
}

// --- Catch-all Event Listener for Debugging ---
app.use(async ({ payload, context, next }) => {
    if (payload && payload.type) {
        console.log(`📨 [ALL EVENTS] Received: ${payload.type}`);
        if (process.env.LOG_LEVEL === 'DEBUG') {
            console.log(`   Payload:`, JSON.stringify(payload, null, 2));
        }
    }
    await next();
});

// --- Main Event Handler ---
app.event('star_added', async ({ event, client }) => {
    section('STAR_ADDED EVENT RECEIVED');

    // 1. Log event receipt
    debug('Full star_added event', { event });

    // Only handle starred messages
    if (event.item.type !== 'message') {
        debug('Skipping non-message star', { type: event.item.type });
        return;
    }

    // Extract message data
    const { channel, ts, messageText } = extractMessageData(event);
    const messageSender = event.item.message?.user || event.item.message?.bot_id || 'unknown';
    const starrer = event.user;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⭐ MESSAGE STARRED (SAVE LATER)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Message Content: ${messageText}`);
    console.log(`👤 Original Sender: ${messageSender}`);
    console.log(`⭐ Starred By: ${starrer}`);
    console.log(`🕐 Timestamp: ${ts}`);
    console.log(`📢 Channel: ${channel}`);
    console.log(`🔗 Slack Message Link: https://slack.com/archives/${channel}/p${ts.replace('.', '')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    info('Message starred', {
        user: starrer,
        messageSender,
        channel,
        ts
    });

    try {
        // 2. Extract message data
        debug('Extracted message data', { channel, ts, messageText });

        // 3. Generate task components
        const taskTitle = generateTaskTitle(messageText);
        const messageLink = generateMessageLink(channel, ts);
        info('Task components prepared', {
            title: taskTitle,
            link: messageLink
        });

        // 4. Create Google Task
        section('CREATING GOOGLE TASK');
        const createResponse = await tasks.tasks.insert({
            tasklist: '@default',
            requestBody: {
                title: taskTitle,
                notes: `📎 Slack message: ${messageLink}`,
            },
        });

        const createdTask = createResponse.data;
        info('✅ Task created', {
            id: createdTask.id,
            title: createdTask.title,
            notes: createdTask.notes,
            position: createdTask.position
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ GOOGLE TASK CREATED SUCCESSFULLY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📋 Task ID: ${createdTask.id}`);
        console.log(`📌 Task Title: ${createdTask.title}`);
        console.log(`📎 Notes: ${createdTask.notes}`);
        console.log(`🔗 Google Task Link: https://tasks.google.com/task/${createdTask.id}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 5. Verify task by reading it back
        const verifiedTask = await verifyTaskCreated(createdTask.id);

        if (verifiedTask) {
            section('TASK CREATION SUCCESS');
            info('Full task available at Google Tasks', {
                id: verifiedTask.id,
                selfLink: `https://tasks.google.com/task/${verifiedTask.id}`
            });
        }

    } catch (err) {
        error('❌ Error in task creation flow', {
            message: err.message,
            stack: err.stack,
            code: err.code
        });
    }
});

// --- Export functions for testing ---
module.exports = {
    extractMessageData,
    generateTaskTitle,
    generateMessageLink,
    verifyTaskCreated,
    tasks
};

// --- Vercel serverless handler ---
// Export for Vercel deployment (HTTP event delivery)
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    // Vercel serverless function handler
    // The app will handle incoming HTTP requests from Slack
    module.exports = async (req, res) => {
        // The Bolt app's built-in handler will process the request
        await app.handler(req, res);
    };
}

// --- Start App only if running directly (not in tests) ---
if (require.main === module) {
    (async () => {
        await app.start();
        console.log(`\n⚡ EmojiTasker is running!`);
        console.log(`📌 Trigger: Star (save later) any Slack message`);
        console.log(`🔍 Debug logging: ${process.env.LOG_LEVEL || 'INFO'}`);
        console.log(`\nTip: Run with LOG_LEVEL=DEBUG for verbose output\n`);
    })();
}
