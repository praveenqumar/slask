# slask

> Automatically create Google Tasks when you star Slack messages

Slask (Slack + Tasks) is a simple Node.js bot that bridges Slack and Google Tasks. When you star a message in Slack ("save later" action), slask creates a corresponding Google Task with a link back to the original message.

## Why?

Actionable messages in Slack easily get lost. Slask moves them to a central task management system so you can actually follow up.

## How It Works

```
You star a Slack message
        ↓
Slack emits star_added event
        ↓
[slask] receives event via Socket Mode
        ↓
Creates Google Task (title + notes with link)
        ↓
Task stored in your default tasklist
```

## Features

- **Simple trigger**: Just star a message in Slack
- **Auto-link**: Each task includes a link back to the original Slack message
- **Private**: Your stars are only visible to you
- **Socket Mode**: No public HTTP server required
- **Single user**: Personal task management (single Google account)

## Prerequisites

- Node.js (v18+ recommended)
- Google Cloud project with Tasks API enabled
- Slack app configured with Socket Mode

## Installation

```bash
git clone <your-repo>/slask.git
cd slask
npm install
```

## Setup

### 1. Slack App

1. Create a new Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Socket Mode**
3. Add bot scopes:
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `mpim:history`
4. Add user scope:
   - `stars:read`
5. Subscribe to event: `star_added`
6. Install the app and save:
   - Bot Token (`xoxb-*`)
   - App Token (`xapp-*`)
   - Signing Secret

### 2. Google Cloud Project

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Tasks API**
3. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/callback`

### 3. Generate Google Refresh Token

```bash
cp .env.example .env
# Fill in your Slack tokens and Google Client ID/Secret
node scripts/auth.js
```

Follow the authorization prompt and copy the `refresh_token` to your `.env` file.

### 4. Environment Variables

Create a `.env` file with:

```env
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_USER_TOKEN=xoxp-your-user-token
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
TRIGGER_EMOJI=white_check_mark
LOG_LEVEL=INFO
```

## Usage

Start the bot:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

Now star any message in Slack and check your Google Tasks!

## Testing

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

## Manual Testing

Simulate a star event without using Slack:

```bash
node test-star-event.js
```

Requires `SLACK_USER_ID` in `.env`.

## Troubleshooting

Set `LOG_LEVEL=DEBUG` for verbose output:

```env
LOG_LEVEL=DEBUG
```

See [DEBUGGING.md](DEBUGGING.md) for detailed debugging steps.

## Limitations

- **Single user**: Currently supports one Google account. Multiple users would require per-user OAuth storage.
- **No notification**: The bot doesn't confirm task creation in Slack. Check console logs.
- **Default tasklist**: Tasks go to `@default` tasklist only.
- **No retry**: If Google Tasks API fails, the task is lost.

## Tech Stack

- Node.js
- [Slack Bolt](https://slack.dev/bolt-js/) — Slack SDK
- [Google APIs](https://github.com/googleapis/google-api-nodejs-client) — Google Tasks API
- Socket Mode — WebSocket connection to Slack

## License

MIT
