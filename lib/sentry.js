const Sentry = require('@sentry/node');

if (!process.env.SENTRY_DSN) {
  console.warn('[WARN] SENTRY_DSN is not set — Sentry error tracking is disabled');
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  integrations: [Sentry.httpIntegration()],
});

module.exports = Sentry;
