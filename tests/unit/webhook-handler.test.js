'use strict';

jest.mock('../../lib/sentry', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));

jest.mock('../../lib/task-enricher');

const Sentry = require('../../lib/sentry');
const { createHandler } = require('../../index');

function makeReq(body, headers = {}) {
  const raw = JSON.stringify(body);
  const buf = Buffer.from(raw);
  return {
    headers,
    on: jest.fn((event, cb) => {
      if (event === 'data') cb(buf);
      if (event === 'end') cb();
    }),
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = 'test';
});

describe('Webhook_Handler', () => {
  describe('url_verification', () => {
    it('responds HTTP 200 with the challenge value', async () => {
      const handler = createHandler({ enrich: jest.fn() });
      const req = makeReq({ type: 'url_verification', challenge: 'abc123' });
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ challenge: 'abc123' });
    });
  });

  describe('star_added with item.type === "message"', () => {
    it('calls taskEnricher.enrich exactly once and responds HTTP 200', async () => {
      const mockEnrich = jest.fn().mockResolvedValue({});
      const handler = createHandler({ enrich: mockEnrich });

      const event = {
        type: 'star_added',
        item: { type: 'message', channel: 'C123', ts: '123.456' },
      };
      const req = makeReq({ type: 'event_callback', event });
      const res = makeRes();

      await handler(req, res);

      expect(mockEnrich).toHaveBeenCalledTimes(1);
      expect(mockEnrich).toHaveBeenCalledWith(event);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('star_added with item.type !== "message"', () => {
    it('responds HTTP 200 without calling taskEnricher.enrich', async () => {
      const mockEnrich = jest.fn();
      const handler = createHandler({ enrich: mockEnrich });

      const event = {
        type: 'star_added',
        item: { type: 'file', file: { id: 'F123' } },
      };
      const req = makeReq({ type: 'event_callback', event });
      const res = makeRes();

      await handler(req, res);

      expect(mockEnrich).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('invalid signature', () => {
    it('responds HTTP 401 when signature is invalid', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.SLACK_SIGNING_SECRET = 'test-secret';

      const handler = createHandler({ enrich: jest.fn() });
      const req = makeReq(
        { type: 'event_callback', event: { type: 'star_added' } },
        { 'x-slack-request-timestamp': '12345', 'x-slack-signature': 'v0=invalidsig' }
      );
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('unhandled error', () => {
    it('responds HTTP 500 and calls Sentry.captureException', async () => {
      const err = new Error('Something exploded');
      const handler = createHandler({ enrich: jest.fn().mockRejectedValue(err) });

      const event = {
        type: 'star_added',
        item: { type: 'message', channel: 'C123', ts: '123.456' },
      };
      const req = makeReq({ type: 'event_callback', event });
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(Sentry.captureException).toHaveBeenCalledWith(err);
    });
  });
});
