# CLAUDE.md


# Agent Instructions: Surgical Plan & Execute

## Behavior Module
<behavior_module>
  <constraints>
    <rule>NO conversational filler. Output must be strictly technical.</rule>
    <rule>NO "I understand" or "Here is the plan." Start immediately with the data.</rule>
  </constraints>

  <workflow>
    <discovery>
      <action>When a task is assigned, list 3-5 technical bullet points as "Action Items".</action>
      <gate>End the list with exactly: "Ready to execute? (y/n)".</gate>
      <constraint>DO NOT run any `mcp` tools or write files until 'y' is received.</constraint>
    </discovery>

    <confirmation_logic>
      <on_n>Update the bullet points based on feedback and re-gate. Do NOT execute.</on_n>
      <on_y>Execute Step 1 ONLY. Perform the action, then ask "Proceed to Step 2? (y/n)".</on_y>
    </confirmation_logic>
  </workflow>

  <execution>
    <style>Output ONLY the code diff or specific command. No prose explanations.</style>
  </execution>
</behavior_module>

## Why This Code Matters

**What it does:**
This service creates a Google Task when you star ("save later") a Slack message, keeping actionable messages from getting lost.

**Why it exists:**
The user forgets important conversations in Slack and needs a way to move actionable messages to a central task management system (Google Tasks). Without this, tasks discussed in Slack are easily missed or forgotten.

**Where it fits in the ecosystem:**
```
Slack (messages)
    ↓  star_added event (trigger: save later)
[THIS SERVICE] — slask
    ↓
Google Tasks (task dump / management)
```

**Who consumes its output:**
Currently a single user personally (the developer). Future intent is to extend to team access.

---

## Project Overview

A simple Node.js bot that listens for starred Slack messages and automatically creates corresponding Google Tasks. The service uses Slack's Socket Mode and OAuth2 for Google Tasks authentication.

**Key facts:**
- Language: Node.js (JavaScript, no TypeScript)
- Primary integration: Slack Bolt + Google Tasks API
- Trigger: Starred messages (save later action, private to user)
- Scope: Single-user currently, designed for personal task management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Slack SDK | @slack/bolt (^3.21.0) |
| Google API | googleapis (^126.0.0) |
| Auth | OAuth2 (Google), Slack Bot Token |
| Config | dotenv (^16.3.1) |
| Mode | Socket Mode (no public HTTP endpoint) |
| Testing | Jest |
| Logging | Custom logger (`lib/logger.js`) |

---

## Repository Structure

```
./
├── index.js              # Main entry point — Slack app + Google Tasks integration
├── slack-manifest.yaml   # Slack app configuration (manifest)
├── .env.example          # Environment variable template
├── package.json          # Dependencies and npm scripts
├── DEBUGGING.md          # Debugging strategy and troubleshooting guide
├── test-star-event.js    # Manual test script for star event simulation
├── lib/
│   └── logger.js         # Custom logging module (debug, info, error, section)
├── scripts/
│   └── auth.js          # OAuth2 helper to generate Google refresh token
└── tests/
    ├── unit/
    │   └── message-utils.test.js  # Unit tests for message processing utilities
    └── integration/
        ├── google-tasks.test.js   # Integration tests for Google Tasks API
        └── slack-handler.test.js # Integration tests for Slack event handler
```

---

## Domain Concepts

**Slack Message** — The source content that may contain actionable information. Has a unique `ts` (timestamp) and `channel` ID.

**Star Event (`star_added`)** — The trigger action. When a user stars a message in Slack, this event is emitted. Currently filtered to only handle message types (not files, channels, etc.).

**Google Task** — The destination entity created from the Slack message. Has a `title` (first 100 chars of message text) and `notes` containing a link back to the original Slack message.

**Refresh Token** — OAuth2 credential used by Google Tasks API. Allows long-term access without requiring user to re-authenticate frequently.

**Socket Mode** — Slack's connection mode where the app connects to Slack via WebSocket. No public HTTP server needed — Slack reaches out to the bot.

---

## Architecture

```
User stars Slack message
        ↓
Slack emits star_added event
        ↓
[slask] receives event via Socket Mode
        ↓
Extracts message text + generates link
        ↓
Creates Google Task via Google Tasks API
        ↓
Task stored in user's default tasklist (@default)
```

---

## Coding Conventions

**Language:** JavaScript (ES6+). No TypeScript.

**Async style:** Uses async/await. No callbacks.

**Error handling:** Try-catch blocks in event handlers. Errors logged to console with `console.error()`. No structured error types — raw errors are logged.

