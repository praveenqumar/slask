require('dotenv').config();
const { google } = require('googleapis');
const { extractMessageData, generateTaskTitle, generateMessageLink } = require('./index');

// Mock star_added event for the specific message
const mockStarEvent = {
    type: 'star_added',
    user: process.env.SLACK_USER_ID || 'U123456789',
    item: {
        type: 'message',
        channel: 'C0AE4PHBFM0',
        message: {
            type: 'message',
            subtype: 'bot_message',
            bot_id: 'B123456789',
            text: 'This is the message content', // Update with actual message text
            ts: '1770734026.194479',
            channel: 'C0AE4PHBFM0',
        },
        ts: '1770734026.194479',
        created: 1770734026,
    },
    event_ts: '1770735000.123456',
};

async function runTest() {
    console.log('🧪 Testing star event handler logic...\n');

    // 1. Test message data extraction
    console.log('📝 Step 1: Extracting message data');
    const { channel, ts, messageText } = extractMessageData(mockStarEvent);
    console.log(`  - Channel: ${channel}`);
    console.log(`  - Timestamp: ${ts}`);
    console.log(`  - Message Text: ${messageText}\n`);

    // 2. Test task title generation
    console.log('📋 Step 2: Generating task title');
    const taskTitle = generateTaskTitle(messageText);
    console.log(`  - Title: ${taskTitle}\n`);

    // 3. Test message link generation
    console.log('🔗 Step 3: Generating message link');
    const messageLink = generateMessageLink(channel, ts);
    console.log(`  - Link: ${messageLink}\n`);

    // 4. Test Google Tasks API
    console.log('🚀 Step 4: Creating Google Task...');
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

        const createResponse = await tasks.tasks.insert({
            tasklist: '@default',
            requestBody: {
                title: taskTitle,
                notes: `📎 Slack message: ${messageLink}`,
            },
        });

        console.log(`  ✅ Task created!`);
        console.log(`     ID: ${createResponse.data.id}`);
        console.log(`     Title: ${createResponse.data.title}`);
        console.log(`     Notes: ${createResponse.data.notes}\n`);

        // 5. Verify task by reading it back
        console.log('🔍 Step 5: Verifying task...');
        const verifyResponse = await tasks.tasks.get({
            tasklist: '@default',
            task: createResponse.data.id,
        });

        console.log(`  ✅ Task verified!`);
        console.log(`     ID: ${verifyResponse.data.id}`);
        console.log(`     Status: ${verifyResponse.data.status}`);
        console.log(`     Updated: ${verifyResponse.data.updated}\n`);

        console.log('🎉 All tests passed! Check Google Tasks for the created task.');
        console.log(`   Direct link: https://tasks.google.com/task/${createResponse.data.id}`);

    } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
        console.error(`     Code: ${err.code}`);
        console.error(`     Stack: ${err.stack}`);
    }
}

runTest();
