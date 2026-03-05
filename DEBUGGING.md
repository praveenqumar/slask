# Debugging Strategy for slask

## Context

The user is experiencing an issue where starring a Slack message (clicking "save for later") does not result in a Google Task being created. The application is running and connected to Slack, but no tasks appear in Google Tasks. This plan adds comprehensive logging at each stage to trace the issue from event receipt to task creation and verification.

## Critical Files

- `./index.js` - Main entry point containing the star_added event handler

## Implementation Plan

### 1. Add Event Reception Logging
At the start of the `star_added` event handler, add logging to confirm the event was received:
```javascript
app.event('star_added', async ({ event, client }) => {
    // DEBUG: Log event receipt
    console.log('🔔 [DEBUG] star_added event received:', JSON.stringify(event, null, 2));

    // Only handle starred messages
    if (event.item.type !== 'message') {
        console.log('⏭️ [DEBUG] Skipping non-message item type:', event.item.type);
        return;
    }

    console.log('✅ [DEBUG] Processing starred message event');
    ...
});
```

### 2. Add Message Content Logging
After extracting message details, log the content:
```javascript
const channel = event.item.channel;
const ts = event.item.message?.ts || event.item.ts;
const messageText = event.item.message?.text || 'Task from Slack';

// DEBUG: Log extracted message details
console.log('📝 [DEBUG] Message details:');
console.log('  - Channel:', channel);
console.log('  - Timestamp:', ts);
console.log('  - Text:', messageText);
console.log('  - Full event.item.message:', JSON.stringify(event.item.message, null, 2));
```

### 3. Add Task Creation Response Logging
Capture the response from Google Tasks API insert:
```javascript
// Create Google Task
console.log('🚀 [DEBUG] Creating Google Task...');
const response = await tasks.tasks.insert({
    tasklist: '@default',
    requestBody: {
        title: taskTitle,
        notes: `📎 Slack message: ${messageLink}`,
    },
});

console.log('✅ [DEBUG] Task created successfully');
console.log('  - Task ID:', response.data.id);
console.log('  - Task Title:', response.data.title);
console.log('  - Task Notes:', response.data.notes);
console.log('  - Full Response:', JSON.stringify(response.data, null, 2));
```

### 4. Add Verification: Read Task Back by ID
After creating the task, verify it exists by reading it back:
```javascript
// Verify task was created
console.log('🔍 [DEBUG] Verifying task exists...');
const verifyResponse = await tasks.tasks.get({
    tasklist: '@default',
    task: response.data.id,
});

console.log('✅ [DEBUG] Task verification successful');
console.log('  - Retrieved Task ID:', verifyResponse.data.id);
console.log('  - Retrieved Title:', verifyResponse.data.title);
console.log('  - Status:', verifyResponse.data.status);
```

### 5. Add Error Detail Logging
Enhance error logging to include full error details:
```javascript
} catch (err) {
    console.error('❌ [DEBUG] Error in star_added handler:');
    console.error('  - Message:', err.message);
    console.error('  - Code:', err.code);
    console.error('  - Stack:', err.stack);
    console.error('  - Full Error:', JSON.stringify(err, null, 2));
}
```

### 6. Add Additional Event Logging at Handler Entry
Add logging before the type check to see ALL star_added events:
```javascript
app.event('star_added', async ({ event, client }) => {
    // DEBUG: Log ALL star events first
    console.log('⭐ [DEBUG] Star event received');
    console.log('  - Item type:', event.item.type);
    console.log('  - User:', event.user);

    // Only handle starred messages
    if (event.item.type !== 'message') {
        console.log('⏭️ [DEBUG] Skipping non-message item type:', event.item.type);
        return;
    }
    ...
});
```

## Modified Code Structure

The `star_added` event handler will have logging at these checkpoints:

1. **Entry point** - Event received, item type, user
2. **After type check** - Processing message event
3. **After extracting data** - Channel, timestamp, message text, full message object
4. **Before API call** - Creating task
5. **After API insert** - Task ID, title, notes, full response
6. **After verification** - Read back task details, status
7. **Error handler** - Full error details with stack trace

## Verification Steps

After implementing the debug logging:

1. Restart the application: `npm start`
2. Star a message in Slack
3. Check the console output for:
   - `⭐ [DEBUG] Star event received` - confirms Slack sent the event
   - `✅ [DEBUG] Processing starred message event` - confirms type check passed
   - `📝 [DEBUG] Message details:` - shows extracted content
   - `🚀 [DEBUG] Creating Google Task...` - about to call API
   - `✅ [DEBUG] Task created successfully` - API succeeded
   - `✅ [DEBUG] Task verification successful` - task exists and is readable
   - Any `❌ [DEBUG] Error` messages to identify failure point

## Expected Log Output (Success Case)

```
⭐ [DEBUG] Star event received
  - Item type: message
  - User: U123456789
✅ [DEBUG] Processing starred message event
📝 [DEBUG] Message details:
  - Channel: C123456789
  - Timestamp: 1699123456.123456
  - Text: This is my test message
  - Full event.item.message: {...}
🚀 [DEBUG] Creating Google Task...
✅ [DEBUG] Task created successfully
  - Task ID: MTEyMzQ1Njc4OToxMjM0NTY3ODkw
  - Task Title: This is my test message
  - Task Notes: 📎 Slack message: https://slack.com/archives/C123456789/p1699123456123456
  - Full Response: {...}
🔍 [DEBUG] Verifying task exists...
✅ [DEBUG] Task verification successful
  - Retrieved Task ID: MTEyMzQ1Njc4OToxMjM0NTY3ODkw
  - Retrieved Title: This is my test message
  - Status: needsAction
```
