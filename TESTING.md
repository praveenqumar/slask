# Testing & Debugging Guide

## Debug Logging

### Enable Verbose Logging

Run the application with `LOG_LEVEL=DEBUG` to see detailed trace logs:

```bash
LOG_LEVEL=DEBUG npm start
```

### Log Levels

- **DEBUG**: Verbose logging — all events, API calls, data extraction
- **INFO** (default): Key events — task creation, verification results
- **ERROR**: Error messages only

### What Gets Logged

1. **Event Receipt**: When a `star_added` event is received
2. **Message Extraction**: Channel ID, timestamp, message text
3. **Task Components**: Title, notes, Slack link
4. **API Calls**: Google Tasks insert, get requests
5. **Verification**: Task read-back with full task details

### Example Debug Output

```
============================================================
  STAR_ADDED EVENT RECEIVED
============================================================

[2026-03-04T10:30:45.123Z] [INFO] Message starred {"user":"U12345","channel":"C67890","ts":"1234567890.123456"}

[2026-03-04T10:30:45.124Z] [DEBUG] Extracted message data {"channel":"C67890","ts":"1234567890.123456","messageText":"Important meeting at 3pm"}

============================================================
  CREATING GOOGLE TASK
============================================================

[2026-03-04T10:30:45.500Z] [INFO] ✅ Task created {"id":"T12345","title":"Important meeting at 3pm","notes":"📎 Slack message: ...","position":"00000000000000000000"}

============================================================
  VERIFYING TASK CREATION
============================================================

[2026-03-04T10:30:45.800Z] [INFO] ✅ Task verified in Google Tasks {"id":"T12345","title":"Important meeting at 3pm","status":"needsAction"}

============================================================
  TASK CREATION SUCCESS
============================================================
```

## Manual Testing

### Test Slash Command

Use `/test-gtask` in Slack to manually test Google Tasks integration:

1. Type `/test-gtask` in any channel
2. Bot responds with test task creation status
3. Check Google Tasks for the test task

### Debug Flow Checklist

When debugging "task not appearing in Google Tasks":

1. **Is the event received?**
   - Look for `STAR_ADDED EVENT RECEIVED` section in logs
   - If not appearing: Check Slack app event subscriptions

2. **Is the message extracted correctly?**
   - Look for `Extracted message data` log
   - Verify channel, ts, and messageText are correct

3. **Is the API call made?**
   - Look for `CREATING GOOGLE TASK` section
   - If error appears: Check Google credentials and API access

4. **Is the task created?**
   - Look for `✅ Task created` log with task ID
   - If error: Check Google Tasks API status, quotas

5. **Is the task verified?**
   - Look for `VERIFYING TASK CREATION` section
   - Check for `✅ Task verified in Google Tasks`
   - If verification fails: Task may not exist or permission issue

## Unit Tests

### Run Unit Tests

```bash
npm test
```

### Run in Watch Mode

```bash
npm run test:watch
```

### Test Coverage

Unit tests cover:
- Message extraction from Slack events
- Title truncation logic
- Slack link generation
- Edge cases (empty text, system messages, etc.)

## Integration Tests

### Run Integration Tests

Integration tests require valid Google credentials:

```bash
GOOGLE_CLIENT_ID=xxx GOOGLE_REFRESH_TOKEN=xxx npm test
```

### Test Coverage

Integration tests cover:
- Google Tasks API: create, read, list, update, delete
- Task verification function
- Slack event handler processing

## Common Issues

### "Task not created"

**Check:**
- Is `GOOGLE_REFRESH_TOKEN` set correctly?
- Is Google Tasks API enabled in GCP console?
- Check logs for error message after `CREATING GOOGLE TASK`

### "Event not received"

**Check:**
- Is Socket Mode enabled?
- Is `star_added` event subscribed?
- Is user scope `stars:read` granted?
- Is the bot token valid?

### "Verification failed"

**Check:**
- Task created but can't be read — permission issue?
- Network connectivity to Google APIs
- API quota exceeded?

## Environment Variables

Add to `.env`:

```bash
# Required
SLACK_SIGNING_SECRET=xxx
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_APP_TOKEN=xapp-xxx
SLACK_USER_TOKEN=xoxp-xxx

GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx

# Optional
TRIGGER_EMOJI=white_check_mark
LOG_LEVEL=DEBUG
```