**Naming:**
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` (e.g., `TRIGGER_EMOJI`)
- Environment variables: `UPPER_SNAKE_CASE`

**Logging:** Uses custom logger in `lib/logger.js` with four levels:
- `section(msg)` — Headers/boundaries for logical sections
- `debug(label, data)` — Verbose debugging (controlled by `LOG_LEVEL`)
- `info(label, data)` — Informational messages
- `error(label, data)` — Error messages with context

Set `LOG_LEVEL=DEBUG` for verbose output during troubleshooting.

**Imports:** CommonJS (`require`). No ES modules (`import/export`) used.

---

## Infra & Deployment

**Environment:** Local development currently. No cloud deployment configured.

**Slack App Configuration:**
- Socket Mode enabled (no HTTP endpoints needed)
- User event subscription: `star_added`
- Bot scopes: `channels:history`, `groups:history`, `im:history`, `mpim:history`
- User scope: `stars:read` (to detect when user stars messages)

**Environment Variables** (see `.env.example`):
- `SLACK_SIGNING_SECRET` — Slack app signing secret
- `SLACK_BOT_TOKEN` — Slack bot token (xoxb-*)
- `SLACK_APP_TOKEN` — Socket mode app token (xapp-*)
- `SLACK_USER_TOKEN` — User token for additional Slack API access (optional)
- `GOOGLE_CLIENT_ID` — Google OAuth2 client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth2 client secret
- `GOOGLE_REFRESH_TOKEN` — Long-lived refresh token for Google Tasks
- `TRIGGER_EMOJI` — Optional, default: `white_check_mark`
- `LOG_LEVEL` — Logging verbosity: `DEBUG` or `INFO` (default)

---

## How to Run

**Prerequisites:** Node.js, Slack app configured with Socket Mode, Google Cloud project with Tasks API enabled.

**Install:**
```bash
npm install
cp .env.example .env
# Fill in .env values (Slack tokens + Google OAuth credentials)
```

**Generate Google Refresh Token** (one-time setup):
```bash
node scripts/auth.js
# Follow instructions to authorize and copy the refresh_token to .env
```

**Start the app:**
```bash
npm start
# or
npm run dev
```

**Run tests:**
```bash
# Run all tests
npm test

# Run unit tests only
npm test -- tests/unit/

# Run integration tests only
npm test -- tests/integration/

# Run with coverage
npm test -- --coverage
```

**Manual star event simulation:**
```bash
# Requires SLACK_USER_ID in .env
node test-star-event.js
```

---

## Debugging & Testing Tools

**DEBUGGING.md** — Comprehensive debugging guide with step-by-step logging checkpoints to trace issues from event receipt to task creation.

**`test-star-event.js`** — Standalone script that simulates a `star_added` event without requiring actual Slack interaction. Useful for testing the complete flow offline.

**Unit tests** — `tests/unit/message-utils.test.js` covers:
- `extractMessageData()` — Data extraction with fallbacks
- `generateTaskTitle()` — 100-char truncation logic
- `generateMessageLink()` — Slack URL generation

**Integration tests** — `tests/integration/` contains:
- `google-tasks.test.js` — Real Google Tasks API calls
- `slack-handler.test.js` — Slack event handling

**Debug logging** — Set `LOG_LEVEL=DEBUG` for verbose output at each checkpoint:
1. Event receipt and item type
2. Message data extraction
3. Task creation API call
4. Task verification

---

## Gotchas & Warnings

- **Single-user limitation** — The current implementation uses a hardcoded Google refresh token (`process.env.GOOGLE_REFRESH_TOKEN`). This means only one Google account is connected. To support multiple users, you'd need per-user OAuth2 storage (database or Redis) and user ID mapping.

- **Star visibility** — The "save later" trigger (starring messages) is private to the user who stars it. This is intentional for privacy — other Slack users won't see that you starred a message.

- **Task title truncation** — Message text is sliced to first 100 characters for the task title. Longer messages are truncated.

- **Default tasklist** — All tasks go to `@default` tasklist. To add custom tasklist support, you'd need to modify the `tasklist` parameter in `tasks.tasks.insert()`.

- **Error handling** — Errors are logged but not retried. If Google Tasks API call fails, the task is not created and the user won't be notified in Slack.

- **No Slack response** — The bot doesn't confirm task creation to the user in Slack. Check console logs for `✅ Task created:` confirmation.

- **Socket Mode only** — The manifest has `interactivity.is_enabled: false`. Slash commands like `/test-gtask` require interactivity to be enabled in Slack app settings.

- **Message text fallback** — If `event.item.message.text` is undefined, it falls back to `'Task from Slack'`. This handles cases where the starred message might be an attachment or system message without text.
