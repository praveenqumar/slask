# Vercel Deployment Guide

## Prerequisites

1. Google Cloud project with Tasks API enabled
2. Slack app configured for HTTP event delivery (not Socket Mode)
3. Vercel account

## Environment Variables

Set these in Vercel dashboard:

```
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
TRIGGER_EMOJI=white_check_mark
LOG_LEVEL=INFO
```

## Slack App Configuration

Update your Slack app:

1. Disable Socket Mode: Set `socket_mode_enabled: false` in manifest
2. Enable Interactivity: Set `interactivity.is_enabled: true`
3. Add Request URL: `https://your-app.vercel.app/api/slack/events`

## GitHub Secrets

Add these to your GitHub repository secrets:

- `VERCEL_TOKEN` - From Vercel account settings
- `VERCEL_ORG_ID` - From project settings in Vercel
- `VERCEL_PROJECT_ID` - From project settings in Vercel
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REFRESH_TOKEN` - Generated via `scripts/auth.js`

## Deployment

Push to `main` branch to trigger CI/CD:
```
git checkout main
git merge feature-vercel-deployment
git push origin main
```
